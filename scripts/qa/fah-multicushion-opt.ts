import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createRoomPhysicsStepConfig } from '../../packages/physics-core/src/room-physics-config.ts';
import { stepRoomPhysicsWorld, type CushionId, type PhysicsBallState, type StepRoomPhysicsConfig } from '../../packages/physics-core/src/room-physics-step.ts';
import { computeShotInitialization } from '../../packages/physics-core/src/shot-init.ts';
import {
  buildFahIndexModel,
  inferFahStartSide,
  mapFahCushionContactToIndex,
  mapFahIndexToRailRatio,
  mapFahRailRatioToIndex,
  quantizeFahIndexToNearestHalfStep,
} from '../../apps/web/src/lib/fah-index-system.ts';

type AnchorTarget = {
  first: number;
  second: number;
  third: number;
  fourth: number;
};

type CandidateOverrides = {
  speedBoost: number;
  cushionRestitution: number;
  cushionContactFriction: number;
  clothLinearSpinCouplingPerSec: number;
  spinDampingPerTick: number;
  linearDampingPerTick: number;
  cushionPostCollisionSpeedScale: number;
  cushionSpinMonotonicRetention: number;
};

type ShotEval = {
  first: number;
  simulateFirst: number;
  routeValid: boolean;
  expected: { second: number; third: number; fourth: number };
  observed: { second: number | null; third: number | null; fourth: number | null };
  error: { second: number; third: number; fourth: number };
  weightedAbsError: number;
};

type CandidateResult = {
  rank?: number;
  overrides: CandidateOverrides;
  mae: number;
  rmse: number;
  weightedScore: number;
  byPoint: ShotEval[];
  byPointCorrected: ShotEval[];
  pointCorrections: Record<string, number>;
  correctionPenalty: number;
};

const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const BALL_RADIUS = 0.03075;
const FIXED_CUE_WORLD_X = -TABLE_WIDTH / 2 + TABLE_WIDTH / 8;
const FIXED_CUE_WORLD_Z = -TABLE_HEIGHT / 2 + TABLE_HEIGHT / 4;
const FIXED_DRAG_PX = 127;
const FIXED_IMPACT_OFFSET_X = -BALL_RADIUS * 0.4;
const FIXED_IMPACT_OFFSET_Y = BALL_RADIUS * 0.4;
const FAH_FIRST_RAIL_AIM_SIDE_LEAD = 0.12;

const ANCHORS: AnchorTarget[] = [
  // Right long-cushion starts only: P10/P20/P30/P40.
  // P10/P20 목표는 현재 튜닝용 임시 기준값.
  { first: 10, second: 30, third: 30, fourth: 50 },
  { first: 20, second: 25, third: 25, fourth: 80 },
  { first: 30, second: 20, third: 20, fourth: 110 },
  { first: 40, second: 30, third: 10, fourth: 100 },
];

const SCORE_GLOBAL_WEIGHT = Number(process.env.FAH_SCORE_GLOBAL_WEIGHT ?? '0.25');
const SCORE_P10_SECOND_WEIGHT = Number(process.env.FAH_SCORE_P10_SECOND_WEIGHT ?? '4.0');
const SCORE_P10_THIRD_WEIGHT = Number(process.env.FAH_SCORE_P10_THIRD_WEIGHT ?? '0.6');
const SCORE_P10_FOURTH_WEIGHT = Number(process.env.FAH_SCORE_P10_FOURTH_WEIGHT ?? '3.2');
const SCORE_POINT_CORRECTION_PENALTY = Number(process.env.FAH_SCORE_POINT_CORRECTION_PENALTY ?? '0.18');
const FAH_POINT_CORRECTION_LIMIT = Number(process.env.FAH_POINT_CORRECTION_LIMIT ?? '18');
const FAH_POINT_CORRECTION_SECOND_WEIGHT = Number(process.env.FAH_POINT_CORRECTION_SECOND_WEIGHT ?? '0.65');
const FAH_POINT_CORRECTION_THIRD_WEIGHT = Number(process.env.FAH_POINT_CORRECTION_THIRD_WEIGHT ?? '0.25');
const FAH_POINT_CORRECTION_FOURTH_WEIGHT = Number(process.env.FAH_POINT_CORRECTION_FOURTH_WEIGHT ?? '0.10');

function normalizeFahCushionId(cushion: CushionId): CushionId {
  if (cushion === 'top') {
    return 'bottom';
  }
  if (cushion === 'bottom') {
    return 'top';
  }
  return cushion;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function resolvePointCorrection(pointCorrections: Record<string, number>, targetPoint: number): number {
  const entries = Object.entries(pointCorrections)
    .map(([key, value]) => ({ point: Number(key), correction: Number(value) }))
    .filter((entry) => Number.isFinite(entry.point) && Number.isFinite(entry.correction))
    .sort((a, b) => a.point - b.point);
  if (entries.length === 0 || !Number.isFinite(targetPoint)) {
    return 0;
  }
  if (entries.length === 1) {
    return entries[0].correction;
  }
  const clampedTarget = clamp(targetPoint, entries[0].point, entries[entries.length - 1].point);
  if (clampedTarget <= entries[0].point) {
    return entries[0].correction;
  }
  if (clampedTarget >= entries[entries.length - 1].point) {
    return entries[entries.length - 1].correction;
  }
  for (let i = 0; i < entries.length - 1; i += 1) {
    const left = entries[i];
    const right = entries[i + 1];
    if (clampedTarget >= left.point && clampedTarget <= right.point) {
      const span = right.point - left.point;
      if (span <= 0) {
        return left.correction;
      }
      const t = (clampedTarget - left.point) / span;
      return left.correction + (right.correction - left.correction) * t;
    }
  }
  return 0;
}

function derivePointCorrections(rows: ShotEval[]): Record<string, number> {
  const corrections: Record<string, number> = {};
  for (const row of rows) {
    const hasSecond = row.observed.second !== null;
    const hasThird = row.observed.third !== null;
    const hasFourth = row.observed.fourth !== null;
    if (!hasSecond && !hasThird && !hasFourth) {
      continue;
    }

    let weighted = 0;
    let weightSum = 0;
    if (hasSecond) {
      weighted += (-row.error.second) * FAH_POINT_CORRECTION_SECOND_WEIGHT;
      weightSum += FAH_POINT_CORRECTION_SECOND_WEIGHT;
    }
    if (hasThird) {
      weighted += (-row.error.third) * FAH_POINT_CORRECTION_THIRD_WEIGHT;
      weightSum += FAH_POINT_CORRECTION_THIRD_WEIGHT;
    }
    if (hasFourth) {
      weighted += (-row.error.fourth) * FAH_POINT_CORRECTION_FOURTH_WEIGHT;
      weightSum += FAH_POINT_CORRECTION_FOURTH_WEIGHT;
    }
    if (weightSum <= 0) {
      continue;
    }

    const correction = clamp(weighted / weightSum, -FAH_POINT_CORRECTION_LIMIT, FAH_POINT_CORRECTION_LIMIT);
    corrections[String(round3(row.first))] = round3(correction);
  }
  return corrections;
}

function correctionPenalty(pointCorrections: Record<string, number>): number {
  const values = Object.values(pointCorrections);
  if (values.length === 0) {
    return 0;
  }
  const averageAbs = values.reduce((sum, value) => sum + Math.abs(value), 0) / values.length;
  return round3(averageAbs);
}

function worldToPhysicsXY(x: number, z: number): { x: number; y: number } {
  return {
    x: x + TABLE_WIDTH / 2,
    y: z + TABLE_HEIGHT / 2,
  };
}

function physicsToWorldXZ(x: number, y: number): { x: number; z: number } {
  return {
    x: x - TABLE_WIDTH / 2,
    z: y - TABLE_HEIGHT / 2,
  };
}

function directionDegFromCueToTarget(cueX: number, cueZ: number, targetX: number, targetZ: number): number {
  const dx = targetX - cueX;
  const dz = targetZ - cueZ;
  const deg = (Math.atan2(dx, dz) * 180) / Math.PI;
  return (deg + 360) % 360;
}

function computeFahStartIndexFromCue(cueX: number): number {
  const topX = TABLE_WIDTH / 2 - BALL_RADIUS;
  const bottomX = -TABLE_WIDTH / 2 + BALL_RADIUS;
  const ratio = clamp((topX - cueX) / (topX - bottomX), 0, 1);
  return quantizeFahIndexToNearestHalfStep(mapFahRailRatioToIndex(ratio));
}

function computeFahFirstRailTarget(firstSide: 'left' | 'right', firstIndex: number): { x: number; z: number } {
  const targetRatio = mapFahIndexToRailRatio(quantizeFahIndexToNearestHalfStep(firstIndex));
  const leftRailX = -TABLE_WIDTH / 2;
  const rightRailX = TABLE_WIDTH / 2;
  const targetX = rightRailX - targetRatio * (rightRailX - leftRailX);
  const sideZSign = firstSide === 'right' ? 1 : -1;
  const targetZ = sideZSign * (TABLE_HEIGHT / 2 - BALL_RADIUS + FAH_FIRST_RAIL_AIM_SIDE_LEAD);
  return { x: targetX, z: targetZ };
}

function computeFahMarkerRailTarget(firstSide: 'left' | 'right', firstIndex: number): { x: number; z: number } {
  const targetRatio = mapFahIndexToRailRatio(quantizeFahIndexToNearestHalfStep(firstIndex));
  const leftRailX = -TABLE_WIDTH / 2;
  const rightRailX = TABLE_WIDTH / 2;
  const targetX = rightRailX - targetRatio * (rightRailX - leftRailX);
  const cushionThicknessM = 0.058;
  const sideZSign = firstSide === 'right' ? 1 : -1;
  const targetZ = sideZSign * (TABLE_HEIGHT / 2 + cushionThicknessM / 2);
  return { x: targetX, z: targetZ };
}

function computeFahCompensatedAimTarget(
  cueX: number,
  cueZ: number,
  firstSide: 'left' | 'right',
  requestedFirstIndex: number,
): { x: number; z: number } {
  const marker = computeFahMarkerRailTarget(firstSide, requestedFirstIndex);
  const collision = computeFahFirstRailTarget(firstSide, requestedFirstIndex);
  const markerDepth = marker.z - cueZ;
  const collisionDepth = collision.z - cueZ;
  if (Math.abs(markerDepth) <= 1e-6) {
    return collision;
  }
  const depthRatio = collisionDepth / markerDepth;
  const compensatedX = cueX + (marker.x - cueX) * depthRatio;
  return {
    x: clamp(compensatedX, -TABLE_WIDTH / 2, TABLE_WIDTH / 2),
    z: collision.z,
  };
}

function mulberry32(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t += 0x6d2b79f5;
    let x = t;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

function buildCandidate(random: () => number): CandidateOverrides {
  const jitter = (center: number, span: number, min: number, max: number): number =>
    round3(clamp(center + (random() * 2 - 1) * span, min, max));
  return {
    speedBoost: jitter(2.0, 0.22, 1.7, 2.4),
    cushionRestitution: jitter(0.9, 0.05, 0.84, 0.95),
    cushionContactFriction: jitter(0.05, 0.03, 0.03, 0.11),
    clothLinearSpinCouplingPerSec: jitter(1.0, 0.45, 0.7, 1.9),
    spinDampingPerTick: jitter(0.989, 0.004, 0.983, 0.995),
    linearDampingPerTick: jitter(0.983, 0.004, 0.976, 0.992),
    cushionPostCollisionSpeedScale: jitter(1.0, 0.02, 0.97, 1.02),
    cushionSpinMonotonicRetention: jitter(0.92, 0.06, 0.84, 0.98),
  };
}

function evaluateShot(anchor: AnchorTarget, candidate: CandidateOverrides, simulateFirst?: number): ShotEval {
  const cueStart = { x: FIXED_CUE_WORLD_X, z: FIXED_CUE_WORLD_Z };
  const startIndex = computeFahStartIndexFromCue(cueStart.x);
  const startSide = inferFahStartSide(cueStart.x);
  const targetFirst = quantizeFahIndexToNearestHalfStep(Number.isFinite(simulateFirst) ? simulateFirst : anchor.first);
  const indexModel = buildFahIndexModel(startIndex, targetFirst, startSide);
  const firstTarget = computeFahCompensatedAimTarget(
    cueStart.x,
    cueStart.z,
    indexModel.firstCushionSide,
    indexModel.firstCushionIndex,
  );
  const shotDirectionDeg = directionDegFromCueToTarget(cueStart.x, cueStart.z, firstTarget.x, firstTarget.z);

  const base = createRoomPhysicsStepConfig('fahTest', {
    cushionRestitution: candidate.cushionRestitution,
    cushionContactFriction: candidate.cushionContactFriction,
    clothLinearSpinCouplingPerSec: candidate.clothLinearSpinCouplingPerSec,
    spinDampingPerTick: candidate.spinDampingPerTick,
    linearDampingPerTick: candidate.linearDampingPerTick,
    cushionPostCollisionSpeedScale: candidate.cushionPostCollisionSpeedScale,
    cushionSpinMonotonicEnabled: true,
    cushionSpinMonotonicRetention: candidate.cushionSpinMonotonicRetention,
  });

  const cuePhysicsStart = worldToPhysicsXY(cueStart.x, cueStart.z);
  const shotInit = computeShotInitialization({
    dragPx: FIXED_DRAG_PX,
    impactOffsetX: FIXED_IMPACT_OFFSET_X,
    impactOffsetY: FIXED_IMPACT_OFFSET_Y,
  });
  const directionRad = (shotDirectionDeg * Math.PI) / 180;
  const forwardX = Math.sin(directionRad);
  const forwardY = Math.cos(directionRad);
  const speed = shotInit.initialBallSpeedMps * candidate.speedBoost;

  const balls: PhysicsBallState[] = [
    {
      id: 'cueBall',
      x: cuePhysicsStart.x,
      y: cuePhysicsStart.y,
      vx: forwardX * speed,
      vy: forwardY * speed,
      spinX: shotInit.omegaX * forwardY,
      spinY: -shotInit.omegaX * forwardX,
      spinZ: shotInit.omegaZ,
      isPocketed: false,
    },
  ];

  const rawHits: Array<{ cushion: CushionId; index: number }> = [];
  let lastHit: CushionId | null = null;
  let sameCount = 0;

  for (let tick = 0; tick < 2200; tick += 1) {
    stepRoomPhysicsWorld(balls, base as StepRoomPhysicsConfig, {
      onCushionCollision: (ball, cushionId) => {
        if (ball.id !== 'cueBall') {
          return;
        }
        const normalizedCushion = normalizeFahCushionId(cushionId);
        if (lastHit === normalizedCushion) {
          sameCount += 1;
        } else {
          lastHit = normalizedCushion;
          sameCount = 0;
        }
        if (sameCount > 0) {
          return;
        }
        const world = physicsToWorldXZ(ball.x, ball.y);
        const index = mapFahCushionContactToIndex(normalizedCushion, { x: world.x, z: world.z }, TABLE_WIDTH, TABLE_HEIGHT);
        rawHits.push({ cushion: normalizedCushion, index });
      },
    });
    const cue = balls[0];
    const stopped = Math.hypot(cue.vx, cue.vy) < base.shotEndLinearSpeedThresholdMps;
    if (stopped && rawHits.length >= 4) {
      break;
    }
  }

  const fahRoute: CushionId[] = ['right', 'top', 'left', 'bottom'];
  let routeCursor = 0;
  const fahHits: Array<{ cushion: CushionId; index: number }> = [];
  for (const hit of rawHits) {
    if (routeCursor >= fahRoute.length) {
      break;
    }
    if (hit.cushion !== fahRoute[routeCursor]) {
      continue;
    }
    fahHits.push(hit);
    routeCursor += 1;
  }

  const routeValid = fahHits.length === 4;
  const obs2 = fahHits[1]?.index ?? null;
  const obs3 = fahHits[2]?.index ?? null;
  const obs4 = fahHits[3]?.index ?? null;

  const error2 = (obs2 ?? anchor.second) - anchor.second;
  const error3 = (obs3 ?? anchor.third) - anchor.third;
  const error4 = (obs4 ?? anchor.fourth) - anchor.fourth;
  const missPenalty = (obs2 === null ? 12 : 0) + (obs3 === null ? 12 : 0) + (obs4 === null ? 12 : 0);
  const routePenalty = routeValid ? 0 : 20;
  const weightedAbsError =
    (Math.abs(error2) * 0.4) + (Math.abs(error3) * 0.35) + (Math.abs(error4) * 0.25) + missPenalty + routePenalty;

  return {
    first: anchor.first,
    simulateFirst: targetFirst,
    routeValid,
    expected: {
      second: anchor.second,
      third: anchor.third,
      fourth: anchor.fourth,
    },
    observed: {
      second: obs2,
      third: obs3,
      fourth: obs4,
    },
    error: {
      second: round3(error2),
      third: round3(error3),
      fourth: round3(error4),
    },
    weightedAbsError: round3(weightedAbsError),
  };
}

function evaluateCandidate(candidate: CandidateOverrides): CandidateResult {
  const byPoint = ANCHORS.map((anchor) => evaluateShot(anchor, candidate));
  const pointCorrections = derivePointCorrections(byPoint);
  const byPointCorrected = ANCHORS.map((anchor) => {
    const correction = resolvePointCorrection(pointCorrections, anchor.first);
    return evaluateShot(anchor, candidate, anchor.first + correction);
  });
  const errors = byPointCorrected.flatMap((row) => [row.error.second, row.error.third, row.error.fourth]);
  const mae = errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length;
  const rmse = Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length);
  const baseScore = byPointCorrected.reduce((sum, row) => sum + row.weightedAbsError, 0) / byPointCorrected.length;
  const p10 = byPointCorrected.find((row) => row.first === 10);
  const p10Objective = p10
    ? (Math.abs(p10.error.second) * SCORE_P10_SECOND_WEIGHT)
      + (Math.abs(p10.error.third) * SCORE_P10_THIRD_WEIGHT)
      + (Math.abs(p10.error.fourth) * SCORE_P10_FOURTH_WEIGHT)
    : 0;
  const penalty = correctionPenalty(pointCorrections);
  const weightedScore = (baseScore * SCORE_GLOBAL_WEIGHT) + p10Objective + (penalty * SCORE_POINT_CORRECTION_PENALTY);
  return {
    overrides: candidate,
    mae: round3(mae),
    rmse: round3(rmse),
    weightedScore: round3(weightedScore),
    byPoint,
    byPointCorrected,
    pointCorrections,
    correctionPenalty: round3(penalty),
  };
}

function getPointCorrection(row: CandidateResult, point: number): number | '' {
  const key = String(Math.round(point));
  const value = row.pointCorrections[key];
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }
  return '';
}

async function run(): Promise<void> {
  const runId = process.env.FAH_RUN_ID ?? `fah-multiopt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const searchCount = Math.max(20, Number(process.env.FAH_SEARCH_COUNT ?? '120'));
  const randomSeed = Number(process.env.FAH_RANDOM_SEED ?? '3901');
  const rand = mulberry32(randomSeed);

  const candidates: CandidateResult[] = [];
  const baseline: CandidateOverrides = {
    speedBoost: 2.0,
    cushionRestitution: 0.9,
    cushionContactFriction: 0.05,
    clothLinearSpinCouplingPerSec: 1.0,
    spinDampingPerTick: 0.989,
    linearDampingPerTick: 0.983,
    cushionPostCollisionSpeedScale: 1.0,
    cushionSpinMonotonicRetention: 0.92,
  };
  candidates.push(evaluateCandidate(baseline));
  for (let i = 0; i < searchCount; i += 1) {
    candidates.push(evaluateCandidate(buildCandidate(rand)));
  }

  candidates.sort((a, b) => a.weightedScore - b.weightedScore);
  const top = candidates.slice(0, 12).map((row, index) => ({ ...row, rank: index + 1 }));
  const best = top[0] ?? null;

  const result = {
    runId,
    randomSeed,
    searchCount,
    anchors: ANCHORS,
    best,
    top,
  };

  const outDir = resolve(process.cwd(), 'tmp', 'fah');
  mkdirSync(outDir, { recursive: true });
  const summaryPath = resolve(outDir, `${runId}.multi-cushion-opt.summary.json`);
  writeFileSync(summaryPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  const csvPath = resolve(outDir, `${runId}.multi-cushion-opt.top.csv`);
  const header = [
    'rank',
    'weightedScore',
    'mae',
    'rmse',
    'correctionPenalty',
    'speedBoost',
    'cushionRestitution',
    'cushionContactFriction',
    'clothLinearSpinCouplingPerSec',
    'spinDampingPerTick',
    'linearDampingPerTick',
    'cushionPostCollisionSpeedScale',
    'cushionSpinMonotonicRetention',
    'p10_e2',
    'p10_e3',
    'p10_e4',
    'p20_e2',
    'p20_e3',
    'p20_e4',
    'p30_e2',
    'p30_e3',
    'p30_e4',
    'p40_e2',
    'p40_e3',
    'p40_e4',
    'p10_corr2',
    'p10_corr3',
    'p10_corr4',
    'p20_corr2',
    'p20_corr3',
    'p20_corr4',
    'p30_corr2',
    'p30_corr3',
    'p30_corr4',
    'p40_corr2',
    'p40_corr3',
    'p40_corr4',
    'corr_p10',
    'corr_p20',
    'corr_p30',
    'corr_p40',
  ];
  const csvRows = top.map((row) => {
    const at = (first: number) => row.byPoint.find((point) => point.first === first);
    const atCorrected = (first: number) => row.byPointCorrected.find((point) => point.first === first);
    return [
      row.rank,
      row.weightedScore,
      row.mae,
      row.rmse,
      row.correctionPenalty,
      row.overrides.speedBoost,
      row.overrides.cushionRestitution,
      row.overrides.cushionContactFriction,
      row.overrides.clothLinearSpinCouplingPerSec,
      row.overrides.spinDampingPerTick,
      row.overrides.linearDampingPerTick,
      row.overrides.cushionPostCollisionSpeedScale,
      row.overrides.cushionSpinMonotonicRetention,
      at(10)?.error.second ?? '',
      at(10)?.error.third ?? '',
      at(10)?.error.fourth ?? '',
      at(20)?.error.second ?? '',
      at(20)?.error.third ?? '',
      at(20)?.error.fourth ?? '',
      at(30)?.error.second ?? '',
      at(30)?.error.third ?? '',
      at(30)?.error.fourth ?? '',
      at(40)?.error.second ?? '',
      at(40)?.error.third ?? '',
      at(40)?.error.fourth ?? '',
      atCorrected(10)?.error.second ?? '',
      atCorrected(10)?.error.third ?? '',
      atCorrected(10)?.error.fourth ?? '',
      atCorrected(20)?.error.second ?? '',
      atCorrected(20)?.error.third ?? '',
      atCorrected(20)?.error.fourth ?? '',
      atCorrected(30)?.error.second ?? '',
      atCorrected(30)?.error.third ?? '',
      atCorrected(30)?.error.fourth ?? '',
      atCorrected(40)?.error.second ?? '',
      atCorrected(40)?.error.third ?? '',
      atCorrected(40)?.error.fourth ?? '',
      getPointCorrection(row, 10),
      getPointCorrection(row, 20),
      getPointCorrection(row, 30),
      getPointCorrection(row, 40),
    ].join(',');
  });
  writeFileSync(csvPath, `${header.join(',')}\n${csvRows.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify({ runId, summaryPath, csvPath, best }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
