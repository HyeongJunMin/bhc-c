import assert from 'node:assert/strict';
import { test } from 'node:test';

import { applyCushionContactThrow } from './cushion-contact-throw.ts';

const CUE_BALL_RADIUS_M = 0.03075;
const CUSHION_HEIGHT_M = 0.037;

// h = vertical offset from ball center to contact point
const h = CUSHION_HEIGHT_M - CUE_BALL_RADIUS_M;
// d = horizontal distance from ball center to contact point on ball surface
const d = Math.sqrt(CUE_BALL_RADIUS_M * CUE_BALL_RADIUS_M - h * h);

const base = {
  axis: 'x' as const,
  restitution: 0.72,
  contactFriction: 0.14,
  referenceNormalSpeedMps: 5.957692307692308,
  contactTimeExponent: 1.2,
  maxSpinMagnitude: 3.0,
  maxThrowAngleDeg: 15,
  ballRadiusM: CUE_BALL_RADIUS_M,
  cushionHeightM: CUSHION_HEIGHT_M,
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

// Maps cue offset (fraction of ball radius) to spinY (english, rad/s).
// Calibrated so that spinY at offsetRatioR=1.0 produces effectiveSpin = maxSpinMagnitude (full throw).
// For axis='x' with vx<0 (normalDirection=-1): effectiveSpin = spinX*h + spinY*d
// (spinX=0 assumed) → spinY_max = maxSpinMagnitude / d
function spinYFromOffsetRatio(offsetRatioR: number): number {
  const maxSpinMagnitude = base.maxSpinMagnitude;
  return offsetRatioR * (maxSpinMagnitude / d);
}

test('스핀이 없으면 직각 입사에서 반사각은 0도에 가깝다', () => {
  const result = applyCushionContactThrow({
    ...base,
    vx: -5,
    vy: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
  });

  assert.equal(result.vx > 0, true);
  assert.equal(Math.abs(result.vy) < 1e-9, true);
  assert.equal(result.throwTan, 0);
});

test('같은 스핀에서 속도가 낮을수록 반사각이 커진다', () => {
  const spinY = spinYFromOffsetRatio(0.5);

  const fast = applyCushionContactThrow({
    ...base,
    vx: -5.957692307692308,
    vy: 0,
    spinY,
  });

  const slow = applyCushionContactThrow({
    ...base,
    vx: -3.3135897435897437,
    vy: 0,
    spinY,
  });

  assert.equal(slow.throwAngleDeg > fast.throwAngleDeg, true);
});

test('스핀 방향에 따라 접선 반사 방향이 바뀐다 (spinY english)', () => {
  // axis='x', vx=-5 → normalDirection=-1
  // effectiveSpin = spinX*h - (-1)*spinY*d = spinY*d (with spinX=0)
  // positive spinY → positive effectiveSpin → throw in +vy direction
  const rightSpin = applyCushionContactThrow({
    ...base,
    vx: -5,
    vy: 0,
    spinY: spinYFromOffsetRatio(0.5),
  });
  const leftSpin = applyCushionContactThrow({
    ...base,
    vx: -5,
    vy: 0,
    spinY: -spinYFromOffsetRatio(0.5),
  });

  assert.equal(Math.sign(rightSpin.vy), 1);
  assert.equal(Math.sign(leftSpin.vy), -1);
});

test('최대 반사각 상한을 넘지 않는다', () => {
  // Use very high spinY to saturate spinScale
  const result = applyCushionContactThrow({
    ...base,
    vx: -0.2,
    vy: 0,
    spinY: spinYFromOffsetRatio(2.0), // over-saturated
  });

  assert.equal(result.throwAngleDeg <= base.maxThrowAngleDeg + 1e-9, true);
});

test('고정 회전(0.8R english) + 직각 입사에서 스트로크 10%->100% 증가 시 반사각은 단조 감소한다', () => {
  const spinY = spinYFromOffsetRatio(0.8);
  const angles: number[] = [];

  for (let strokePct = 10; strokePct <= 100; strokePct += 10) {
    const dragPx = (strokePct / 100) * 400;
    const speed = dragPxToSpeedMps(dragPx);
    const result = applyCushionContactThrow({
      ...base,
      vx: -speed,
      vy: 0,
      spinY,
    });
    angles.push(result.throwAngleDeg);
  }

  for (let index = 1; index < angles.length; index += 1) {
    assert.equal(angles[index - 1] >= angles[index], true);
  }
});

test('고정 스트로크(40%) + 직각 입사에서 english(0.1R->0.8R) 증가 시 반사각은 단조 증가한다', () => {
  const speed = dragPxToSpeedMps(0.4 * 400);
  const angles: number[] = [];

  for (let ratioPct = 10; ratioPct <= 80; ratioPct += 10) {
    const spinY = spinYFromOffsetRatio(ratioPct / 100);
    const result = applyCushionContactThrow({
      ...base,
      vx: -speed,
      vy: 0,
      spinY,
    });
    angles.push(result.throwAngleDeg);
  }

  // Non-strictly increasing: more spin should not decrease throw (may plateau at maxThrowAngleDeg).
  for (let index = 1; index < angles.length; index += 1) {
    assert.equal(angles[index - 1] <= angles[index], true);
  }
  // Verify throw is actually occurring at some point.
  assert.equal(angles[angles.length - 1] > 0, true);
});

test('자연 구름 공은 throw가 거의 없다 (spin 없이 rolling 상태)', () => {
  // vx = -2 m/s rolling → spinZ = vx/R = 65 rad/s, spinY=0
  // effectiveSpin = spinX*h - normalDir*spinY*d = 0 (spinY=0, spinX=0 for pure rolling in x)
  const vx = -2;
  const spinZ = Math.abs(vx) / CUE_BALL_RADIUS_M; // 자연 구름
  const result = applyCushionContactThrow({
    ...base,
    vx,
    vy: 0,
    spinX: 0,
    spinY: 0,
    spinZ,
  });

  assert.equal(result.throwAngleDeg < 1.0, true, `자연 구름 throw ${result.throwAngleDeg}° should be < 1°`);
});

test('z축 쿠션에서 spinY english가 throw를 발생시킨다', () => {
  // axis='y' (world z-cushion), vy positive → normalDirection=+1
  // effectiveSpin = normalDir*spinY*d - spinZ*h = spinY*d (spinZ=0)
  const spinY = spinYFromOffsetRatio(0.5);
  const result = applyCushionContactThrow({
    ...base,
    axis: 'y',
    vx: 0,
    vy: -3,
    spinX: 0,
    spinY,
    spinZ: 0,
  });

  assert.equal(result.throwAngleDeg > 0, true);
  assert.equal(result.throwAngleDeg <= base.maxThrowAngleDeg + 1e-9, true);
});
