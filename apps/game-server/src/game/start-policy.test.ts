import test from 'node:test';
import assert from 'node:assert/strict';

import { startGameRequest } from './start-policy.ts';

test('비방장은 시작 요청 시 ROOM_HOST_ONLY를 반환한다', () => {
  const result = startGameRequest({
    roomState: 'WAITING',
    hostMemberId: 'host',
    actorMemberId: 'u2',
    playerIds: ['host', 'u2'],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'ROOM_HOST_ONLY');
  }
});

test('이미 진행중인 방은 GAME_ALREADY_STARTED를 반환한다', () => {
  const result = startGameRequest({
    roomState: 'IN_GAME',
    hostMemberId: 'host',
    actorMemberId: 'host',
    playerIds: ['host', 'u2'],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'GAME_ALREADY_STARTED');
  }
});

test('플레이어가 2명 미만이면 GAME_NOT_ENOUGH_PLAYERS를 반환한다', () => {
  const result = startGameRequest({
    roomState: 'WAITING',
    hostMemberId: 'host',
    actorMemberId: 'host',
    playerIds: ['host'],
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'GAME_NOT_ENOUGH_PLAYERS');
  }
});

test('시작 버튼 연타 시 첫 요청만 성공하고 이후 요청은 GAME_ALREADY_STARTED를 반환한다', () => {
  const first = startGameRequest({
    roomState: 'WAITING',
    hostMemberId: 'host',
    actorMemberId: 'host',
    playerIds: ['host', 'u2'],
  });
  assert.equal(first.ok, true);

  const second = startGameRequest({
    roomState: 'IN_GAME',
    hostMemberId: 'host',
    actorMemberId: 'host',
    playerIds: ['host', 'u2'],
  });
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.equal(second.errorCode, 'GAME_ALREADY_STARTED');
  }
});
