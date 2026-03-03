import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoomPhysicsStepConfig } from './room-physics-config.ts';
import { stepRoomPhysicsWorld, type PhysicsBallState } from './room-physics-step.ts';

function createIdleBalls(): PhysicsBallState[] {
  return [
    { id: 'cueBall', x: 1.2, y: 0.7, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall1', x: 1.7, y: 0.7, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall2', x: 2.2, y: 0.7, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
  ];
}

test('에너지 캡: 서브스텝 에너지 증가 허용치를 넘으면 속도를 자동 제한한다', () => {
  const cfg = createRoomPhysicsStepConfig();
  const balls = createIdleBalls();
  const cue = balls[0];
  cue.x = cfg.tableWidthM - cfg.ballRadiusM - 0.001;
  cue.vx = 8;
  cue.vy = 2;
  cue.spinZ = 1;

  const stats = stepRoomPhysicsWorld(
    balls,
    {
      ...cfg,
      linearDampingPerTick: 1,
      spinDampingPerTick: 1,
      maxSubstepEnergyGainJ: 0,
    },
    {
      applyCushionContactThrow: ({ vx, vy }) => ({ vx: -vx * 1.5, vy: vy * 1.5 }),
    },
  );

  assert.equal(stats.maxPositiveEnergyDeltaJ >= 0, true);
  assert.equal(stats.kineticEnergyEndJ <= stats.kineticEnergyStartJ + 1e-9, true);
});

test('반복 쿠션 충돌에서도 속도 발산 없이 수렴한다', () => {
  const cfg = createRoomPhysicsStepConfig();
  const balls = createIdleBalls();
  const cue = balls[0];
  cue.vx = 12;
  cue.vy = 3;
  cue.spinZ = 0.2;
  const initialSpeed = Math.hypot(cue.vx, cue.vy);

  let peakSpeed = initialSpeed;
  for (let i = 0; i < 300; i += 1) {
    stepRoomPhysicsWorld(balls, cfg, {
      applyCushionContactThrow: ({ vx, vy, restitution }) => ({
        vx: -vx * restitution,
        vy: vy * (1 - 0.14),
      }),
    });
    const speed = Math.hypot(cue.vx, cue.vy);
    peakSpeed = Math.max(peakSpeed, speed);
  }

  assert.equal(peakSpeed <= initialSpeed * 1.02, true);
  assert.equal(Math.hypot(cue.vx, cue.vy) < initialSpeed, true);
});

test('다중 공 연속 충돌 + 쿠션 반복에서도 속도/회전이 유한하고 발산하지 않는다', () => {
  const cfg = createRoomPhysicsStepConfig();
  const balls = createIdleBalls();
  const cue = balls[0];
  const ob1 = balls[1];
  const ob2 = balls[2];

  cue.x = cfg.tableWidthM * 0.3;
  cue.y = cfg.tableHeightM * 0.25;
  cue.vx = 10.5;
  cue.vy = 2.7;
  cue.spinX = 0.6;
  cue.spinY = 0.1;
  cue.spinZ = 0.4;

  ob1.x = cfg.tableWidthM * 0.55;
  ob1.y = cfg.tableHeightM * 0.32;
  ob1.vx = -2.2;
  ob1.vy = 0.8;
  ob1.spinX = 0.15;
  ob1.spinY = 0.05;
  ob1.spinZ = -0.2;

  ob2.x = cfg.tableWidthM * 0.68;
  ob2.y = cfg.tableHeightM * 0.58;
  ob2.vx = -1.4;
  ob2.vy = -1.1;
  ob2.spinX = -0.1;
  ob2.spinY = 0.02;
  ob2.spinZ = 0.15;

  const initialMaxSpeed = Math.max(...balls.map((b) => Math.hypot(b.vx, b.vy)));
  let observedPeakSpeed = initialMaxSpeed;
  let observedPeakSpin = Math.max(...balls.map((b) => Math.hypot(b.spinX, b.spinY, b.spinZ)));

  for (let i = 0; i < 500; i += 1) {
    stepRoomPhysicsWorld(balls, cfg, {
      applyCushionContactThrow: ({ vx, vy, restitution }) => ({
        vx: -vx * restitution,
        vy: vy * (1 - 0.14),
      }),
    });

    for (const ball of balls) {
      const speed = Math.hypot(ball.vx, ball.vy);
      const spin = Math.hypot(ball.spinX, ball.spinY, ball.spinZ);
      observedPeakSpeed = Math.max(observedPeakSpeed, speed);
      observedPeakSpin = Math.max(observedPeakSpin, spin);
      assert.equal(Number.isFinite(speed), true);
      assert.equal(Number.isFinite(spin), true);
    }
  }

  // 발산이 발생하면 피크가 비정상적으로 커진다.
  assert.equal(observedPeakSpeed <= initialMaxSpeed * 1.15, true);
  assert.equal(observedPeakSpin <= 1.0, true);

  // 충분한 반복 후에는 전체 속도가 감소 추세여야 한다.
  const finalTotalSpeed = balls.reduce((sum, ball) => sum + Math.hypot(ball.vx, ball.vy), 0);
  assert.equal(finalTotalSpeed < initialMaxSpeed, true);
});
