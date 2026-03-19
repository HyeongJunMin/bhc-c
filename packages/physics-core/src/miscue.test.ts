import test from 'node:test';
import assert from 'node:assert/strict';

import { CUE_BALL_RADIUS_M, MISCUE_SAFE_RATIO, MISCUE_CERTAIN_RATIO, isMiscue } from './miscue.ts';

test('안전 영역(ratio <= MISCUE_SAFE_RATIO)은 항상 미스큐가 아니다', () => {
  // ratio = 0.0 (center)
  assert.equal(isMiscue(0, 0), false);

  // ratio = MISCUE_SAFE_RATIO (경계 포함)
  const safeOffset = MISCUE_SAFE_RATIO * CUE_BALL_RADIUS_M;
  assert.equal(isMiscue(safeOffset, 0), false);
  assert.equal(isMiscue(0, safeOffset), false);
});

test('확정 미스큐 영역(ratio >= MISCUE_CERTAIN_RATIO)은 항상 미스큐다', () => {
  // ratio = MISCUE_CERTAIN_RATIO (경계 포함)
  const certainOffset = MISCUE_CERTAIN_RATIO * CUE_BALL_RADIUS_M;
  assert.equal(isMiscue(certainOffset, 0), true);

  // ratio > MISCUE_CERTAIN_RATIO
  const beyondOffset = 0.95 * CUE_BALL_RADIUS_M;
  assert.equal(isMiscue(beyondOffset, 0), true);
});

test('확률 구간(0.5R < ratio < 0.85R)에서 1000회 반복 시 일부는 true, 일부는 false다', () => {
  // ratio = 0.675 (중간값), t = 0.5, 기대 확률 = 0.25
  const midRatio = (MISCUE_SAFE_RATIO + MISCUE_CERTAIN_RATIO) / 2;
  const midOffset = midRatio * CUE_BALL_RADIUS_M;

  let trueCount = 0;
  const trials = 1000;
  for (let i = 0; i < trials; i++) {
    if (isMiscue(midOffset, 0)) trueCount++;
  }

  // 기대 확률 t^2 = 0.5^2 = 0.25 → 5σ 범위: [25% ± ~7%]
  assert.ok(trueCount > 50, `미스큐 발생이 너무 적음: ${trueCount}/1000`);
  assert.ok(trueCount < 500, `미스큐 발생이 너무 많음: ${trueCount}/1000`);
});

test('확률 구간 ratio=0.6R 에서 낮은 확률, ratio=0.8R 에서 높은 확률이 나온다', () => {
  const lowRatio = 0.6; // t = (0.6-0.5)/0.35 ≈ 0.286, t^2 ≈ 0.082
  const highRatio = 0.8; // t = (0.8-0.5)/0.35 ≈ 0.857, t^2 ≈ 0.735

  const lowOffset = lowRatio * CUE_BALL_RADIUS_M;
  const highOffset = highRatio * CUE_BALL_RADIUS_M;

  let lowCount = 0;
  let highCount = 0;
  const trials = 2000;

  for (let i = 0; i < trials; i++) {
    if (isMiscue(lowOffset, 0)) lowCount++;
    if (isMiscue(highOffset, 0)) highCount++;
  }

  // 낮은 ratio는 낮은 확률, 높은 ratio는 높은 확률이어야 한다
  assert.ok(lowCount < highCount, `낮은 ratio(${lowCount})가 높은 ratio(${highCount})보다 많으면 안 됨`);
});
