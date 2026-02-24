import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyCushionContactThrow } from './cushion-contact-throw.ts';

const CUE_BALL_RADIUS_M = 0.03075;

const base = {
  axis: 'x' as const,
  restitution: 0.82,
  contactFriction: 0.14,
  referenceNormalSpeedMps: 5.957692307692308,
  contactTimeExponent: 1.2,
  maxSpinMagnitude: 0.615,
  maxThrowAngleDeg: 55,
};

function dragPxToSpeedMps(dragPx: number): number {
  const minPx = 10;
  const maxPx = 400;
  const minSpeed = 1;
  const maxSpeed = 13.89;
  const clamped = Math.max(minPx, Math.min(maxPx, dragPx));
  const alpha = (clamped - minPx) / (maxPx - minPx);
  return minSpeed + (maxSpeed - minSpeed) * alpha;
}

function spinFromOffsetRatio(offsetRatioR: number): number {
  const offsetMeters = offsetRatioR * CUE_BALL_RADIUS_M;
  return offsetMeters * 20;
}

test('스핀이 없으면 직각 입사에서 반사각은 0도에 가깝다', () => {
  const result = applyCushionContactThrow({
    ...base,
    vx: -5,
    vy: 0,
    spinZ: 0,
  });

  assert.equal(result.vx > 0, true);
  assert.equal(Math.abs(result.vy) < 1e-9, true);
  assert.equal(result.throwTan, 0);
});

test('같은 스핀에서 속도가 낮을수록 반사각이 커진다', () => {
  const fast = applyCushionContactThrow({
    ...base,
    vx: -5.957692307692308,
    vy: 0,
    spinZ: 0.38745,
  });

  const slow = applyCushionContactThrow({
    ...base,
    vx: -3.3135897435897437,
    vy: 0,
    spinZ: 0.38745,
  });

  assert.equal(slow.throwAngleDeg > fast.throwAngleDeg, true);
});

test('스핀 방향에 따라 접선 반사 방향이 바뀐다', () => {
  const rightSpin = applyCushionContactThrow({
    ...base,
    vx: -5,
    vy: 0,
    spinZ: 0.3,
  });
  const leftSpin = applyCushionContactThrow({
    ...base,
    vx: -5,
    vy: 0,
    spinZ: -0.3,
  });

  assert.equal(Math.sign(rightSpin.vy), 1);
  assert.equal(Math.sign(leftSpin.vy), -1);
});

test('최대 반사각 상한을 넘지 않는다', () => {
  const result = applyCushionContactThrow({
    ...base,
    vx: -0.2,
    vy: 0,
    spinZ: 0.615,
  });

  assert.equal(result.throwAngleDeg <= base.maxThrowAngleDeg + 1e-9, true);
});

test('고정 회전(0.8R) + 직각 입사에서 스트로크 10%->100% 증가 시 반사각은 단조 감소한다', () => {
  const spinZ = spinFromOffsetRatio(0.8);
  const angles: number[] = [];

  for (let strokePct = 10; strokePct <= 100; strokePct += 10) {
    const dragPx = (strokePct / 100) * 400;
    const speed = dragPxToSpeedMps(dragPx);
    const result = applyCushionContactThrow({
      ...base,
      vx: -speed,
      vy: 0,
      spinZ,
    });
    angles.push(result.throwAngleDeg);
  }

  for (let index = 1; index < angles.length; index += 1) {
    assert.equal(angles[index - 1] > angles[index], true);
  }
});

test('고정 스트로크(40%) + 직각 입사에서 회전(0.1R->0.8R) 증가 시 반사각은 단조 증가한다', () => {
  const speed = dragPxToSpeedMps(0.4 * 400);
  const angles: number[] = [];

  for (let ratioPct = 10; ratioPct <= 80; ratioPct += 10) {
    const spinZ = spinFromOffsetRatio(ratioPct / 100);
    const result = applyCushionContactThrow({
      ...base,
      vx: -speed,
      vy: 0,
      spinZ,
    });
    angles.push(result.throwAngleDeg);
  }

  for (let index = 1; index < angles.length; index += 1) {
    assert.equal(angles[index - 1] < angles[index], true);
  }
});
