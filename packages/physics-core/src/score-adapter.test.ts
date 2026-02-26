import test from 'node:test';
import assert from 'node:assert/strict';

import { adaptPhysicsEventsToScore } from './score-adapter.ts';

test('물리 이벤트 시퀀스를 3쿠션 득점 판정으로 매핑한다', () => {
  const result = adaptPhysicsEventsToScore({
    cueBallId: 'cue',
    objectBallIds: ['ob1', 'ob2'],
    events: [
      { type: 'BALL_COLLISION', atMs: 10, sourceBallId: 'cue', targetBallId: 'ob1' },
      { type: 'CUSHION_COLLISION', atMs: 20, sourceBallId: 'cue', cushionId: 'top' },
      { type: 'CUSHION_COLLISION', atMs: 30, sourceBallId: 'cue', cushionId: 'left' },
      { type: 'CUSHION_COLLISION', atMs: 40, sourceBallId: 'cue', cushionId: 'bottom' },
      { type: 'BALL_COLLISION', atMs: 50, sourceBallId: 'cue', targetBallId: 'ob2' },
      { type: 'SHOT_END', atMs: 60 },
    ],
  });

  assert.deepEqual(result, { scored: true });
});

test('득점 조건이 충족되지 않으면 scored=false를 반환한다', () => {
  const result = adaptPhysicsEventsToScore({
    cueBallId: 'cue',
    objectBallIds: ['ob1', 'ob2'],
    events: [
      { type: 'BALL_COLLISION', atMs: 10, sourceBallId: 'cue', targetBallId: 'ob1' },
      { type: 'BALL_COLLISION', atMs: 20, sourceBallId: 'cue', targetBallId: 'ob2' },
      { type: 'SHOT_END', atMs: 30 },
    ],
  });

  assert.deepEqual(result, { scored: false });
});
