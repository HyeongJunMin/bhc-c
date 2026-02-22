import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS,
  SHOT_END_LINEAR_SPEED_THRESHOLD_MPS,
  SHOT_END_STABLE_FRAME_COUNT,
  isBelowShotEndThreshold,
} from './shot-end.ts';

test('샷 종료 임계값 상수가 정의되어 있다', () => {
  assert.equal(SHOT_END_LINEAR_SPEED_THRESHOLD_MPS > 0, true);
  assert.equal(SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS > 0, true);
  assert.equal(SHOT_END_STABLE_FRAME_COUNT > 0, true);
});

test('선속도/각속도가 임계값 이하면 종료 후보로 판정한다', () => {
  const result = isBelowShotEndThreshold({
    linearSpeedMps: SHOT_END_LINEAR_SPEED_THRESHOLD_MPS,
    angularSpeedRadps: SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS,
  });

  assert.equal(result, true);
});

test('임계값을 초과하면 종료 후보가 아니다', () => {
  const result = isBelowShotEndThreshold({
    linearSpeedMps: SHOT_END_LINEAR_SPEED_THRESHOLD_MPS + 0.001,
    angularSpeedRadps: SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS,
  });

  assert.equal(result, false);
});
