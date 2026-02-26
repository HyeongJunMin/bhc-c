import test from 'node:test';
import assert from 'node:assert/strict';

import { evaluateSpectatorJoin, mapSpectatorJoinErrorToMessage } from './spectator-policy.ts';

test('관전자 join 요청은 ROOM_SPECTATOR_NOT_ALLOWED로 차단한다', () => {
  const result = evaluateSpectatorJoin('SPECTATOR');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'ROOM_SPECTATOR_NOT_ALLOWED');
  }
});

test('플레이어 join 요청은 허용한다', () => {
  const result = evaluateSpectatorJoin('PLAYER');

  assert.deepEqual(result, { ok: true });
});

test('관전자 차단 에러 코드를 사용자 문구로 매핑한다', () => {
  const message = mapSpectatorJoinErrorToMessage('ROOM_SPECTATOR_NOT_ALLOWED');

  assert.equal(message.includes('관전 모드'), true);
});
