import test from 'node:test';
import assert from 'node:assert/strict';

import { createLobbyHttpServer, createRoom, listRooms } from './http.ts';

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
