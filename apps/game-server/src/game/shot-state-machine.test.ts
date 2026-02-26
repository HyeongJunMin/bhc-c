import test from 'node:test';
import assert from 'node:assert/strict';

import { transitionShotLifecycleState } from './shot-state-machine.ts';

test('idle 상태에서 SHOT_SUBMITTED 이벤트는 running으로 전이된다', () => {
  const next = transitionShotLifecycleState('idle', 'SHOT_SUBMITTED');
  assert.equal(next, 'running');
});

test('running 상태에서 SHOT_RESOLVED 이벤트는 resolved로 전이된다', () => {
  const next = transitionShotLifecycleState('running', 'SHOT_RESOLVED');
  assert.equal(next, 'resolved');
});

test('resolved 상태에서 TURN_CHANGED 이벤트는 idle로 전이된다', () => {
  const next = transitionShotLifecycleState('resolved', 'TURN_CHANGED');
  assert.equal(next, 'idle');
});

test('허용되지 않은 전이는 null을 반환한다', () => {
  assert.equal(transitionShotLifecycleState('idle', 'TURN_CHANGED'), null);
  assert.equal(transitionShotLifecycleState('running', 'SHOT_SUBMITTED'), null);
  assert.equal(transitionShotLifecycleState('resolved', 'SHOT_SUBMITTED'), null);
});

