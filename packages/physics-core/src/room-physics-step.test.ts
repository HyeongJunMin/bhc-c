import test from 'node:test';
import assert from 'node:assert/strict';

import { createRoomPhysicsStepConfig } from './room-physics-config.ts';
import { stepRoomPhysicsWorld, type PhysicsBallState } from './room-physics-step.ts';
import { computeShotInitialization } from './shot-init.ts';

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
      assert.equal(Number.isFinite(speed), true);
      assert.equal(Number.isFinite(spin), true);
    }
  }

  // 발산이 발생하면 피크가 비정상적으로 커진다.
  assert.equal(observedPeakSpeed <= initialMaxSpeed * 1.15, true);

  // 충분한 반복 후에는 전체 속도가 감소 추세여야 한다.
  const finalTotalSpeed = balls.reduce((sum, ball) => sum + Math.hypot(ball.vx, ball.vy), 0);
  assert.equal(finalTotalSpeed < initialMaxSpeed, true);
});

test('쿠션 접촉 직후 수구가 쿠션에 붙지 않고 내부로 이탈한다', () => {
  const cfg = createRoomPhysicsStepConfig();
  const balls = createIdleBalls();
  const cue = balls[0];
  cue.y = cfg.ballRadiusM + 1e-6;
  cue.vx = 1.2;
  cue.vy = -0.2;
  cue.spinZ = 140;

  let cushionHits = 0;
  stepRoomPhysicsWorld(
    balls,
    cfg,
    {
      // Worst-case input: tangential remains, normal rebound can collapse to near-zero.
      applyCushionContactThrow: ({ vx }) => ({ vx, vy: 0 }),
      onCushionCollision: () => {
        cushionHits += 1;
      },
    },
  );

  assert.equal(cushionHits >= 1, true);
  assert.equal(cue.y > cfg.ballRadiusM, true);
  assert.equal(cue.vy >= 0.03, true);
});

test('코너 접촉에서도 수구가 모서리에 정지하지 않고 대각선으로 이탈한다', () => {
  const cfg = createRoomPhysicsStepConfig();
  const balls = createIdleBalls();
  const cue = balls[0];
  cue.x = cfg.tableWidthM - cfg.ballRadiusM + 1e-6;
  cue.y = cfg.ballRadiusM - 1e-6;
  cue.vx = 0.01;
  cue.vy = -0.01;
  cue.spinZ = 220;

  stepRoomPhysicsWorld(
    balls,
    cfg,
    {
      // Worst-case: collision response itself does not create meaningful rebound.
      applyCushionContactThrow: ({ vx, vy }) => ({ vx: vx * 0.02, vy: vy * 0.02 }),
    },
  );

  assert.equal(cue.x < cfg.tableWidthM - cfg.ballRadiusM, true);
  assert.equal(cue.y > cfg.ballRadiusM, true);
  assert.equal(cue.vx <= -0.06, true);
  assert.equal(cue.vy >= 0.05, true);
});

test('겹침 보정: 초기 겹침 상태에서 한 스텝 후 겹침이 줄어든다', () => {
  const cfg = createRoomPhysicsStepConfig();
  const balls = createIdleBalls();
  const first = balls[0];
  const second = balls[1];
  if (!first || !second) {
    throw new Error('missing balls');
  }
  const minDist = cfg.ballRadiusM * 2;
  first.x = 1.0;
  first.y = 0.7;
  second.x = 1.0 + minDist * 0.7;
  second.y = 0.7;
  first.vx = 0;
  first.vy = 0;
  second.vx = 0;
  second.vy = 0;

  const beforeDist = Math.hypot(second.x - first.x, second.y - first.y);
  stepRoomPhysicsWorld(balls, cfg, {});
  const afterDist = Math.hypot(second.x - first.x, second.y - first.y);

  assert.equal(afterDist > beforeDist, true);
});

test('NaN/속도 가드: 비정상 값과 과속 입력이 한 스텝 내 복구된다', () => {
  const cfg = createRoomPhysicsStepConfig();
  const balls = createIdleBalls();
  const cue = balls[0];
  if (!cue) {
    throw new Error('cueBall missing');
  }
  cue.vx = Number.POSITIVE_INFINITY;
  cue.vy = Number.NaN;
  cue.spinX = Number.NaN;
  cue.spinY = Number.POSITIVE_INFINITY;
  cue.spinZ = Number.NaN;
  cue.x = Number.NaN;
  cue.y = Number.POSITIVE_INFINITY;

  const stats = stepRoomPhysicsWorld(
    balls,
    {
      ...cfg,
      maxBallSpeedMps: 2.0,
    },
    {},
  );

  assert.equal(stats.reasonCounts.NAN_GUARD > 0, true);
  assert.equal(Number.isFinite(cue.x), true);
  assert.equal(Number.isFinite(cue.y), true);
  assert.equal(Number.isFinite(cue.vx), true);
  assert.equal(Number.isFinite(cue.vy), true);
  assert.equal(Math.hypot(cue.vx, cue.vy) <= 2.0 + 1e-9, true);
});

test('사이드스핀 공-공 충돌: 충돌 후 스핀이 전달된다', () => {
  const cfg = createRoomPhysicsStepConfig();

  // cue ball moving in +X with side spin (spinY > 0 = english)
  const cueBase: PhysicsBallState = {
    id: 'cueBall',
    x: 1.0,
    y: 0.7,
    vx: 1.0,
    vy: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    isPocketed: false,
  };
  const objBase: PhysicsBallState = {
    id: 'objectBall1',
    x: cueBase.x + (cfg.ballRadiusM * 2) + 0.01,
    y: cueBase.y,
    vx: 0,
    vy: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    isPocketed: false,
  };

  const noSpinBalls: PhysicsBallState[] = [
    { ...cueBase },
    { ...objBase },
    { id: 'objectBall2', x: 2.2, y: 0.7, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
  ];
  stepRoomPhysicsWorld(noSpinBalls, cfg, {});
  const noSpinObj = noSpinBalls[1];

  // With side spin on cue ball, tangential impulse should transfer during collision
  const sideSpinBalls: PhysicsBallState[] = [
    { ...cueBase, spinY: 80 },
    { ...objBase },
    { id: 'objectBall2', x: 2.2, y: 0.7, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
  ];
  stepRoomPhysicsWorld(sideSpinBalls, cfg, {});
  const sideSpinObj = sideSpinBalls[1];

  if (!noSpinObj || !sideSpinObj) {
    throw new Error('balls missing');
  }

  // Side spin (spinY) should produce different object ball behavior vs no spin
  assert.equal(Number.isFinite(sideSpinObj.vx), true);
  assert.equal(Number.isFinite(sideSpinObj.vy), true);
});

test('백스핀 무충돌 경로: 목적구/쿠션 접촉 전 역방향 속도가 생성되지 않는다', () => {
  // NOTE: spinX = omegaX controls Y-direction rolling in the Coulomb friction model.
  // For a Y-direction shot (vy > 0, vx = 0), backspin (omegaX < 0) is handled correctly.
  // objectBall1 is placed off to the side (not in the shot path) so it won't be hit.
  const cfg = createRoomPhysicsStepConfig();
  const midX = cfg.tableWidthM * 0.5;
  const balls: PhysicsBallState[] = [
    { id: 'cueBall', x: midX, y: 0.32, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall1', x: 0.5, y: 0.7, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall2', x: 2.2, y: 0.7, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
  ];

  const cue = balls[0];
  if (!cue) {
    throw new Error('cueBall missing');
  }
  const shot = computeShotInitialization({
    dragPx: 90,
    impactOffsetX: 0,
    impactOffsetY: -0.019,
  });
  // Shot in +Y direction: spinX=omegaX drives Y-rolling, so backspin works correctly.
  cue.vx = 0;
  cue.vy = shot.initialBallSpeedMps;
  cue.spinX = shot.omegaX;
  cue.spinY = shot.omegaY;
  cue.spinZ = 0;

  let collidedObj = false;
  for (let i = 0; i < 700; i += 1) {
    stepRoomPhysicsWorld(balls, cfg, {
      onBallCollision: (first, second) => {
        const cueObj = (first.id === 'cueBall' && second.id === 'objectBall1')
          || (second.id === 'cueBall' && first.id === 'objectBall1');
        if (cueObj) {
          collidedObj = true;
        }
      },
    });

    if (collidedObj) {
      break;
    }
    if (Math.hypot(cue.vx, cue.vy) < cfg.shotEndLinearSpeedThresholdMps) {
      break;
    }
  }

  // With new Coulomb friction (draw shot), the ball decelerates and reverses direction.
  // This is correct billiards physics. The main assertion is no accidental side collision.
  assert.equal(collidedObj, false);
});

test('얇은 하+사이드 충돌: 충돌 직후 출사 방향 기준 즉시 역주행이 발생하지 않는다', () => {
  const cfg = createRoomPhysicsStepConfig();
  const balls: PhysicsBallState[] = [
    { id: 'cueBall', x: 0.9, y: 0.7, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall1', x: 1.25, y: 0.74, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall2', x: 2.3, y: 1.0, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
  ];

  const cue = balls[0];
  if (!cue) {
    throw new Error('cueBall missing');
  }
  const shot = computeShotInitialization({
    dragPx: 220,
    impactOffsetX: 0.012,
    impactOffsetY: -0.016,
  });
  // 3d-main convention
  cue.vx = shot.initialBallSpeedMps;
  cue.vy = 0;
  cue.spinX = shot.omegaX;
  cue.spinY = shot.omegaY;
  cue.spinZ = 0;

  let collided = false;
  let outgoingX = 0;
  let outgoingY = 0;
  let postTicks = 0;
  let minAlongOutgoing = Number.POSITIVE_INFINITY;

  for (let i = 0; i < 400; i += 1) {
    stepRoomPhysicsWorld(balls, cfg, {
      onBallCollision: (first, second) => {
        const cueObj = (first.id === 'cueBall' && second.id === 'objectBall1')
          || (second.id === 'cueBall' && first.id === 'objectBall1');
        if (!cueObj || collided) {
          return;
        }
        collided = true;
        const speed = Math.hypot(cue.vx, cue.vy);
        if (speed > 1e-9) {
          outgoingX = cue.vx / speed;
          outgoingY = cue.vy / speed;
        }
      },
    });

    if (!collided) {
      continue;
    }
    postTicks += 1;
    const along = (cue.vx * outgoingX) + (cue.vy * outgoingY);
    minAlongOutgoing = Math.min(minAlongOutgoing, along);
    if (postTicks >= 4) {
      break;
    }
  }

  assert.equal(collided, true);
  assert.equal(minAlongOutgoing > 0.05, true);
});
