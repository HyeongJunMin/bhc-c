import test from 'node:test';
import assert from 'node:assert/strict';

import { appendTurnEvent, initTurnEventTracker } from './turn-event-tracker.ts';

test('턴 시작 시 이벤트 추적기를 빈 상태로 초기화한다', () => {
  const tracker = initTurnEventTracker('turn-1');

  assert.equal(tracker.turnId, 'turn-1');
  assert.deepEqual(tracker.events, []);
});

test('BALL/CUSHION 이벤트를 순서대로 append 한다', () => {
  const tracker = initTurnEventTracker('turn-1');

  appendTurnEvent(tracker, {
    type: 'BALL_COLLISION',
    atMs: 10,
    sourceBallId: 'cue',
    targetBallId: 'ob1',
  });
  appendTurnEvent(tracker, {
    type: 'CUSHION_COLLISION',
    atMs: 20,
    sourceBallId: 'cue',
    cushionId: 'top',
  });

  assert.equal(tracker.events.length, 2);
  assert.equal(tracker.events[0]?.type, 'BALL_COLLISION');
  assert.equal(tracker.events[1]?.type, 'CUSHION_COLLISION');
});
