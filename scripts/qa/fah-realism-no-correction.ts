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
  fourthRail: 'short' | 'long';
};

type CandidateOverrides = {
  cushionRestitution: number;
  cushionContactFriction: number;
  clothLinearSpinCouplingPerSec: number;
  spinDampingPerTick: number;
  linearDampingPerTick: number;
  cushionPostCollisionSpeedScale: number;
  cushionFrictionSpinDamping: number;
};

type Hit = {
  cushion: CushionId;
  index: number;
  speedMps: number;
};

type ShotEval = {
  first: number;
  routeValid: boolean;
  observed: { second: number | null; third: number | null; fourth: number | null };
  error: { second: number; third: number; fourth: number };
  speedPenalty: number;
  score: number;
};

type CandidateResult = {
  rank?: number;
  overrides: CandidateOverrides;
  score: number;
  coordMae: number;
  coordMaxAbs: number;
  speedPenaltyMean: number;
  routePassRate: number;
  byPoint: ShotEval[];
};

const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const BALL_RADIUS = 0.03075;
const FIXED_CUE_WORLD_X = -TABLE_WIDTH / 2 + 0.36;
const FIXED_CUE_WORLD_Z = -0.471637;
const FIXED_DRAG_PX = Number(process.env.FAH_FIXED_DRAG_PX ?? '127');
const FIXED_IMPACT_OFFSET_X = -BALL_RADIUS * 0.4;
const FIXED_IMPACT_OFFSET_Y = BALL_RADIUS * 0.4;
const FAH_FIRST_RAIL_AIM_SIDE_LEAD = 0.12;

const ANCHORS: AnchorTarget[] = [
  { first: 0, second: 37, third: 50, fourth: 20, fourthRail: 'short' },
  { first: 10, second: 32, third: 40, fourth: 25, fourthRail: 'short' },
  { first: 20, second: 27, third: 30, fourth: 32, fourthRail: 'short' },
  { first: 30, second: 20, third: 20, fourth: 40, fourthRail: 'short' },
  { first: 40, second: 10, third: 10, fourth: 100, fourthRail: 'long' },
  { first: 45, second: 5, third: 5, fourth: 95, fourthRail: 'long' },
];

const PASS_COORD_MAE = Number(process.env.FAH_PASS_COORD_MAE ?? '8.0');
const PASS_COORD_MAX = Number(process.env.FAH_PASS_COORD_MAX ?? '18.0');
const PASS_SPEED_PENALTY = Number(process.env.FAH_PASS_SPEED_PENALTY ?? '1.8');
const PASS_ROUTE_RATE = Number(process.env.FAH_PASS_ROUTE_RATE ?? '0.95');

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
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

function worldToPhysicsXY(x: number, z: number): { x: number; y: number } {
  return { x: x + TABLE_WIDTH / 2, y: z + TABLE_HEIGHT / 2 };
}

function physicsToWorldXZ(x: number, y: number): { x: number; z: number } {
  return { x: x - TABLE_WIDTH / 2, z: y - TABLE_HEIGHT / 2 };
}

function directionDegFromCueToTarget(cueX: number, cueZ: number, targetX: number, targetZ: number): number {
  const dx = targetX - cueX;
  const dz = targetZ - cueZ;
  return (Math.atan2(dx, dz) * 180) / Math.PI;
}

function normalizeFahCushionId(cushion: CushionId): CushionId {
  if (cushion === 'top') return 'bottom';
  if (cushion === 'bottom') return 'top';
  return cushion;
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

function computeFahCompensatedAimTarget(cueX: number, cueZ: number, firstSide: 'left' | 'right', requestedFirstIndex: number): { x: number; z: number } {
  const marker = computeFahMarkerRailTarget(firstSide, requestedFirstIndex);
  const collision = computeFahFirstRailTarget(firstSide, requestedFirstIndex);
  const markerDepth = marker.z - cueZ;
  const collisionDepth = collision.z - cueZ;
  if (Math.abs(markerDepth) <= 1e-6) return collision;
  const depthRatio = collisionDepth / markerDepth;
  const compensatedX = cueX + (marker.x - cueX) * depthRatio;
  return { x: clamp(compensatedX, -TABLE_WIDTH / 2, TABLE_WIDTH / 2), z: collision.z };
}

function buildCandidate(random: () => number, base: CandidateOverrides): CandidateOverrides {
  const jitter = (center: number, span: number, min: number, max: number): number =>
    round3(clamp(center + (random() * 2 - 1) * span, min, max));
  return {
    cushionRestitution: jitter(base.cushionRestitution, 0.035, 0.66, 0.78),
    cushionContactFriction: jitter(base.cushionContactFriction, 0.035, 0.08, 0.19),
    clothLinearSpinCouplingPerSec: jitter(base.clothLinearSpinCouplingPerSec, 0.45, 0.45, 1.8),
    spinDampingPerTick: jitter(base.spinDampingPerTick, 0.006, 0.982, 0.996),
    linearDampingPerTick: jitter(base.linearDampingPerTick, 0.006, 0.975, 0.992),
    cushionPostCollisionSpeedScale: jitter(base.cushionPostCollisionSpeedScale, 0.02, 0.975, 1.01),
    cushionFrictionSpinDamping: jitter(base.cushionFrictionSpinDamping, 0.12, 0.45, 0.95),
  };
}

function speedPenaltyFromHits(hits: Hit[]): number {
  if (hits.length < 4) return 4.0;
  let penalty = 0;
  for (let i = 0; i < 3; i += 1) {
    const prev = hits[i].speedMps;
    const next = hits[i + 1].speedMps;
    if (prev <= 1e-6) {
      penalty += 1.5;
      continue;
    }
    const ratio = next / prev;
    if (ratio > 1.0) {
      penalty += (ratio - 1.0) * 20;
    }
    if (ratio < 0.35) {
      penalty += (0.35 - ratio) * 6;
    }
    if (ratio > 0.98) {
      penalty += (ratio - 0.98) * 8;
    }
  }
  return round3(penalty);
}

function evaluateShot(anchor: AnchorTarget, candidate: CandidateOverrides): ShotEval {
  const cueStart = { x: FIXED_CUE_WORLD_X, z: FIXED_CUE_WORLD_Z };
  const startIndex = computeFahStartIndexFromCue(cueStart.x);
  const startSide = inferFahStartSide(cueStart.x);
  const first = quantizeFahIndexToNearestHalfStep(anchor.first);
  const indexModel = buildFahIndexModel(startIndex, first, startSide);
  const firstTarget = computeFahCompensatedAimTarget(cueStart.x, cueStart.z, indexModel.firstCushionSide, indexModel.firstCushionIndex);
  const shotDirectionDeg = directionDegFromCueToTarget(cueStart.x, cueStart.z, firstTarget.x, firstTarget.z);

  const cfg = createRoomPhysicsStepConfig('default', {
    cushionRestitution: candidate.cushionRestitution,
    cushionContactFriction: candidate.cushionContactFriction,
    clothLinearSpinCouplingPerSec: candidate.clothLinearSpinCouplingPerSec,
    spinDampingPerTick: candidate.spinDampingPerTick,
    linearDampingPerTick: candidate.linearDampingPerTick,
    cushionPostCollisionSpeedScale: candidate.cushionPostCollisionSpeedScale,
    cushionFrictionSpinDamping: candidate.cushionFrictionSpinDamping,
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

  const balls: PhysicsBallState[] = [
    {
      id: 'cueBall',
      x: cuePhysicsStart.x,
      y: cuePhysicsStart.y,
      vx: forwardX * shotInit.initialBallSpeedMps,
      vy: forwardY * shotInit.initialBallSpeedMps,
      spinX: shotInit.omegaX * forwardY,
      spinY: -shotInit.omegaX * forwardX,
      spinZ: shotInit.omegaZ,
      isPocketed: false,
    },
  ];

  const rawHits: Hit[] = [];
  let lastHit: CushionId | null = null;
  let sameCount = 0;
  for (let tick = 0; tick < 2400; tick += 1) {
    stepRoomPhysicsWorld(balls, cfg as StepRoomPhysicsConfig, {
      onCushionCollision: (ball, cushionId) => {
        if (ball.id !== 'cueBall') return;
        const normalized = normalizeFahCushionId(cushionId);
        if (lastHit === normalized) {
          sameCount += 1;
        } else {
          lastHit = normalized;
          sameCount = 0;
        }
        if (sameCount > 0) return;
        const world = physicsToWorldXZ(ball.x, ball.y);
        rawHits.push({
          cushion: normalized,
          index: mapFahCushionContactToIndex(normalized, { x: world.x, z: world.z }, TABLE_WIDTH, TABLE_HEIGHT),
          speedMps: Math.hypot(ball.vx, ball.vy),
        });
      },
    });
    if (Math.hypot(balls[0].vx, balls[0].vy) < cfg.shotEndLinearSpeedThresholdMps && rawHits.length >= 4) {
      break;
    }
  }

  const firstCushion = indexModel.firstCushionSide === 'right' ? 'right' : 'left';
  const thirdCushion = firstCushion === 'right' ? 'left' : 'right';
  const fourthCushion: CushionId = anchor.fourthRail === 'long' ? 'bottom' : firstCushion;
  const route: CushionId[] = [firstCushion, 'top', thirdCushion, fourthCushion];
  const filtered: Hit[] = [];
  let cursor = 0;
  for (const hit of rawHits) {
    if (cursor >= route.length) break;
    if (hit.cushion !== route[cursor]) continue;
    filtered.push(hit);
    cursor += 1;
  }

  const routeValid = filtered.length === 4;
  const obs2 = filtered[1]?.index ?? null;
  const obs3 = filtered[2]?.index ?? null;
  const obs4 = filtered[3]?.index ?? null;

  const e2 = (obs2 ?? anchor.second) - anchor.second;
  const e3 = (obs3 ?? anchor.third) - anchor.third;
  const e4 = (obs4 ?? anchor.fourth) - anchor.fourth;
  const speedPenalty = speedPenaltyFromHits(filtered);
  const coordCost = (Math.abs(e2) * 0.35) + (Math.abs(e3) * 0.35) + (Math.abs(e4) * 0.30);
  const missPenalty = routeValid ? 0 : 12;
  const score = round3(coordCost + speedPenalty + missPenalty);

  return {
    first: anchor.first,
    routeValid,
    observed: { second: obs2, third: obs3, fourth: obs4 },
    error: { second: round3(e2), third: round3(e3), fourth: round3(e4) },
    speedPenalty,
    score,
  };
}

function evaluateCandidate(candidate: CandidateOverrides): CandidateResult {
  const byPoint = ANCHORS.map((anchor) => evaluateShot(anchor, candidate));
  const allErrors = byPoint.flatMap((row) => [row.error.second, row.error.third, row.error.fourth]);
  const coordMae = allErrors.reduce((sum, value) => sum + Math.abs(value), 0) / allErrors.length;
  const coordMaxAbs = allErrors.reduce((max, value) => Math.max(max, Math.abs(value)), 0);
  const speedPenaltyMean = byPoint.reduce((sum, row) => sum + row.speedPenalty, 0) / byPoint.length;
  const routePassRate = byPoint.filter((row) => row.routeValid).length / byPoint.length;
  const score = (coordMae * 0.65) + (coordMaxAbs * 0.2) + (speedPenaltyMean * 0.15) + ((1 - routePassRate) * 10);
  return {
    overrides: candidate,
    score: round3(score),
    coordMae: round3(coordMae),
    coordMaxAbs: round3(coordMaxAbs),
    speedPenaltyMean: round3(speedPenaltyMean),
    routePassRate: round3(routePassRate),
    byPoint,
  };
}

function isPass(result: CandidateResult): boolean {
  return (
    result.coordMae <= PASS_COORD_MAE &&
    result.coordMaxAbs <= PASS_COORD_MAX &&
    result.speedPenaltyMean <= PASS_SPEED_PENALTY &&
    result.routePassRate >= PASS_ROUTE_RATE
  );
}

async function run(): Promise<void> {
  const base = createRoomPhysicsStepConfig('default');
  const baseCandidate: CandidateOverrides = {
    cushionRestitution: base.cushionRestitution,
    cushionContactFriction: base.cushionContactFriction,
    clothLinearSpinCouplingPerSec: base.clothLinearSpinCouplingPerSec ?? 1.0,
    spinDampingPerTick: base.spinDampingPerTick ?? 1.0,
    linearDampingPerTick: base.linearDampingPerTick ?? 1.0,
    cushionPostCollisionSpeedScale: base.cushionPostCollisionSpeedScale ?? 1.0,
    cushionFrictionSpinDamping: base.cushionFrictionSpinDamping ?? 0.8,
  };

  const searchCount = Math.max(10, Number(process.env.FAH_SEARCH_COUNT ?? '400'));
  const randomSeed = Number(process.env.FAH_RANDOM_SEED ?? '4317');
  const rand = mulberry32(randomSeed);
  const runId = process.env.FAH_RUN_ID ?? `fah-realism-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  const evaluated: CandidateResult[] = [];
  evaluated.push(evaluateCandidate(baseCandidate));
  for (let i = 0; i < searchCount; i += 1) {
    evaluated.push(evaluateCandidate(buildCandidate(rand, baseCandidate)));
  }
  evaluated.sort((a, b) => a.score - b.score);
  const top = evaluated.slice(0, 12).map((row, index) => ({ ...row, rank: index + 1 }));
  const best = top[0] ?? null;

  const summary = {
    runId,
    randomSeed,
    searchCount,
    passThresholds: {
      coordMae: PASS_COORD_MAE,
      coordMaxAbs: PASS_COORD_MAX,
      speedPenaltyMean: PASS_SPEED_PENALTY,
      routePassRate: PASS_ROUTE_RATE,
    },
    baseline: evaluated[0],
    best,
    bestPass: best ? isPass(best) : false,
    top,
  };

  if (process.env.FAH_NO_WRITE === '1') {
    console.log(JSON.stringify(summary, null, 2));
    return;
  }

  const outDir = resolve(process.cwd(), 'tmp', 'fah');
  mkdirSync(outDir, { recursive: true });
  const summaryPath = resolve(outDir, `${runId}.realism.summary.json`);
  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ runId, summaryPath, best }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
