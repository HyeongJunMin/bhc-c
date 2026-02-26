import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAX_BALL_SPEED_MPS,
  MAX_IMPACT_OFFSET_M,
  MIN_BALL_SPEED_MPS,
  computeShotInitialization,
} from './shot-init.ts';

const FLOAT_EPSILON = 0.000001;

function assertAlmostEqual(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < FLOAT_EPSILON, `expected ${expected}, got ${actual}`);
}

test('최소 drag와 최소 offset 경계값에서 초기 속도/각속도를 계산한다', () => {
  const result = computeShotInitialization({
    dragPx: 10,
    impactOffsetX: -MAX_IMPACT_OFFSET_M,
    impactOffsetY: -MAX_IMPACT_OFFSET_M,
  });

  assertAlmostEqual(result.initialBallSpeedMps, MIN_BALL_SPEED_MPS);
  assert.ok(result.omegaX < 0);
  assert.ok(result.omegaZ < 0);
});

test('최대 drag와 최대 offset 경계값에서 초기 속도/각속도를 계산한다', () => {
  const result = computeShotInitialization({
    dragPx: 400,
    impactOffsetX: MAX_IMPACT_OFFSET_M,
    impactOffsetY: MAX_IMPACT_OFFSET_M,
  });

  assertAlmostEqual(result.initialBallSpeedMps, MAX_BALL_SPEED_MPS);
  assert.ok(result.omegaX > 0);
  assert.ok(result.omegaZ > 0);
});
