import test from 'node:test';
import assert from 'node:assert/strict';

import { advanceTurn, createTurnState, getCurrentTurnPlayerId } from './turn-policy.ts';

test('입장 순서대로 턴 큐를 초기화한다', () => {
  const turnState = createTurnState(['p1', 'p2', 'p3']);

  assert.deepEqual(turnState.queue, ['p1', 'p2', 'p3']);
  assert.equal(turnState.currentIndex, 0);
  assert.equal(getCurrentTurnPlayerId(turnState), 'p1');
});

test('빈 큐에서는 현재 턴 플레이어가 null이다', () => {
  const turnState = createTurnState([]);

  assert.equal(getCurrentTurnPlayerId(turnState), null);
});

test('턴 전환 시 큐를 순환한다', () => {
  const turnState = createTurnState(['p1', 'p2']);

  advanceTurn(turnState);
  assert.equal(getCurrentTurnPlayerId(turnState), 'p2');

  advanceTurn(turnState);
  assert.equal(getCurrentTurnPlayerId(turnState), 'p1');
});
