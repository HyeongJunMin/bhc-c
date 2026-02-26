import test from 'node:test';
import assert from 'node:assert/strict';

import { appendTurnEvent, finalizeTurnEventTracker, initTurnEventTracker, resetTurnEventHistory } from './turn-event-tracker.ts';

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

test('턴 종료 시 현재 이벤트 목록 스냅샷을 반환한다', () => {
  const tracker = initTurnEventTracker('turn-2');

  appendTurnEvent(tracker, {
    type: 'BALL_COLLISION',
    atMs: 11,
    sourceBallId: 'cue',
    targetBallId: 'ob1',
  });

  const snapshot = finalizeTurnEventTracker(tracker);

  assert.equal(snapshot.turnId, 'turn-2');
  assert.equal(snapshot.events.length, 1);
  assert.equal(snapshot.events[0]?.type, 'BALL_COLLISION');
});

test('턴 경계에서 snapshot 이후 신규 이벤트가 이전 snapshot을 오염시키지 않는다', () => {
  const tracker = initTurnEventTracker('turn-3');

  appendTurnEvent(tracker, {
    type: 'BALL_COLLISION',
    atMs: 10,
    sourceBallId: 'cue',
    targetBallId: 'ob1',
  });

  const firstSnapshot = finalizeTurnEventTracker(tracker);

  appendTurnEvent(tracker, {
    type: 'CUSHION_COLLISION',
    atMs: 20,
    sourceBallId: 'cue',
    cushionId: 'top',
  });

  const secondSnapshot = finalizeTurnEventTracker(tracker);

  assert.equal(firstSnapshot.events.length, 1);
  assert.equal(secondSnapshot.events.length, 2);
});

test('재경기 시 이전 턴 이벤트 이력을 초기화한다', () => {
  const tracker = initTurnEventTracker('turn-1');

  appendTurnEvent(tracker, {
    type: 'BALL_COLLISION',
    atMs: 10,
    sourceBallId: 'cue',
    targetBallId: 'ob1',
  });

  const resetTracker = resetTurnEventHistory(tracker, 'turn-rematch-1');

  assert.equal(resetTracker.turnId, 'turn-rematch-1');
  assert.deepEqual(resetTracker.events, []);
});
