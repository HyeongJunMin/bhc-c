import { computeShotInitialization } from '../../packages/physics-core/src/shot-init.ts';
import { createRoomPhysicsStepConfig } from '../../packages/physics-core/src/room-physics-config.ts';
import { stepRoomPhysicsWorld, type PhysicsBallState } from '../../packages/physics-core/src/room-physics-step.ts';

type CaseName = 'TOP' | 'BACK';

type CaseResult = {
  name: CaseName;
  cushionCaptured: boolean;
  preSpeed: number;
  postSpeed: number;
  ratio: number;
};

const SHOT_DIRECTION_DEG = 180;
const SHOT_DRAG_PX = 400;
const CUE_X = 0.0;
const CUE_Z = 0.55;
const OBJ1_X = 0.0;
const OBJ1_Z = 0.0;
const OBJ2_X = 0.7110;
const OBJ2_Z = -0.45;

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

function runCase(name: CaseName, impactOffsetY: number): CaseResult {
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

  let collidedWithObj1 = false;
  let speedBeforeTick = Math.hypot(cue.vx, cue.vy);
  let preSpeed = 0;
  let postSpeed = 0;
  let cushionCaptured = false;

  for (let tick = 0; tick < 800; tick += 1) {
    speedBeforeTick = Math.hypot(cue.vx, cue.vy);
    stepRoomPhysicsWorld(balls, config, {
      onBallCollision: (first, second) => {
        const isCueObj1 = (first.id === 'cueBall' && second.id === 'objectBall1')
          || (second.id === 'cueBall' && first.id === 'objectBall1');
        if (isCueObj1) {
          collidedWithObj1 = true;
        }
      },
      onCushionCollision: (ball) => {
        if (!collidedWithObj1 || cushionCaptured || ball.id !== 'cueBall') {
          return;
        }
        preSpeed = speedBeforeTick;
        postSpeed = Math.hypot(ball.vx, ball.vy);
        cushionCaptured = true;
      },
    });

    if (cushionCaptured) {
      break;
    }
  }

  const ratio = preSpeed > 1e-9 ? postSpeed / preSpeed : 0;
  return {
    name,
    cushionCaptured,
    preSpeed,
    postSpeed,
    ratio,
  };
}

async function run(): Promise<void> {
  const top = runCase('TOP', 0.018);
  const back = runCase('BACK', -0.018);
  const rows = [top, back];

  console.log('CASE\tcaptured\tpreSpeed\tpostSpeed\tratio(post/pre)');
  for (const row of rows) {
    console.log(
      `${row.name}\t${row.cushionCaptured}\t${row.preSpeed.toFixed(4)}\t${row.postSpeed.toFixed(4)}\t${row.ratio.toFixed(4)}`,
    );
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
