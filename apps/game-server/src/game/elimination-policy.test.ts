import test from 'node:test';
import assert from 'node:assert/strict';

import { handlePlayerLeave } from './elimination-policy.ts';

test('중도 이탈 플레이어는 즉시 패배 처리되고 경기에서 제외된다', () => {
  const result = handlePlayerLeave(['p1', 'p2', 'p3'], 'p2');

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.defeatedPlayerId, 'p2');
    assert.deepEqual(result.activePlayerIds, ['p1', 'p3']);
    assert.equal(result.gameEnded, false);
    assert.equal(result.winnerPlayerId, null);
  }
});

test('1명만 남으면 즉시 승리 종료된다', () => {
  const result = handlePlayerLeave(['p1', 'p2'], 'p2');

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.gameEnded, true);
    assert.equal(result.winnerPlayerId, 'p1');
    assert.deepEqual(result.activePlayerIds, ['p1']);
  }
});

test('게임에 없는 플레이어 이탈 요청은 GAME_PLAYER_NOT_FOUND를 반환한다', () => {
  const result = handlePlayerLeave(['p1', 'p2'], 'p3');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'GAME_PLAYER_NOT_FOUND');
  }
});
