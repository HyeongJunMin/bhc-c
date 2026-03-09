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
};

const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const BALL_RADIUS = 0.03075;
const FIXED_CUE_WORLD_X = -TABLE_WIDTH / 2 + TABLE_WIDTH / 8;
const FIXED_CUE_WORLD_Z = -TABLE_HEIGHT / 2 + TABLE_HEIGHT / 4;
const FIXED_DRAG_PX = 127;
const FIXED_IMPACT_OFFSET_X = -BALL_RADIUS * 0.4;
const FIXED_IMPACT_OFFSET_Y = BALL_RADIUS * 0.4;

const ANCHORS: AnchorTarget[] = [
  { first: 0, second: 5, third: 40, fourth: 20 },
  { first: 30, second: 20, third: 20, fourth: 110 },
  { first: 40, second: 30, third: 10, fourth: 100 },
  { first: 45, second: 35, third: 5, fourth: 95 },
];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
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
  const topRailX = TABLE_WIDTH / 2;
  const bottomRailX = -TABLE_WIDTH / 2;
  const targetX = topRailX - targetRatio * (topRailX - bottomRailX);
  const sideZSign = firstSide === 'right' ? 1 : -1;
  const targetZ = sideZSign * (TABLE_HEIGHT / 2 - BALL_RADIUS);
  return { x: targetX, z: targetZ };
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

function evaluateShot(anchor: AnchorTarget, candidate: CandidateOverrides): ShotEval {
  const cueStart = { x: FIXED_CUE_WORLD_X, z: FIXED_CUE_WORLD_Z };
  const startIndex = computeFahStartIndexFromCue(cueStart.x);
  const startSide = inferFahStartSide(cueStart.z);
  const indexModel = buildFahIndexModel(startIndex, anchor.first, startSide);
  const firstTarget = computeFahFirstRailTarget(indexModel.firstCushionSide, indexModel.firstCushionIndex);
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

  const cushionHits: Array<{ cushion: CushionId; index: number }> = [];
  let lastHit: CushionId | null = null;
  let sameCount = 0;

  for (let tick = 0; tick < 2200; tick += 1) {
    stepRoomPhysicsWorld(balls, base as StepRoomPhysicsConfig, {
      onCushionCollision: (ball, cushionId) => {
        if (ball.id !== 'cueBall') {
          return;
        }
        if (lastHit === cushionId) {
          sameCount += 1;
        } else {
          lastHit = cushionId;
          sameCount = 0;
        }
        if (sameCount > 0) {
          return;
        }
        const world = physicsToWorldXZ(ball.x, ball.y);
        const index = mapFahCushionContactToIndex(cushionId, { x: world.x, z: world.z }, TABLE_WIDTH, TABLE_HEIGHT);
        cushionHits.push({ cushion: cushionId, index });
      },
    });
    const cue = balls[0];
    const stopped = Math.hypot(cue.vx, cue.vy) < base.shotEndLinearSpeedThresholdMps;
    if (stopped && cushionHits.length >= 4) {
      break;
    }
  }

  const obs2 = cushionHits[1]?.index ?? null;
  const obs3 = cushionHits[2]?.index ?? null;
  const obs4 = cushionHits[3]?.index ?? null;

  const error2 = (obs2 ?? anchor.second) - anchor.second;
  const error3 = (obs3 ?? anchor.third) - anchor.third;
  const error4 = (obs4 ?? anchor.fourth) - anchor.fourth;
  const missPenalty = (obs2 === null ? 12 : 0) + (obs3 === null ? 12 : 0) + (obs4 === null ? 12 : 0);
  const weightedAbsError = (Math.abs(error2) * 0.4) + (Math.abs(error3) * 0.35) + (Math.abs(error4) * 0.25) + missPenalty;

  return {
    first: anchor.first,
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
  const errors = byPoint.flatMap((row) => [row.error.second, row.error.third, row.error.fourth]);
  const mae = errors.reduce((sum, value) => sum + Math.abs(value), 0) / errors.length;
  const rmse = Math.sqrt(errors.reduce((sum, value) => sum + value * value, 0) / errors.length);
  const weightedScore = byPoint.reduce((sum, row) => sum + row.weightedAbsError, 0) / byPoint.length;
  return {
    overrides: candidate,
    mae: round3(mae),
    rmse: round3(rmse),
    weightedScore: round3(weightedScore),
    byPoint,
  };
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
    'speedBoost',
    'cushionRestitution',
    'cushionContactFriction',
    'clothLinearSpinCouplingPerSec',
    'spinDampingPerTick',
    'linearDampingPerTick',
    'cushionPostCollisionSpeedScale',
    'cushionSpinMonotonicRetention',
    'p0_e2',
    'p0_e3',
    'p0_e4',
    'p30_e2',
    'p30_e3',
    'p30_e4',
    'p40_e2',
    'p40_e3',
    'p40_e4',
    'p45_e2',
    'p45_e3',
    'p45_e4',
  ];
  const csvRows = top.map((row) => {
    const at = (first: number) => row.byPoint.find((point) => point.first === first);
    return [
      row.rank,
      row.weightedScore,
      row.mae,
      row.rmse,
      row.overrides.speedBoost,
      row.overrides.cushionRestitution,
      row.overrides.cushionContactFriction,
      row.overrides.clothLinearSpinCouplingPerSec,
      row.overrides.spinDampingPerTick,
      row.overrides.linearDampingPerTick,
      row.overrides.cushionPostCollisionSpeedScale,
      row.overrides.cushionSpinMonotonicRetention,
      at(0)?.error.second ?? '',
      at(0)?.error.third ?? '',
      at(0)?.error.fourth ?? '',
      at(30)?.error.second ?? '',
      at(30)?.error.third ?? '',
      at(30)?.error.fourth ?? '',
      at(40)?.error.second ?? '',
      at(40)?.error.third ?? '',
      at(40)?.error.fourth ?? '',
      at(45)?.error.second ?? '',
      at(45)?.error.third ?? '',
      at(45)?.error.fourth ?? '',
    ].join(',');
  });
  writeFileSync(csvPath, `${header.join(',')}\n${csvRows.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify({ runId, summaryPath, csvPath, best }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
