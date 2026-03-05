import assert from 'node:assert/strict';

import { computeShotInitialization } from '../../packages/physics-core/src/shot-init.ts';
import { createRoomPhysicsStepConfig } from '../../packages/physics-core/src/room-physics-config.ts';
import { stepRoomPhysicsWorld, type PhysicsBallState } from '../../packages/physics-core/src/room-physics-step.ts';

type ScenarioResult = {
  collidedWithObj1: boolean;
  reverseDetectedBeforeHit: boolean;
  cushionHitBeforeReverse: boolean;
  cueXAtReverse: number;
  minForwardAlongMps: number;
  minForwardAlongTick: number;
};

function runScenario(): ScenarioResult {
  const cfg = createRoomPhysicsStepConfig();
  const balls: PhysicsBallState[] = [
    // cue
    { id: 'cueBall', x: 0.55, y: cfg.tableHeightM * 0.5, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    // object1: far in front (hard to reach on weak draw)
    { id: 'objectBall1', x: cfg.tableWidthM - 0.32, y: cfg.tableHeightM * 0.5, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
  ];

  const cue = balls[0];
  if (!cue) {
    throw new Error('cueBall missing');
  }

  const shot = computeShotInitialization({
    dragPx: 110,
    impactOffsetX: 0,
    impactOffsetY: -0.018,
  });

  // +x direction shot
  const dirX = 1;
  const dirY = 0;
  cue.vx = dirX * shot.initialBallSpeedMps;
  cue.vy = dirY * shot.initialBallSpeedMps;
  cue.spinX = shot.omegaX * dirY;
  cue.spinY = -shot.omegaX * dirX;
  cue.spinZ = shot.omegaZ;

  let collidedWithObj1 = false;
  let reverseDetectedBeforeHit = false;
  let cueXAtReverse = Number.NaN;
  let cushionHitBeforeReverse = false;
  let cueCushionHits = 0;
  let minForwardAlongMps = Number.POSITIVE_INFINITY;
  let minForwardAlongTick = -1;

  for (let tick = 0; tick < 900; tick += 1) {
    stepRoomPhysicsWorld(balls, cfg, {
      onBallCollision: (first, second) => {
        const isCueObj1 = (first.id === 'cueBall' && second.id === 'objectBall1')
          || (second.id === 'cueBall' && first.id === 'objectBall1');
        if (isCueObj1) {
          collidedWithObj1 = true;
        }
      },
      onCushionCollision: (ball) => {
        if (ball.id === 'cueBall') {
          cueCushionHits += 1;
        }
      },
    });

    const forwardAlong = (cue.vx * dirX) + (cue.vy * dirY);
    if (forwardAlong < minForwardAlongMps) {
      minForwardAlongMps = forwardAlong;
      minForwardAlongTick = tick;
    }
    const speed = Math.hypot(cue.vx, cue.vy);
    if (!collidedWithObj1 && forwardAlong < -0.03 && speed > 0.18) {
      reverseDetectedBeforeHit = true;
      cueXAtReverse = cue.x;
      cushionHitBeforeReverse = cueCushionHits > 0;
      break;
    }
    if (speed < cfg.shotEndLinearSpeedThresholdMps) {
      break;
    }
  }

  return {
    collidedWithObj1,
    reverseDetectedBeforeHit,
    cushionHitBeforeReverse,
    cueXAtReverse,
    minForwardAlongMps,
    minForwardAlongTick,
  };
}

async function main(): Promise<void> {
  const result = runScenario();
  console.log('CASE\tcollidedObj1\treverseBeforeHit\tcushionBeforeReverse\tcueXAtReverse\tminForwardAlongMps\tminForwardTick');
  console.log(
    `BACKSPIN_FAR_NO_CONTACT\t${result.collidedWithObj1}\t${result.reverseDetectedBeforeHit}\t${result.cushionHitBeforeReverse}\t${Number.isFinite(result.cueXAtReverse) ? result.cueXAtReverse.toFixed(4) : 'NaN'}\t${result.minForwardAlongMps.toFixed(4)}\t${result.minForwardAlongTick}`,
  );

  assert.equal(result.collidedWithObj1, false, 'Scenario must remain no-contact to validate guard');
  assert.equal(result.reverseDetectedBeforeHit, false, 'Cue ball should not reverse strongly before first object-ball hit');
  console.log('PHYS-BACKSPIN-NO-CONTACT-GUARD pass: no premature reversal before object-ball contact');
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
