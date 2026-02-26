import test from 'node:test';
import assert from 'node:assert/strict';

import {
  computeInitialBallSpeed,
  solveCueSpeedForTargetBallSpeed,
} from './initial-velocity.ts';

const FLOAT_EPSILON = 0.000001;

function assertAlmostEqual(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < FLOAT_EPSILON, `expected ${expected}, got ${actual}`);
}

test('초기 선속도는 명세 식 V0 = (m_c*(1+e_tip)/(m_c+m_b))*v_c 를 따른다', () => {
  const ballSpeed = computeInitialBallSpeed(10);

  assertAlmostEqual(ballSpeed, (0.5 * (1 + 0.7) / (0.5 + 0.21)) * 10);
});

test('목표 공 속도에서 큐 속도를 역산하면 다시 동일한 초기 공 속도를 얻는다', () => {
  const targetBallSpeed = 13.89;
  const cueSpeed = solveCueSpeedForTargetBallSpeed(targetBallSpeed);
  const computedBallSpeed = computeInitialBallSpeed(cueSpeed);

  assertAlmostEqual(computedBallSpeed, targetBallSpeed);
});
