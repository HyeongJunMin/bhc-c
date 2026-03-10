import test from 'node:test';
import assert from 'node:assert/strict';

import { solveBallBallImpulse, solveBallCushionImpulse } from './impulse-solver.ts';

test('head-on 동일 질량 탄성 충돌: 속도가 교환된다(e=1)', () => {
  const first = { vx: 2, vy: 0 };
  const second = { vx: 0, vy: 0 };

  const result = solveBallBallImpulse(first, second, {
    normalX: 1,
    normalY: 0,
    restitution: 1,
  });

  assert.equal(result.collided, true);
  assert.equal(Math.abs(first.vx - 0) < 1e-9, true);
  assert.equal(Math.abs(second.vx - 2) < 1e-9, true);
});

test('분리 중인 쌍은 impulse를 적용하지 않는다', () => {
  const first = { vx: -1, vy: 0 };
  const second = { vx: 1, vy: 0 };

  const result = solveBallBallImpulse(first, second, {
    normalX: 1,
    normalY: 0,
    restitution: 0.95,
  });

  assert.equal(result.collided, false);
  assert.equal(first.vx, -1);
  assert.equal(second.vx, 1);
});

test('비탄성 충돌(e<1): 충돌 후 상대 법선속도가 감소한다', () => {
  const first = { vx: 3, vy: 0 };
  const second = { vx: 0, vy: 0 };
  const e = 0.6;

  const beforeRelNormal = (second.vx - first.vx) * 1;
  const result = solveBallBallImpulse(first, second, {
    normalX: 1,
    normalY: 0,
    restitution: e,
  });
  const afterRelNormal = (second.vx - first.vx) * 1;

  assert.equal(result.collided, true);
  assert.equal(Math.abs(afterRelNormal + e * beforeRelNormal) < 1e-9, true);
});

test('저속 공-공 충돌은 입력 반발계수를 그대로 사용한다', () => {
  const first = { vx: 0.2, vy: 0 };
  const second = { vx: 0, vy: 0 };
  const e = 0.95;

  const beforeRelNormal = (second.vx - first.vx);
  const result = solveBallBallImpulse(first, second, {
    normalX: 1,
    normalY: 0,
    restitution: e,
  });
  const afterRelNormal = (second.vx - first.vx);
  const observedRestitution = Math.abs(afterRelNormal / beforeRelNormal);

  assert.equal(result.collided, true);
  assert.equal(Math.abs(observedRestitution - e) < 1e-9, true);
});

test('쿠션 충돌: 반발 후 법선 방향으로 이탈하고 속도가 유한하다', () => {
  const m = 0.21;
  const r = 0.03075;
  const I = (2 / 5) * m * r * r;

  const result = solveBallCushionImpulse({
    axis: 'x',
    vx: 3.2,
    vy: 0.4,
    spinX: 0,
    spinY: 0,
    spinZ: 50,
    restitution: 0.72,
    friction: 0.14,
    maxSpinMagnitude: 320,
    maxThrowAngleDeg: 55,
    ballMassKg: m,
    ballRadiusM: r,
    ballInertiaKgM2: I,
  });

  assert.equal(Number.isFinite(result.vx), true);
  assert.equal(Number.isFinite(result.vy), true);
  assert.equal(Number.isFinite(result.spinZ), true);
  // axis x, pre vx>0이면 right cushion 접촉으로 보고 반발 후 vx<0이어야 함
  assert.equal(result.vx < 0, true);
});

test('쿠션 비접근 상태(vn>=0)는 원속도 유지', () => {
  const m = 0.21;
  const r = 0.03075;
  const I = (2 / 5) * m * r * r;
  const input = {
    axis: 'y' as const,
    vx: 0.5,
    vy: 0,
    spinX: 12,
    spinY: -3,
    spinZ: 6,
    restitution: 0.72,
    friction: 0.14,
    maxSpinMagnitude: 320,
    maxThrowAngleDeg: 55,
    ballMassKg: m,
    ballRadiusM: r,
    ballInertiaKgM2: I,
  };
  const result = solveBallCushionImpulse(input);

  assert.equal(result.vx, input.vx);
  assert.equal(result.vy, input.vy);
  assert.equal(result.spinZ, input.spinZ);
});
