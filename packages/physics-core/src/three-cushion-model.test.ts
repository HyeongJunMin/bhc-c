import test from 'node:test';
import assert from 'node:assert/strict';

import { hasBothObjectBallContacts, isTurnCollisionEventList } from './three-cushion-model.ts';

test('유효한 충돌 이벤트 리스트를 입력 모델로 인정한다', () => {
  const events = [
    {
      type: 'BALL_COLLISION',
      atMs: 10,
      sourceBallId: 'cue',
      targetBallId: 'ob1',
    },
    {
      type: 'CUSHION_COLLISION',
      atMs: 20,
      sourceBallId: 'cue',
      cushionId: 'top',
    },
  ];

  assert.equal(isTurnCollisionEventList(events), true);
});

test('필수 필드가 누락된 이벤트는 입력 모델에서 거부한다', () => {
  const invalidEvents = [
    {
      type: 'BALL_COLLISION',
      atMs: 10,
      sourceBallId: 'cue',
    },
  ];

  assert.equal(isTurnCollisionEventList(invalidEvents), false);
});

test('큐볼이 두 목적구를 모두 접촉하면 true를 반환한다', () => {
  const result = hasBothObjectBallContacts({
    cueBallId: 'cue',
    objectBallIds: ['ob1', 'ob2'],
    events: [
      { type: 'BALL_COLLISION', atMs: 10, sourceBallId: 'cue', targetBallId: 'ob1' },
      { type: 'CUSHION_COLLISION', atMs: 20, sourceBallId: 'cue', cushionId: 'top' },
      { type: 'BALL_COLLISION', atMs: 30, sourceBallId: 'cue', targetBallId: 'ob2' },
    ],
  });

  assert.equal(result, true);
});

test('목적구 중 하나라도 접촉하지 못하면 false를 반환한다', () => {
  const result = hasBothObjectBallContacts({
    cueBallId: 'cue',
    objectBallIds: ['ob1', 'ob2'],
    events: [{ type: 'BALL_COLLISION', atMs: 10, sourceBallId: 'cue', targetBallId: 'ob1' }],
  });

  assert.equal(result, false);
});
