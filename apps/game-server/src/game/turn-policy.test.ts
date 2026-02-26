import test from 'node:test';
import assert from 'node:assert/strict';

import { advanceTurn, createTurnState, evaluateShotInputGate, getCurrentTurnPlayerId, handleTurnTimeout } from './turn-policy.ts';

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

test('timeout 발생 시 현재 플레이어를 스킵하고 다음 턴으로 이동한다', () => {
  const turnState = createTurnState(['p1', 'p2', 'p3']);

  const result = handleTurnTimeout(turnState);

  assert.equal(result.timedOut, true);
  assert.equal(result.skippedPlayerId, 'p1');
  assert.equal(result.nextPlayerId, 'p2');
  assert.equal(getCurrentTurnPlayerId(turnState), 'p2');
});

test('빈 큐에서 timeout 처리 시 no-op 결과를 반환한다', () => {
  const turnState = createTurnState([]);

  const result = handleTurnTimeout(turnState);

  assert.equal(result.timedOut, false);
  assert.equal(result.skippedPlayerId, null);
  assert.equal(result.nextPlayerId, null);
});

test('턴 만료 직전 현재 턴 플레이어의 샷 입력은 허용한다', () => {
  const turnState = createTurnState(['p1', 'p2']);

  const result = evaluateShotInputGate(turnState, 'p1', false);
  assert.deepEqual(result, { ok: true });
});

test('턴 만료 직후 샷 입력은 GAME_TURN_EXPIRED로 거부한다', () => {
  const turnState = createTurnState(['p1', 'p2']);

  const result = evaluateShotInputGate(turnState, 'p1', true);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'GAME_TURN_EXPIRED');
  }
});
