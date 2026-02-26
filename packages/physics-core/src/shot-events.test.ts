import test from 'node:test';
import assert from 'node:assert/strict';

import { mapShotEventFromMiscue } from './shot-events.ts';

test('미스큐면 SHOT_MISCUE 이벤트로 매핑한다', () => {
  const result = mapShotEventFromMiscue(true);

  assert.deepEqual(result, {
    type: 'SHOT_MISCUE',
    applyCueImpulse: false,
    endTurnImmediately: true,
  });
});

test('미스큐가 아니면 SHOT_VALID 이벤트로 매핑한다', () => {
  const result = mapShotEventFromMiscue(false);

  assert.deepEqual(result, {
    type: 'SHOT_VALID',
    applyCueImpulse: true,
    endTurnImmediately: false,
  });
});
