import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS,
  SHOT_END_LINEAR_SPEED_THRESHOLD_MPS,
  SHOT_END_STABLE_FRAME_COUNT,
  evaluateShotEndWithFrames,
  initShotEndTracker,
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

test('연속 N프레임 안정 상태일 때만 샷 종료로 판정한다', () => {
  const tracker = initShotEndTracker();
  const stableSample = {
    linearSpeedMps: SHOT_END_LINEAR_SPEED_THRESHOLD_MPS,
    angularSpeedRadps: SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS,
  };

  for (let frame = 0; frame < SHOT_END_STABLE_FRAME_COUNT - 1; frame += 1) {
    const evaluation = evaluateShotEndWithFrames(tracker, stableSample);
    assert.equal(evaluation.isShotEnded, false);
  }

  const finalEvaluation = evaluateShotEndWithFrames(tracker, stableSample);
  assert.equal(finalEvaluation.isShotEnded, true);
});

test('중간에 불안정 프레임이 오면 연속 카운트가 초기화된다', () => {
  const tracker = initShotEndTracker();
  const stableSample = {
    linearSpeedMps: SHOT_END_LINEAR_SPEED_THRESHOLD_MPS,
    angularSpeedRadps: SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS,
  };
  const unstableSample = {
    linearSpeedMps: SHOT_END_LINEAR_SPEED_THRESHOLD_MPS + 1,
    angularSpeedRadps: SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS,
  };

  evaluateShotEndWithFrames(tracker, stableSample);
  evaluateShotEndWithFrames(tracker, unstableSample);

  assert.equal(tracker.stableFrameCount, 0);
});

test('조기 종료를 방지한다: N-1 프레임 안정 상태에서는 종료되지 않는다', () => {
  const tracker = initShotEndTracker();
  const stableSample = {
    linearSpeedMps: SHOT_END_LINEAR_SPEED_THRESHOLD_MPS,
    angularSpeedRadps: SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS,
  };

  for (let frame = 0; frame < SHOT_END_STABLE_FRAME_COUNT - 1; frame += 1) {
    const evaluation = evaluateShotEndWithFrames(tracker, stableSample);
    assert.equal(evaluation.isShotEnded, false);
  }
});

test('무한 턴을 방지한다: 충분한 안정 프레임 이후에는 반드시 종료된다', () => {
  const tracker = initShotEndTracker();
  const stableSample = {
    linearSpeedMps: SHOT_END_LINEAR_SPEED_THRESHOLD_MPS,
    angularSpeedRadps: SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS,
  };

  let ended = false;
  for (let frame = 0; frame < SHOT_END_STABLE_FRAME_COUNT + 10; frame += 1) {
    const evaluation = evaluateShotEndWithFrames(tracker, stableSample);
    if (evaluation.isShotEnded) {
      ended = true;
      break;
    }
  }

  assert.equal(ended, true);
});
