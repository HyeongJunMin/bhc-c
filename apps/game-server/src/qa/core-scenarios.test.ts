import test from 'node:test';
import assert from 'node:assert/strict';

import { login, signup } from '../auth/http.ts';
import { createRoom } from '../lobby/http.ts';
import { evaluateRoomJoin } from '../room/join-policy.ts';

test('QA-001A: 로그인 -> 로비 -> 방입장 핵심 시나리오', async () => {
  const authState = {
    nextUserId: 1,
    nextGuestId: 1,
    usersByUsername: new Map(),
  };
  const lobbyState = {
    nextRoomId: 1,
    rooms: [],
  };

  const signupResult = await signup(authState, {
    username: 'player1',
    password: 'password123',
  });
  assert.equal(signupResult.ok, true);

  const loginResult = await login(authState, {
    username: 'player1',
    password: 'password123',
  });
  assert.equal(loginResult.ok, true);
  if (loginResult.ok) {
    assert.ok(loginResult.accessToken.length > 10);
  }

  const createRoomResult = createRoom(lobbyState, { title: '연습방' });
  assert.equal(createRoomResult.ok, true);
  if (createRoomResult.ok) {
    assert.equal(createRoomResult.room.state, 'WAITING');
  }

  const joinDecision = evaluateRoomJoin({
    currentPlayerCount: 0,
    roomState: 'WAITING',
  });
  assert.deepEqual(joinDecision, { ok: true });
});
