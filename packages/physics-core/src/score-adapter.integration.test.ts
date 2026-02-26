import test from 'node:test';
import assert from 'node:assert/strict';

import { adaptPhysicsEventsToScore } from './score-adapter.ts';
import { resolveTurnAfterShot } from './turn-resolution.ts';

test('통합: mock 물리 이벤트 득점 시 턴 유지로 해석된다', () => {
  const scoreResult = adaptPhysicsEventsToScore({
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

  const turnResolution = resolveTurnAfterShot(scoreResult.scored);

  assert.equal(scoreResult.scored, true);
  assert.equal(turnResolution.shouldSwitchTurn, false);
});

test('통합: mock 물리 이벤트 비득점 시 턴 전환으로 해석된다', () => {
  const scoreResult = adaptPhysicsEventsToScore({
    cueBallId: 'cue',
    objectBallIds: ['ob1', 'ob2'],
    events: [
      { type: 'BALL_COLLISION', atMs: 10, sourceBallId: 'cue', targetBallId: 'ob1' },
      { type: 'BALL_COLLISION', atMs: 20, sourceBallId: 'cue', targetBallId: 'ob2' },
      { type: 'SHOT_END', atMs: 30 },
    ],
  });

  const turnResolution = resolveTurnAfterShot(scoreResult.scored);

  assert.equal(scoreResult.scored, false);
  assert.equal(turnResolution.shouldSwitchTurn, true);
});
