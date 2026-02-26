import test from 'node:test';
import assert from 'node:assert/strict';

import { assertStateTransition } from './state-transition.ts';

test('허용된 상태 전이는 예외 없이 통과한다', () => {
  assert.doesNotThrow(() => assertStateTransition('WAITING', 'IN_GAME'));
  assert.doesNotThrow(() => assertStateTransition('IN_GAME', 'FINISHED'));
  assert.doesNotThrow(() => assertStateTransition('IN_GAME', 'WAITING'));
});

test('허용되지 않은 상태 전이는 예외를 던진다', () => {
  assert.throws(() => assertStateTransition('WAITING', 'FINISHED'));
  assert.throws(() => assertStateTransition('FINISHED', 'IN_GAME'));
});
