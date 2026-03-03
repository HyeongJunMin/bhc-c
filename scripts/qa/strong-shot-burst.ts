import { createRoomPhysicsStepConfig } from '../../packages/physics-core/src/room-physics-config.ts';
import { stepRoomPhysicsWorld, type PhysicsBallState } from '../../packages/physics-core/src/room-physics-step.ts';
import { applyCushionContactThrow } from '../../apps/game-server/src/game/cushion-contact-throw.ts';

const cfg = createRoomPhysicsStepConfig();

function createBalls(): PhysicsBallState[] {
  return [
    { id: 'cueBall', x: 0.7, y: 0.71, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall1', x: 2.1, y: 0.62, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall2', x: 2.24, y: 0.8, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
  ];
}

function isSettled(balls: PhysicsBallState[]): boolean {
  return balls.every((ball) => ball.isPocketed || Math.hypot(ball.vx, ball.vy) < cfg.shotEndLinearSpeedThresholdMps);
}

function runBurstScenario(): { shots: number; maxPeakSpeed: number; maxTicksToSettle: number } {
  const balls = createBalls();
  let maxPeakSpeed = 0;
  let maxTicksToSettle = 0;
  const shotCount = 5;

  for (let i = 0; i < shotCount; i += 1) {
    const angle = ((i * 67) % 360) * (Math.PI / 180);
    const cue = balls[0];
    cue.vx = Math.cos(angle) * 13.89;
    cue.vy = Math.sin(angle) * 13.89;
    cue.spinZ = (i % 2 === 0 ? 1 : -1) * 0.55;

    let ticks = 0;
    let localPeak = 0;
    while (ticks < 700 && !isSettled(balls)) {
      const stats = stepRoomPhysicsWorld(balls, cfg, { applyCushionContactThrow });
      localPeak = Math.max(localPeak, stats.maxObservedSpeedMps);
      ticks += 1;
    }

    maxPeakSpeed = Math.max(maxPeakSpeed, localPeak);
    maxTicksToSettle = Math.max(maxTicksToSettle, ticks);
  }

  return {
    shots: shotCount,
    maxPeakSpeed,
    maxTicksToSettle,
  };
}

const result = runBurstScenario();
if (result.maxPeakSpeed > cfg.maxBallSpeedMps + 1e-9) {
  throw new Error(`maxPeakSpeed overflow: ${result.maxPeakSpeed} > ${cfg.maxBallSpeedMps}`);
}
if (result.maxTicksToSettle >= 700) {
  throw new Error(`settle timeout: maxTicksToSettle=${result.maxTicksToSettle}`);
}

console.log(`QA-PLAY-001A pass: shots=${result.shots}, maxPeakSpeed=${result.maxPeakSpeed.toFixed(6)}, maxTicksToSettle=${result.maxTicksToSettle}`);

