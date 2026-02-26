import test from 'node:test';
import assert from 'node:assert/strict';

import { isPhysicsEvent } from './physics-events.ts';

test('유효한 물리 이벤트를 도메인 타입으로 인정한다', () => {
  const valid = [
    { type: 'BALL_COLLISION', atMs: 10, sourceBallId: 'cue', targetBallId: 'ob1' },
    { type: 'CUSHION_COLLISION', atMs: 20, sourceBallId: 'cue', cushionId: 'top' },
    { type: 'SHOT_END', atMs: 30 },
  ];

  assert.equal(valid.every((event) => isPhysicsEvent(event)), true);
});

test('필수 필드 누락/알 수 없는 type은 거부한다', () => {
  assert.equal(isPhysicsEvent({ type: 'BALL_COLLISION', atMs: 10, sourceBallId: 'cue' }), false);
  assert.equal(isPhysicsEvent({ type: 'UNKNOWN', atMs: 10 }), false);
});
