import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createRoomPhysicsStepConfig } from '../../packages/physics-core/src/room-physics-config.ts';
import { stepRoomPhysicsWorld, type CushionId, type PhysicsBallState } from '../../packages/physics-core/src/room-physics-step.ts';
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

type HitRow = {
  order: number;
  cushion: CushionId;
  x: number;
  z: number;
  index: number;
  speed: number;
  headingDeg: number;
  spinNorm: number;
};

const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const BALL_RADIUS = 0.03075;
const CUSHION_THICKNESS = 0.058;

const FIXED_CUE_WORLD_X = -TABLE_WIDTH / 2 + TABLE_WIDTH / 8;
const FIXED_CUE_WORLD_Z = -TABLE_HEIGHT / 2 + TABLE_HEIGHT / 4;
const FIXED_DRAG_PX = 127;
const FIXED_IMPACT_OFFSET_X = -BALL_RADIUS * 0.4;
const FIXED_IMPACT_OFFSET_Y = BALL_RADIUS * 0.4;

const DEFAULT_ANCHORS: AnchorTarget[] = [
  { first: 0, second: 5, third: 40, fourth: 20 },
  { first: 30, second: 20, third: 20, fourth: 110 },
  { first: 40, second: 30, third: 10, fourth: 100 },
  { first: 45, second: 35, third: 5, fourth: 95 },
];

function normalizeFahCushionId(cushion: CushionId): CushionId {
  if (cushion === 'top') {
    return 'bottom';
  }
  if (cushion === 'bottom') {
    return 'top';
  }
  return cushion;
}

function resolveAnchors(): AnchorTarget[] {
  const raw = process.env.FAH_DIAG_POINTS?.trim();
  if (!raw) {
    return DEFAULT_ANCHORS;
  }
  const points = raw
    .split(',')
    .map((v) => Number(v.trim()))
    .filter((v) => Number.isFinite(v))
    .map((v) => Math.round(v));
  if (points.length === 0) {
    return DEFAULT_ANCHORS;
  }
  return points.map((first) => ({
    first,
    second: 0,
    third: 0,
    fourth: 0,
  }));
}

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

function headingDeg(vx: number, vy: number): number {
  const deg = (Math.atan2(vx, vy) * 180) / Math.PI;
  return (deg + 360) % 360;
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
  const topRailZ = TABLE_HEIGHT / 2;
  const bottomRailZ = -TABLE_HEIGHT / 2;
  const targetZ = topRailZ - targetRatio * (topRailZ - bottomRailZ);
  const sideXSign = firstSide === 'right' ? 1 : -1;
  const targetX = sideXSign * (TABLE_WIDTH / 2 - BALL_RADIUS);
  return { x: targetX, z: targetZ };
}

function computeFahMarkerRailTarget(firstSide: 'left' | 'right', firstIndex: number): { x: number; z: number } {
  const targetRatio = mapFahIndexToRailRatio(quantizeFahIndexToNearestHalfStep(firstIndex));
  const topRailZ = TABLE_HEIGHT / 2;
  const bottomRailZ = -TABLE_HEIGHT / 2;
  const targetZ = topRailZ - targetRatio * (topRailZ - bottomRailZ);
  const sideXSign = firstSide === 'right' ? 1 : -1;
  const targetX = sideXSign * (TABLE_WIDTH / 2 + CUSHION_THICKNESS / 2);
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
  const markerDepth = marker.x - cueX;
  const collisionDepth = collision.x - cueX;
  if (Math.abs(collisionDepth) <= 1e-6 || Math.abs(markerDepth) <= 1e-6) {
    return collision;
  }
  const depthScale = markerDepth / collisionDepth;
  const compensatedZ = cueZ + (collision.z - cueZ) * depthScale;
  return {
    x: marker.x,
    z: clamp(compensatedZ, -TABLE_HEIGHT / 2, TABLE_HEIGHT / 2),
  };
}

function getDiagnosticOverrides() {
  return {
    speedBoost: Number(process.env.FAH_SPEED_BOOST ?? '1.79'),
    cushionRestitution: Number(process.env.FAH_CUSHION_RESTITUTION ?? '0.851'),
    cushionContactFriction: Number(process.env.FAH_CUSHION_CONTACT_FRICTION ?? '0.03'),
    clothLinearSpinCouplingPerSec: Number(process.env.FAH_CLOTH_SPIN_COUPLING ?? '1.382'),
    spinDampingPerTick: Number(process.env.FAH_SPIN_DAMPING ?? '0.988'),
    linearDampingPerTick: Number(process.env.FAH_LINEAR_DAMPING ?? '0.987'),
    cushionPostCollisionSpeedScale: Number(process.env.FAH_CUSHION_POST_SPEED_SCALE ?? '0.99'),
    cushionSpinMonotonicRetention: Number(process.env.FAH_SPIN_RETENTION ?? '0.979'),
  };
}

function checkRailMappingMonotonic() {
  const points: Array<{ cushion: CushionId; trend: 'inc' | 'dec'; values: number[] }> = [];
  const sampleRatios = [0, 0.25, 0.5, 0.75, 1];
  const byCushion: CushionId[] = ['top', 'bottom', 'left', 'right'];
  for (const cushion of byCushion) {
    const values = sampleRatios.map((ratio) => {
      if (cushion === 'top' || cushion === 'bottom') {
        const x = TABLE_WIDTH / 2 - ratio * TABLE_WIDTH;
        const z = cushion === 'top' ? TABLE_HEIGHT / 2 : -TABLE_HEIGHT / 2;
        return mapFahCushionContactToIndex(cushion, { x, z }, TABLE_WIDTH, TABLE_HEIGHT);
      }
      const z = TABLE_HEIGHT / 2 - ratio * TABLE_HEIGHT;
      const x = cushion === 'right' ? TABLE_WIDTH / 2 : -TABLE_WIDTH / 2;
      return mapFahCushionContactToIndex(cushion, { x, z }, TABLE_WIDTH, TABLE_HEIGHT);
    });
    const trend = values[values.length - 1] >= values[0] ? 'inc' : 'dec';
    points.push({ cushion, trend, values: values.map(round3) });
  }
  return points;
}

function runAnchor(anchor: AnchorTarget, maxTicks: number, overrides: ReturnType<typeof getDiagnosticOverrides>) {
  const cueStart = { x: FIXED_CUE_WORLD_X, z: FIXED_CUE_WORLD_Z };
  const startIndex = computeFahStartIndexFromCue(cueStart.x);
  const startSide = inferFahStartSide(cueStart.x);
  const indexModel = buildFahIndexModel(startIndex, anchor.first, startSide);
  const aimTarget = computeFahCompensatedAimTarget(
    cueStart.x,
    cueStart.z,
    indexModel.firstCushionSide,
    indexModel.firstCushionIndex,
  );
  const markerTarget = computeFahMarkerRailTarget(indexModel.firstCushionSide, indexModel.firstCushionIndex);
  const collisionTarget = computeFahFirstRailTarget(indexModel.firstCushionSide, indexModel.firstCushionIndex);
  const shotDirection = directionDegFromCueToTarget(cueStart.x, cueStart.z, aimTarget.x, aimTarget.z);

  const base = createRoomPhysicsStepConfig('fahTest', {
    cushionRestitution: overrides.cushionRestitution,
    cushionContactFriction: overrides.cushionContactFriction,
    clothLinearSpinCouplingPerSec: overrides.clothLinearSpinCouplingPerSec,
    spinDampingPerTick: overrides.spinDampingPerTick,
    linearDampingPerTick: overrides.linearDampingPerTick,
    cushionPostCollisionSpeedScale: overrides.cushionPostCollisionSpeedScale,
    cushionSpinMonotonicEnabled: true,
    cushionSpinMonotonicRetention: overrides.cushionSpinMonotonicRetention,
  });

  const cuePhysics = worldToPhysicsXY(cueStart.x, cueStart.z);
  const init = computeShotInitialization({
    dragPx: FIXED_DRAG_PX,
    impactOffsetX: FIXED_IMPACT_OFFSET_X,
    impactOffsetY: FIXED_IMPACT_OFFSET_Y,
  });
  const rad = (shotDirection * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = Math.cos(rad);
  const speed = init.initialBallSpeedMps * overrides.speedBoost;
  const balls: PhysicsBallState[] = [
    {
      id: 'cueBall',
      x: cuePhysics.x,
      y: cuePhysics.y,
      vx: dx * speed,
      vy: dy * speed,
      spinX: init.omegaX * dy,
      spinY: -init.omegaX * dx,
      spinZ: init.omegaZ,
      isPocketed: false,
    },
  ];

  const hits: HitRow[] = [];
  let last: CushionId | null = null;
  let duplicated = 0;
  for (let tick = 0; tick < maxTicks; tick += 1) {
    stepRoomPhysicsWorld(balls, base, {
      onCushionCollision: (ball, cushionId) => {
        if (ball.id !== 'cueBall') return;
        const normalizedCushion = normalizeFahCushionId(cushionId);
        if (last === normalizedCushion) duplicated += 1;
        else {
          last = normalizedCushion;
          duplicated = 0;
        }
        if (duplicated > 0) return;
        const world = physicsToWorldXZ(ball.x, ball.y);
        const index = mapFahCushionContactToIndex(normalizedCushion, { x: world.x, z: world.z }, TABLE_WIDTH, TABLE_HEIGHT);
        hits.push({
          order: hits.length + 1,
          cushion: normalizedCushion,
          x: round3(world.x),
          z: round3(world.z),
          index: round3(index),
          speed: round3(Math.hypot(ball.vx, ball.vy)),
          headingDeg: round3(headingDeg(ball.vx, ball.vy)),
          spinNorm: round3(Math.hypot(ball.spinX, ball.spinY, ball.spinZ)),
        });
      },
    });
    if (hits.length >= 4 && Math.hypot(balls[0].vx, balls[0].vy) < base.shotEndLinearSpeedThresholdMps) {
      break;
    }
  }

  const obs2 = hits[1]?.index ?? null;
  const obs3 = hits[2]?.index ?? null;
  const obs4 = hits[3]?.index ?? null;
  const spinMonotonic = hits.every((h, i) => i === 0 || h.spinNorm <= hits[i - 1].spinNorm + 0.001);

  return {
    first: anchor.first,
    expected: { second: anchor.second, third: anchor.third, fourth: anchor.fourth },
    observed: { second: obs2, third: obs3, fourth: obs4 },
    error: {
      second: round3((obs2 ?? anchor.second) - anchor.second),
      third: round3((obs3 ?? anchor.third) - anchor.third),
      fourth: round3((obs4 ?? anchor.fourth) - anchor.fourth),
    },
    shot: {
      cueStart,
      startIndex: round3(startIndex),
      firstSide: indexModel.firstCushionSide,
      shotDirectionDeg: round3(shotDirection),
      markerTarget: { x: round3(markerTarget.x), z: round3(markerTarget.z) },
      collisionTarget: { x: round3(collisionTarget.x), z: round3(collisionTarget.z) },
      compensatedAimTarget: { x: round3(aimTarget.x), z: round3(aimTarget.z) },
    },
    spinMonotonic,
    hits,
  };
}

async function run() {
  const runId = process.env.FAH_RUN_ID ?? `fah-diagnose-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const maxTicks = Math.max(1200, Number(process.env.FAH_MAX_TICKS ?? '2200'));
  const overrides = getDiagnosticOverrides();
  const anchorsInput = resolveAnchors();
  const mapping = checkRailMappingMonotonic();
  const anchors = anchorsInput.map((anchor) => runAnchor(anchor, maxTicks, overrides));
  const summary = {
    runId,
    maxTicks,
    overrides,
    mapping,
    anchors,
  };

  const outDir = resolve(process.cwd(), 'tmp', 'fah');
  mkdirSync(outDir, { recursive: true });
  const outputPath = resolve(outDir, `${runId}.diagnostic.json`);
  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ runId, outputPath }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
