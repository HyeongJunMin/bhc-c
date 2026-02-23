import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyDisconnectForfeit,
  createLobbyHttpServer,
  createRoom,
  getRoomDetail,
  joinRoom,
  kickRoomMember,
  leaveRoomMember,
  listRooms,
  openRoomSnapshotStream,
  rematchRoomGame,
  sendRoomChatMessage,
  submitRoomShot,
  startRoomGame,
} from './http.ts';

test('방 생성 성공: 유효 제목이면 생성된다', () => {
  const { state } = createLobbyHttpServer();
  const result = createRoom(state, { title: 'room-1' });

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.room.roomId, 'room-1');
    assert.equal(result.room.title, 'room-1');
  }
});

test('방 생성 실패: 제목이 비어있으면 거부된다', () => {
  const { state } = createLobbyHttpServer();
  const result = createRoom(state, { title: '   ' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'ROOM_TITLE_REQUIRED');
  }
});

test('방 생성 실패: 제목이 15자를 초과하면 거부된다', () => {
  const { state } = createLobbyHttpServer();
  const result = createRoom(state, { title: '1234567890123456' });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'ROOM_TITLE_TOO_LONG');
  }
});

test('방 목록 조회: WAITING 우선, 인원 적은 순, 최신 생성 순으로 정렬된다', () => {
  const { state } = createLobbyHttpServer();
  createRoom(state, { title: 'first' });
  createRoom(state, { title: 'second' });
  createRoom(state, { title: 'third' });

  state.rooms[0].state = 'IN_GAME';
  state.rooms[1].playerCount = 3;
  state.rooms[2].playerCount = 1;

  const page = listRooms(state, { offset: 0, limit: 10 });
  assert.equal(page.items.length, 3);
  assert.equal(page.items[0].title, 'third');
  assert.equal(page.items[1].title, 'second');
  assert.equal(page.items[2].title, 'first');
});

test('방 입장 성공: 대기방 정원 미만이면 입장된다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'join-room' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  const joined = joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'user-1' });
  assert.equal(joined.ok, true);
  if (joined.ok) {
    assert.equal(joined.room.playerCount, 1);
    assert.equal(joined.room.hostMemberId, 'u1');
    assert.equal(joined.room.members.length, 1);
    assert.equal(joined.room.members[0].displayName, 'user-1');
  }
});

test('방 입장 실패: 존재하지 않는 방이면 ROOM_NOT_FOUND', () => {
  const { state } = createLobbyHttpServer();
  const joined = joinRoom(state, 'room-999', { memberId: 'u1', displayName: 'user-1' });
  assert.equal(joined.ok, false);
  if (!joined.ok) {
    assert.equal(joined.errorCode, 'ROOM_NOT_FOUND');
  }
});

test('방 상세 조회: 존재하는 roomId면 상세를 반환한다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'detail-room' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'user-1' });
  const detail = getRoomDetail(state, created.room.roomId);
  assert.equal(detail.ok, true);
  if (detail.ok) {
    assert.equal(detail.room.roomId, created.room.roomId);
    assert.equal(detail.room.members.length, 1);
    assert.equal(detail.room.hostMemberId, 'u1');
  }
});

test('게임 시작: 방장이고 2인 이상이면 IN_GAME으로 전환된다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'start-room' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  joinRoom(state, created.room.roomId, { memberId: 'u2', displayName: 'guest' });
  const started = startRoomGame(state, created.room.roomId, 'u1');
  assert.equal(started.ok, true);
  if (started.ok) {
    assert.equal(started.room.state, 'IN_GAME');
  }
});

test('강퇴: 방장이 타겟 멤버를 제거하면 인원이 감소한다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'kick-room' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  joinRoom(state, created.room.roomId, { memberId: 'u2', displayName: 'guest' });
  const kicked = kickRoomMember(state, created.room.roomId, 'u1', 'u2');
  assert.equal(kicked.ok, true);
  if (kicked.ok) {
    assert.equal(kicked.room.playerCount, 1);
    assert.equal(kicked.room.members[0].memberId, 'u1');
  }
});

test('나가기: 멤버가 leave를 호출하면 룸에서 제거되고 host가 비면 다음 멤버로 위임된다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'leave-room' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  joinRoom(state, created.room.roomId, { memberId: 'u2', displayName: 'guest' });
  const left = leaveRoomMember(state, created.room.roomId, 'u1');
  assert.equal(left.ok, true);
  if (left.ok) {
    assert.equal(left.room.playerCount, 1);
    assert.equal(left.room.members[0].memberId, 'u2');
    assert.equal(left.room.hostMemberId, 'u2');
  }
});

test('방장 나가기: host_delegated 이벤트가 발행되고 다음 멤버가 host가 된다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'host-delegate' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }
  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  joinRoom(state, created.room.roomId, { memberId: 'u2', displayName: 'guest-1' });

  const writes: string[] = [];
  const fakeSubscriber = {
    writableEnded: false,
    destroyed: false,
    write(chunk: string) {
      writes.push(chunk);
      return true;
    },
  } as unknown as import('node:http').ServerResponse;
  state.roomStreamSubscribers[created.room.roomId].add(fakeSubscriber);

  const left = leaveRoomMember(state, created.room.roomId, 'u1');
  assert.equal(left.ok, true);
  if (left.ok) {
    assert.equal(left.room.hostMemberId, 'u2');
  }
  const output = writes.join('');
  assert.ok(output.includes('event: host_delegated'));
  assert.ok(output.includes('"nextHostMemberId":"u2"'));
});

test('재경기: 방장이고 2인 이상이면 IN_GAME으로 전환된다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'rematch-room' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  joinRoom(state, created.room.roomId, { memberId: 'u2', displayName: 'guest' });
  created.room.state = 'FINISHED';
  const rematch = rematchRoomGame(state, created.room.roomId, 'u1');
  assert.equal(rematch.ok, true);
  if (rematch.ok) {
    assert.equal(rematch.room.state, 'IN_GAME');
  }
});

test('채팅 전송: 룸 멤버면 메시지가 저장된다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'chat-room' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  const sent = sendRoomChatMessage(state, created.room.roomId, 'u1', 'hello');
  assert.equal(sent.ok, true);
  if (sent.ok) {
    assert.equal(sent.room.chatMessages.length, 1);
    assert.equal(sent.room.chatMessages[0].message, 'hello');
  }
});

test('채팅 전송: 3초 이내 연속 전송이면 CHAT_RATE_LIMITED를 반환한다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'chat-rate-limit' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  const first = sendRoomChatMessage(state, created.room.roomId, 'u1', 'first');
  assert.equal(first.ok, true);

  const second = sendRoomChatMessage(state, created.room.roomId, 'u1', 'second');
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.equal(second.errorCode, 'CHAT_RATE_LIMITED');
    assert.equal(second.statusCode, 429);
    assert.equal(typeof second.retryAfterMs, 'number');
    assert.ok((second.retryAfterMs ?? 0) > 0);
    assert.equal(created.room.chatMessages.length, 1);
  }
});

test('채팅 전송: 동일 시점 2회 요청 시 1회만 성공하고 나머지는 CHAT_RATE_LIMITED로 거부된다', async () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'chat-race' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  const [first, second] = await Promise.all([
    Promise.resolve().then(() => sendRoomChatMessage(state, created.room.roomId, 'u1', 'first')),
    Promise.resolve().then(() => sendRoomChatMessage(state, created.room.roomId, 'u1', 'second')),
  ]);
  const successCount = [first, second].filter((item) => item.ok).length;
  const blockedCount = [first, second].filter((item) => !item.ok && item.errorCode === 'CHAT_RATE_LIMITED').length;
  assert.equal(successCount, 1);
  assert.equal(blockedCount, 1);
  assert.equal(created.room.chatMessages.length, 1);
});

test('샷 입력 제출: 스키마 유효 payload면 accepted 된다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'shot-room' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  const result = submitRoomShot(state, created.room.roomId, 'u1', {
    schemaName: 'shot_input',
    schemaVersion: '1.0.0',
    roomId: created.room.roomId,
    matchId: 'match-1',
    turnId: 'turn-1',
    playerId: 'u1',
    clientTsMs: 1,
    shotDirectionDeg: 120,
    cueElevationDeg: 10,
    dragPx: 300,
    impactOffsetX: 0,
    impactOffsetY: 0,
  });
  assert.equal(result.ok, true);
  const cueBall = created.room.balls.find((ball) => ball.id === 'cueBall');
  assert.ok(cueBall);
  assert.ok(Math.hypot(cueBall?.vx ?? 0, cueBall?.vy ?? 0) > 0);
});

test('샷 입력 제출: 스키마 위반 payload면 SHOT_INPUT_SCHEMA_INVALID', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'shot-invalid' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  const result = submitRoomShot(state, created.room.roomId, 'u1', {
    schemaName: 'shot_input',
    schemaVersion: '1.0.0',
    roomId: created.room.roomId,
  });
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'SHOT_INPUT_SCHEMA_INVALID');
  }
});

test('샷 입력 제출: running 상태에서 중복 제출하면 SHOT_STATE_CONFLICT', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'shot-conflict' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  const payload = {
    schemaName: 'shot_input',
    schemaVersion: '1.0.0',
    roomId: created.room.roomId,
    matchId: 'match-1',
    turnId: 'turn-1',
    playerId: 'u1',
    clientTsMs: 1,
    shotDirectionDeg: 120,
    cueElevationDeg: 10,
    dragPx: 300,
    impactOffsetX: 0,
    impactOffsetY: 0,
  };

  const first = submitRoomShot(state, created.room.roomId, 'u1', payload);
  const second = submitRoomShot(state, created.room.roomId, 'u1', payload);
  assert.equal(first.ok, true);
  assert.equal(second.ok, false);
  if (!second.ok) {
    assert.equal(second.statusCode, 409);
    assert.equal(second.errorCode, 'SHOT_STATE_CONFLICT');
  }
});

test('샷 종료: 10점 도달 시 FINISHED와 winner가 설정되고 game_finished 이벤트가 발행된다', async () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'shot-finish' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  joinRoom(state, created.room.roomId, { memberId: 'u2', displayName: 'guest' });
  const started = startRoomGame(state, created.room.roomId, 'u1');
  assert.equal(started.ok, true);
  if (!started.ok) {
    return;
  }
  started.room.scoreBoard.u1 = 9;

  const writes: string[] = [];
  const fakeSubscriber = {
    writableEnded: false,
    destroyed: false,
    write(chunk: string) {
      writes.push(chunk);
      return true;
    },
  } as unknown as import('node:http').ServerResponse;
  state.roomStreamSubscribers[created.room.roomId].add(fakeSubscriber);

  const result = submitRoomShot(state, created.room.roomId, 'u1', {
    schemaName: 'shot_input',
    schemaVersion: '1.0.0',
    roomId: created.room.roomId,
    matchId: 'match-1',
    turnId: 'turn-1',
    playerId: 'u1',
    clientTsMs: 1,
    shotDirectionDeg: 120,
    cueElevationDeg: 10,
    dragPx: 300,
    impactOffsetX: 0,
    impactOffsetY: 0,
  });
  assert.equal(result.ok, true);
  await new Promise((resolve) => setTimeout(resolve, 900));

  assert.equal(created.room.state, 'FINISHED');
  assert.equal(created.room.winnerMemberId, 'u1');
  assert.equal(created.room.memberGameStates.u1, 'WIN');
  assert.equal(created.room.memberGameStates.u2, 'LOSE');
  assert.equal(created.room.scoreBoard.u1, 10);
  const output = writes.join('');
  assert.ok(output.includes('event: game_finished'));
});

test('연결해제 유예 만료: IN_GAME에서 미복귀 시 LOSE 처리되고 1인 생존자는 즉시 WIN으로 종료된다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'disconnect-win' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }
  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  joinRoom(state, created.room.roomId, { memberId: 'u2', displayName: 'guest' });
  const started = startRoomGame(state, created.room.roomId, 'u1');
  assert.equal(started.ok, true);
  if (!started.ok) {
    return;
  }

  applyDisconnectForfeit(state, created.room.roomId, 'u1');

  assert.equal(created.room.state, 'FINISHED');
  assert.equal(created.room.winnerMemberId, 'u2');
  assert.equal(created.room.memberGameStates.u1, 'LOSE');
  assert.equal(created.room.memberGameStates.u2, 'WIN');
  assert.equal(created.room.members.length, 1);
  assert.equal(created.room.members[0].memberId, 'u2');
});

test('연결복구: 유예 타이머가 존재해도 스트림 재접속 시 타이머가 해제된다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'reconnect-ok' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }
  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  joinRoom(state, created.room.roomId, { memberId: 'u2', displayName: 'guest' });
  const started = startRoomGame(state, created.room.roomId, 'u1');
  assert.equal(started.ok, true);
  if (!started.ok) {
    return;
  }

  const timerKey = `${created.room.roomId}:u1`;
  state.disconnectGraceTimers[timerKey] = setTimeout(() => undefined, 10_000);
  const opened = openRoomSnapshotStream(state, created.room.roomId, 'u1');
  assert.equal(opened.ok, true);
  assert.equal(state.disconnectGraceTimers[timerKey], null);
});

test('룸 스트림 오픈: 룸 멤버면 snapshot을 반환한다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'stream-room' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  const opened = openRoomSnapshotStream(state, created.room.roomId, 'u1');
  assert.equal(opened.ok, true);
  if (opened.ok) {
    assert.equal(opened.snapshot.roomId, created.room.roomId);
    assert.equal(opened.snapshot.balls.length, 3);
    assert.ok(opened.snapshot.seq >= 1);
  }
});

test('룸 스트림 오픈: 비멤버는 ROOM_STREAM_FORBIDDEN(403)', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'stream-deny' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  const opened = openRoomSnapshotStream(state, created.room.roomId, 'u2');
  assert.equal(opened.ok, false);
  if (!opened.ok) {
    assert.equal(opened.statusCode, 403);
    assert.equal(opened.errorCode, 'ROOM_STREAM_FORBIDDEN');
  }
});

test('룸 스트림 snapshot seq는 같은 room에서 단조 증가한다', () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'stream-seq' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  const first = openRoomSnapshotStream(state, created.room.roomId, 'u1');
  const second = openRoomSnapshotStream(state, created.room.roomId, 'u1');
  assert.equal(first.ok, true);
  assert.equal(second.ok, true);
  if (first.ok && second.ok) {
    assert.ok(second.snapshot.seq > first.snapshot.seq);
  }
});

test('샷 제출 후 shot_started -> shot_resolved -> turn_changed 이벤트 순서로 브로드캐스트된다', async () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'shot-broadcast' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }

  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  const writes: string[] = [];
  const fakeSubscriber = {
    writableEnded: false,
    destroyed: false,
    write(chunk: string) {
      writes.push(chunk);
      return true;
    },
  } as unknown as import('node:http').ServerResponse;
  state.roomStreamSubscribers[created.room.roomId].add(fakeSubscriber);

  const payload = {
    schemaName: 'shot_input',
    schemaVersion: '1.0.0',
    roomId: created.room.roomId,
    matchId: 'match-1',
    turnId: 'turn-1',
    playerId: 'u1',
    clientTsMs: 1,
    shotDirectionDeg: 120,
    cueElevationDeg: 10,
    dragPx: 300,
    impactOffsetX: 0,
    impactOffsetY: 0,
  };
  const result = submitRoomShot(state, created.room.roomId, 'u1', payload);
  assert.equal(result.ok, true);
  await new Promise((resolve) => setTimeout(resolve, 900));

  const output = writes.join('');
  const startedIndex = output.indexOf('event: shot_started');
  const resolvedIndex = output.indexOf('event: shot_resolved');
  const turnChangedIndex = output.indexOf('event: turn_changed');
  assert.ok(startedIndex >= 0);
  assert.ok(resolvedIndex > startedIndex);
  assert.ok(turnChangedIndex > resolvedIndex);
});

test('HUD 동기화: 샷 종료 후 turnDeadlineMs가 갱신되고 currentTurnIndex가 다음 플레이어로 이동한다', async () => {
  const { state } = createLobbyHttpServer();
  const created = createRoom(state, { title: 'hud-resync' });
  assert.equal(created.ok, true);
  if (!created.ok) {
    return;
  }
  joinRoom(state, created.room.roomId, { memberId: 'u1', displayName: 'host' });
  joinRoom(state, created.room.roomId, { memberId: 'u2', displayName: 'guest' });
  const started = startRoomGame(state, created.room.roomId, 'u1');
  assert.equal(started.ok, true);
  if (!started.ok) {
    return;
  }
  const previousDeadlineMs = started.room.turnDeadlineMs ?? 0;
  assert.ok(previousDeadlineMs > Date.now());

  const result = submitRoomShot(state, created.room.roomId, 'u1', {
    schemaName: 'shot_input',
    schemaVersion: '1.0.0',
    roomId: created.room.roomId,
    matchId: 'match-1',
    turnId: 'turn-1',
    playerId: 'u1',
    clientTsMs: 1,
    shotDirectionDeg: 120,
    cueElevationDeg: 10,
    dragPx: 300,
    impactOffsetX: 0,
    impactOffsetY: 0,
  });
  assert.equal(result.ok, true);
  await new Promise((resolve) => setTimeout(resolve, 900));

  assert.equal(created.room.currentTurnIndex, 1);
  assert.equal(created.room.members[created.room.currentTurnIndex]?.memberId, 'u2');
  assert.ok((created.room.turnDeadlineMs ?? 0) > previousDeadlineMs);
});
