import test from 'node:test';
import assert from 'node:assert/strict';

import { login, signup } from '../auth/http.ts';
import { createRoom } from '../lobby/http.ts';
import { evaluateRoomJoin } from '../room/join-policy.ts';
import { startGameRequest } from '../game/start-policy.ts';
import { createTurnState, getCurrentTurnPlayerId } from '../game/turn-policy.ts';
import { createScoreBoard, increaseScoreAndCheckGameEnd } from '../game/score-policy.ts';

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

test('QA-001B: 시작 -> 플레이 -> 10점 종료 핵심 시나리오', () => {
  const playerIds = ['host', 'p2'];

  const startResult = startGameRequest({
    roomState: 'WAITING',
    hostMemberId: 'host',
    actorMemberId: 'host',
    playerIds,
  });
  assert.equal(startResult.ok, true);

  const turnState = createTurnState(playerIds);
  assert.equal(getCurrentTurnPlayerId(turnState), 'host');

  const scoreBoard = createScoreBoard(playerIds);
  scoreBoard.host = 9;

  const scoreUpdateResult = increaseScoreAndCheckGameEnd(scoreBoard, 'host');
  assert.equal(scoreUpdateResult.ok, true);
  if (scoreUpdateResult.ok) {
    assert.equal(scoreUpdateResult.nextScore, 10);
    assert.equal(scoreUpdateResult.gameEnded, true);
    assert.equal(scoreUpdateResult.winnerPlayerId, 'host');
  }
});
