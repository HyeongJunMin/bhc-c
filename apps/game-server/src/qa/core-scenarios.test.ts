import test from 'node:test';
import assert from 'node:assert/strict';

import { login, signup } from '../auth/http.ts';
import { createRoom } from '../lobby/http.ts';
import { evaluateRoomJoin } from '../room/join-policy.ts';
import { startGameRequest } from '../game/start-policy.ts';
import { createTurnState, getCurrentTurnPlayerId, handleTurnTimeout } from '../game/turn-policy.ts';
import { createScoreBoard, increaseScoreAndCheckGameEnd } from '../game/score-policy.ts';
import { handlePlayerLeave } from '../game/elimination-policy.ts';
import { addMemberToRoster, createRoomRoster } from '../room/host-policy.ts';
import { executeKickCommand } from '../room/kick-policy.ts';
import { evaluateSpectatorJoin } from '../room/spectator-policy.ts';

test('QA-001A: 로그인 -> 로비 -> 방입장 핵심 시나리오', async () => {
  const authState = {
    nextUserId: 1,
    nextGuestId: 1,
    usersByUsername: new Map(),
  };
  const lobbyState = {
    nextRoomId: 1,
    rooms: [],
    roomStreamSeqByRoomId: {},
    roomStreamSubscribers: {},
    shotStateResetTimers: {},
    disconnectGraceTimers: {},
    userLastChatSentAtByRoomAndMember: {},
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

test('QA-001C: 타임아웃/중도이탈/강퇴 핵심 시나리오', () => {
  const turnState = createTurnState(['host', 'p2', 'p3']);

  const timeoutResult = handleTurnTimeout(turnState);
  assert.equal(timeoutResult.timedOut, true);
  assert.equal(timeoutResult.skippedPlayerId, 'host');
  assert.equal(timeoutResult.nextPlayerId, 'p2');

  const leaveResult = handlePlayerLeave(['p2', 'p3'], 'p3');
  assert.equal(leaveResult.ok, true);
  if (leaveResult.ok) {
    assert.equal(leaveResult.gameEnded, true);
    assert.equal(leaveResult.winnerPlayerId, 'p2');
  }

  const roster = createRoomRoster();
  addMemberToRoster(roster, 'host');
  addMemberToRoster(roster, 'p2');
  addMemberToRoster(roster, 'p3');

  const kickResult = executeKickCommand(roster, 'host', 'p2');
  assert.equal(kickResult.ok, true);
  if (kickResult.ok) {
    assert.ok(kickResult.events.some((event) => event.type === 'MEMBER_KICKED'));
    assert.ok(kickResult.events.some((event) => event.type === 'MEMBER_DISCONNECTED'));
  }
});

test('RULE-006C: 관전 시도는 서버에서 실패한다', () => {
  const result = evaluateSpectatorJoin('SPECTATOR');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'ROOM_SPECTATOR_NOT_ALLOWED');
  }
});
