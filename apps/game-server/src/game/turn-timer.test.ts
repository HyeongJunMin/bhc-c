import test from 'node:test';
import assert from 'node:assert/strict';

import { TURN_TIMEOUT_MS, startTurnTimer, type CancelTimeout, type ScheduleTimeout } from './turn-timer.ts';

test('타이머 시작 시 기본 10초로 스케줄링한다', () => {
  const scheduled: { delayMs: number }[] = [];

  const scheduleTimeout: ScheduleTimeout = (_callback, delayMs) => {
    scheduled.push({ delayMs });
    return 'timer-1';
  };

  const timer = startTurnTimer(() => {}, undefined, scheduleTimeout);

  assert.equal(timer.timeoutMs, TURN_TIMEOUT_MS);
  assert.equal(timer.timerId, 'timer-1');
  assert.equal(scheduled.length, 1);
  assert.equal(scheduled[0]?.delayMs, TURN_TIMEOUT_MS);
});

test('cancel 호출 시 예약 타이머를 해제한다', () => {
  const canceled: unknown[] = [];

  const scheduleTimeout: ScheduleTimeout = (_callback, _delayMs) => 'timer-2';
  const cancelTimeout: CancelTimeout = (timerId) => {
    canceled.push(timerId);
  };

  const timer = startTurnTimer(() => {}, 5_000, scheduleTimeout, cancelTimeout);

  timer.cancel();
  timer.cancel();

  assert.deepEqual(canceled, ['timer-2']);
  assert.equal(timer.timerId, null);
});

test('cancel 이후에는 timeout 콜백이 실행되지 않는다', () => {
  let timeoutCallback: (() => void) | null = null;
  let fired = false;

  const scheduleTimeout: ScheduleTimeout = (callback, _delayMs) => {
    timeoutCallback = callback;
    return 'timer-3';
  };

  const timer = startTurnTimer(
    () => {
      fired = true;
    },
    10_000,
    scheduleTimeout,
  );

  timer.cancel();
  timeoutCallback?.();

  assert.equal(fired, false);
});
