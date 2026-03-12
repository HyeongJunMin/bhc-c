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
import { getFahGuidelineTable } from '../../apps/web/src/lib/fah-guideline.ts';

const TABLE_WIDTH = 2.844;
const TABLE_HEIGHT = 1.422;
const BALL_RADIUS = 0.03075;

const FIXED_CUE_WORLD_X = -TABLE_WIDTH / 2 + 0.36;
const FIXED_CUE_WORLD_Z = -0.471637;
const FIXED_DRAG_PX = 127;
const FIXED_IMPACT_OFFSET_X = -BALL_RADIUS * 0.4;
const FIXED_IMPACT_OFFSET_Y = BALL_RADIUS * 0.4;
const FAH_FIRST_RAIL_AIM_SIDE_LEAD = 0.12;

type HitRow = {
  order: number;
  cushion: CushionId;
  index: number;
};

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
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
  const targetX = sideXSign * (TABLE_WIDTH / 2 - BALL_RADIUS + FAH_FIRST_RAIL_AIM_SIDE_LEAD);
  return { x: targetX, z: targetZ };
}

function computeFahCompensatedAimTarget(
  cueX: number,
  cueZ: number,
  firstSide: 'left' | 'right',
  requestedFirstCushionIndex: number,
): { x: number; z: number } {
  const marker = (() => {
    const targetRatio = mapFahIndexToRailRatio(quantizeFahIndexToNearestHalfStep(requestedFirstCushionIndex));
    const topRailZ = TABLE_HEIGHT / 2;
    const bottomRailZ = -TABLE_HEIGHT / 2;
    const targetZ = topRailZ - targetRatio * (topRailZ - bottomRailZ);
    const sideXSign = firstSide === 'right' ? 1 : -1;
    const targetX = sideXSign * (TABLE_WIDTH / 2 + 0.058 / 2);
    return { x: targetX, z: targetZ };
  })();

  const collision = computeFahFirstRailTarget(firstSide, requestedFirstCushionIndex);
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

function simulateAnchor(first: number): { second: number | null; third: number | null; fourth: number | null } {
  const cueStart = { x: FIXED_CUE_WORLD_X, z: FIXED_CUE_WORLD_Z };
  const startIndex = computeFahStartIndexFromCue(cueStart.x);
  const startSide = inferFahStartSide(cueStart.x);
  const indexModel = buildFahIndexModel(startIndex, first, startSide);
  const aimTarget = computeFahCompensatedAimTarget(
    cueStart.x,
    cueStart.z,
    indexModel.firstCushionSide,
    indexModel.firstCushionIndex,
  );
  const shotDirection = directionDegFromCueToTarget(cueStart.x, cueStart.z, aimTarget.x, aimTarget.z);

  const physicsCfg = createRoomPhysicsStepConfig('fahTest');
  const cuePhysics = worldToPhysicsXY(cueStart.x, cueStart.z);
  const init = computeShotInitialization({
    dragPx: FIXED_DRAG_PX,
    impactOffsetX: FIXED_IMPACT_OFFSET_X,
    impactOffsetY: FIXED_IMPACT_OFFSET_Y,
  });
  const rad = (shotDirection * Math.PI) / 180;
  const dx = Math.sin(rad);
  const dy = Math.cos(rad);
  const speed = init.initialBallSpeedMps * 2.0;
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
  for (let tick = 0; tick < 2400; tick += 1) {
    stepRoomPhysicsWorld(balls, physicsCfg, {
      onCushionCollision: (ball, cushionId) => {
        if (ball.id !== 'cueBall') return;
        if (last === cushionId) duplicated += 1;
        else {
          last = cushionId;
          duplicated = 0;
        }
        if (duplicated > 0) return;
        const world = physicsToWorldXZ(ball.x, ball.y);
        const index = mapFahCushionContactToIndex(cushionId, { x: world.x, z: world.z }, TABLE_WIDTH, TABLE_HEIGHT);
        hits.push({
          order: hits.length + 1,
          cushion: cushionId,
          index: round3(index),
        });
      },
    });
    if (hits.length >= 4 && Math.hypot(balls[0].vx, balls[0].vy) < physicsCfg.shotEndLinearSpeedThresholdMps) {
      break;
    }
  }

  return {
    second: hits[1]?.index ?? null,
    third: hits[2]?.index ?? null,
    fourth: hits[3]?.index ?? null,
  };
}

async function run(): Promise<void> {
  const runId = `fah-guideline-verify-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const table = getFahGuidelineTable();
  const rows = table.map((anchor) => {
    const observed = simulateAnchor(anchor.first);
    const secondDelta = observed.second === null ? null : round3(observed.second - anchor.second);
    const thirdDelta = observed.third === null ? null : round3(observed.third - anchor.third);
    const fourthDelta = observed.fourth === null ? null : round3(observed.fourth - anchor.fourth);
    const passSecond = secondDelta !== null && Math.abs(secondDelta) <= anchor.tolerance.second;
    const passThird = thirdDelta !== null && Math.abs(thirdDelta) <= anchor.tolerance.third;
    const passFourth = fourthDelta !== null && Math.abs(fourthDelta) <= anchor.tolerance.fourth;
    return {
      first: anchor.first,
      expected: { second: anchor.second, third: anchor.third, fourth: anchor.fourth },
      observed,
      delta: { second: secondDelta, third: thirdDelta, fourth: fourthDelta },
      pass: {
        second: passSecond,
        third: passThird,
        fourth: passFourth,
        all: passSecond && passThird && passFourth,
      },
    };
  });

  const passCount = rows.filter((row) => row.pass.all).length;
  const summary = {
    runId,
    passCount,
    total: rows.length,
    rows,
  };

  const outDir = resolve(process.cwd(), 'tmp', 'fah');
  mkdirSync(outDir, { recursive: true });
  const outputPath = resolve(outDir, `${runId}.json`);
  writeFileSync(outputPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify({ runId, outputPath, passCount, total: rows.length }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
