import { createRoomPhysicsStepConfig } from './room-physics-config.ts';
import { stepRoomPhysicsWorld, type PhysicsBallState, type StepRoomPhysicsConfig } from './room-physics-step.ts';
import { computeShotInitialization } from './shot-init.ts';
import { initShotEndTracker, evaluateShotEndWithFrames } from './shot-end.ts';

const MAX_FRAMES = 3000;

export type SimBallInit = { id: string; x: number; y: number };

export type SimShotParams = {
  cueBallId: string;
  directionDeg: number;
  dragPx: number;
  impactOffsetX: number;
  impactOffsetY: number;
};

export type SimFrameBall = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  speed: number;
};

export type SimFrame = {
  frameIndex: number;
  timeSec: number;
  balls: SimFrameBall[];
};

export type SimEvent = {
  type: 'CUSHION' | 'BALL_BALL';
  frameIndex: number;
  timeSec: number;
  ballId: string;
  targetId: string;
};

export type SimResult = {
  frames: SimFrame[];
  events: SimEvent[];
  totalTimeSec: number;
  totalFrames: number;
};

export function runSimulation(
  ballInits: SimBallInit[],
  shotParams: SimShotParams,
  configOverrides?: Partial<StepRoomPhysicsConfig>,
): SimResult {
  const config: StepRoomPhysicsConfig = { ...createRoomPhysicsStepConfig(), ...configOverrides };

  const balls: PhysicsBallState[] = ballInits.map((b) => ({
    id: b.id,
    x: b.x,
    y: b.y,
    vx: 0,
    vy: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    isPocketed: false,
  }));

  // GameScene: impactOffsetX is negated before passing to physics
  const impactOffsetXForPhysics = -shotParams.impactOffsetX;

  const shotInit = computeShotInitialization({
    dragPx: shotParams.dragPx,
    impactOffsetX: impactOffsetXForPhysics,
    impactOffsetY: shotParams.impactOffsetY,
  });

  const directionRad = (shotParams.directionDeg * Math.PI) / 180;
  const finalDirectionRad = directionRad - shotInit.squirtAngleRad;

  const cueBall = balls.find((b) => b.id === shotParams.cueBallId);
  if (!cueBall) {
    throw new Error(`Cue ball not found: ${shotParams.cueBallId}`);
  }

  cueBall.vx = Math.sin(finalDirectionRad) * shotInit.initialBallSpeedMps;
  cueBall.vy = Math.cos(finalDirectionRad) * shotInit.initialBallSpeedMps;
  cueBall.spinX = shotInit.omegaX;
  cueBall.spinY = shotInit.omegaY;
  cueBall.spinZ = shotInit.omegaZ;

  const frames: SimFrame[] = [];
  const events: SimEvent[] = [];
  const tracker = initShotEndTracker();

  const captureFrame = (frameIndex: number): void => {
    frames.push({
      frameIndex,
      timeSec: frameIndex * config.dtSec,
      balls: balls.map((b) => ({
        id: b.id,
        x: b.x,
        y: b.y,
        vx: b.vx,
        vy: b.vy,
        spinX: b.spinX,
        spinY: b.spinY,
        spinZ: b.spinZ,
        speed: Math.hypot(b.vx, b.vy),
      })),
    });
  };

  captureFrame(0);

  let frameIndex = 0;
  while (frameIndex < MAX_FRAMES) {
    frameIndex += 1;
    const timeSec = frameIndex * config.dtSec;

    stepRoomPhysicsWorld(balls, config, {
      onCushionCollision: (ball, cushionId) => {
        events.push({ type: 'CUSHION', frameIndex, timeSec, ballId: ball.id, targetId: cushionId });
      },
      onBallCollision: (first, second) => {
        events.push({ type: 'BALL_BALL', frameIndex, timeSec, ballId: first.id, targetId: second.id });
      },
    });

    captureFrame(frameIndex);

    let maxLinearSpeed = 0;
    for (const ball of balls) {
      if (!ball.isPocketed) {
        maxLinearSpeed = Math.max(maxLinearSpeed, Math.hypot(ball.vx, ball.vy));
      }
    }

    const { isShotEnded } = evaluateShotEndWithFrames(tracker, {
      linearSpeedMps: maxLinearSpeed,
    });

    if (isShotEnded) {
      break;
    }
  }

  return {
    frames,
    events,
    totalTimeSec: frameIndex * config.dtSec,
    totalFrames: frameIndex,
  };
}
