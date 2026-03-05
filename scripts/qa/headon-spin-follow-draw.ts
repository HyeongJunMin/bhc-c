import assert from 'node:assert/strict';

import { computeShotInitialization } from '../../packages/physics-core/src/shot-init.ts';
import { createRoomPhysicsStepConfig } from '../../packages/physics-core/src/room-physics-config.ts';
import { stepRoomPhysicsWorld, type PhysicsBallState } from '../../packages/physics-core/src/room-physics-step.ts';

type CaseRow = {
  name: 'CENTER' | 'TOP' | 'BACK';
  impactOffsetY: number;
  forwardDispM: number;
  cueSpeedAtCollision: number;
  cueSpeedAtWindowEnd: number;
  collided: boolean;
};

const SHOT_DIRECTION_DEG = 180;
const SHOT_DRAG_PX = 400;
const CUE_X = 0.0;
const CUE_Z = 0.55;
const OBJ1_X = 0.0;
const OBJ1_Z = 0.0;
const OBJ2_X = 0.7110;
const OBJ2_Z = -0.45;
const WINDOW_TICKS_AFTER_COLLISION = 6;

function toPhysicsXY(config: ReturnType<typeof createRoomPhysicsStepConfig>, worldX: number, worldZ: number): { x: number; y: number } {
  return {
    x: worldX + config.tableWidthM * 0.5,
    y: worldZ + config.tableHeightM * 0.5,
  };
}

function buildBalls(config: ReturnType<typeof createRoomPhysicsStepConfig>): PhysicsBallState[] {
  const cue = toPhysicsXY(config, CUE_X, CUE_Z);
  const obj1 = toPhysicsXY(config, OBJ1_X, OBJ1_Z);
  const obj2 = toPhysicsXY(config, OBJ2_X, OBJ2_Z);
  return [
    { id: 'cueBall', x: cue.x, y: cue.y, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall1', x: obj1.x, y: obj1.y, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall2', x: obj2.x, y: obj2.y, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
  ];
}

function runCase(name: CaseRow['name'], impactOffsetY: number): CaseRow {
  const config = createRoomPhysicsStepConfig();
  const balls = buildBalls(config);
  const cue = balls[0];
  if (!cue) {
    throw new Error('cueBall missing');
  }
  const shotInit = computeShotInitialization({
    dragPx: SHOT_DRAG_PX,
    impactOffsetX: 0,
    impactOffsetY,
  });
  const directionRad = (SHOT_DIRECTION_DEG * Math.PI) / 180;
  const forwardX = Math.sin(directionRad);
  const forwardY = Math.cos(directionRad);
  cue.vx = forwardX * shotInit.initialBallSpeedMps;
  cue.vy = forwardY * shotInit.initialBallSpeedMps;
  cue.spinX = shotInit.omegaX * forwardY;
  cue.spinY = -shotInit.omegaX * forwardX;
  cue.spinZ = shotInit.omegaZ;

  let collided = false;
  let collidedWithObj1 = false;
  let collisionCueX = cue.x;
  let collisionCueY = cue.y;
  let cueSpeedAtCollision = 0;
  let postTicks = 0;
  let cueTouchedCushion = false;

  for (let tick = 0; tick < 600; tick += 1) {
    stepRoomPhysicsWorld(balls, config, {
      onBallCollision: (first, second) => {
        const isCueObj1 = (first.id === 'cueBall' && second.id === 'objectBall1')
          || (second.id === 'cueBall' && first.id === 'objectBall1');
        if (isCueObj1 && !collided) {
          collided = true;
          collidedWithObj1 = true;
          collisionCueX = cue.x;
          collisionCueY = cue.y;
          cueSpeedAtCollision = Math.hypot(cue.vx, cue.vy);
        }
      },
      onCushionCollision: (ball) => {
        if (collided && ball.id === 'cueBall') {
          cueTouchedCushion = true;
        }
      },
    });

    if (collided) {
      postTicks += 1;
      if (cueTouchedCushion || postTicks >= WINDOW_TICKS_AFTER_COLLISION) {
        break;
      }
    }
  }

  if (!collidedWithObj1) {
    return {
      name,
      impactOffsetY,
      forwardDispM: 0,
      cueSpeedAtCollision: 0,
      cueSpeedAtWindowEnd: 0,
      collided: false,
    };
  }

  const deltaX = cue.x - collisionCueX;
  const deltaY = cue.y - collisionCueY;
  const forwardDispM = (deltaX * forwardX) + (deltaY * forwardY);

  return {
    name,
    impactOffsetY,
    forwardDispM,
    cueSpeedAtCollision,
    cueSpeedAtWindowEnd: Math.hypot(cue.vx, cue.vy),
    collided: true,
  };
}

async function run(): Promise<void> {
  const center = runCase('CENTER', 0);
  const top = runCase('TOP', 0.018);
  const back = runCase('BACK', -0.018);

  const rows = [center, top, back];
  for (const row of rows) {
    assert.equal(row.collided, true, `${row.name}: cue-object1 collision must occur`);
  }

  assert.equal(top.forwardDispM > back.forwardDispM + 0.05, true, 'TOP should move forward more than BACK');
  assert.equal(Math.abs(top.forwardDispM - center.forwardDispM) > 0.02, true, 'TOP should differ from CENTER');
  assert.equal(Math.abs(back.forwardDispM - center.forwardDispM) > 0.02, true, 'BACK should differ from CENTER');

  console.log('CASE\timpactOffsetY\tforwardDispM\tcueSpeed@collision\tcueSpeed@windowEnd');
  for (const row of rows) {
    console.log(
      `${row.name}\t${row.impactOffsetY.toFixed(4)}\t${row.forwardDispM.toFixed(4)}\t${row.cueSpeedAtCollision.toFixed(3)}\t${row.cueSpeedAtWindowEnd.toFixed(3)}`,
    );
  }
  console.log('PHYS-HEADON-SPIN-QA pass: top/back split and center differentiation validated');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
