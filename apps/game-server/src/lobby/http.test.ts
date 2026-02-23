import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createLobbyHttpServer,
  createRoom,
  getRoomDetail,
  joinRoom,
  kickRoomMember,
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
