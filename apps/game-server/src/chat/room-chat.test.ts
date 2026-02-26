import test from 'node:test';
import assert from 'node:assert/strict';

import {
  appendRoomChatMessage,
  broadcastRoomChat,
  clearRoomChatBuffer,
  getRoomChatMessages,
} from './room-chat.ts';

test('룸 채팅은 같은 방 참가자에게만 전파된다', () => {
  const result = broadcastRoomChat(
    [
      { memberId: 'u1', roomId: 'room-1' },
      { memberId: 'u2', roomId: 'room-1' },
      { memberId: 'u3', roomId: 'room-2' },
    ],
    'room-1',
    'u1',
    'hello',
  );

  assert.deepEqual(result.recipients, ['u1', 'u2']);
  assert.equal(result.event.roomId, 'room-1');
  assert.equal(result.event.senderMemberId, 'u1');
  assert.equal(result.event.message, 'hello');
});

test('채팅 메시지는 룸별 메모리 버퍼에 저장된다', () => {
  const roomChatBufferStore = new Map();

  appendRoomChatMessage(roomChatBufferStore, 'room-1', {
    senderMemberId: 'u1',
    message: 'first',
  });
  appendRoomChatMessage(roomChatBufferStore, 'room-1', {
    senderMemberId: 'u2',
    message: 'second',
  });
  appendRoomChatMessage(roomChatBufferStore, 'room-2', {
    senderMemberId: 'u3',
    message: 'other room',
  });

  assert.deepEqual(getRoomChatMessages(roomChatBufferStore, 'room-1'), [
    { senderMemberId: 'u1', message: 'first' },
    { senderMemberId: 'u2', message: 'second' },
  ]);
  assert.deepEqual(getRoomChatMessages(roomChatBufferStore, 'room-2'), [
    { senderMemberId: 'u3', message: 'other room' },
  ]);
});

test('룸 종료 시 해당 룸의 채팅 버퍼를 해제한다', () => {
  const roomChatBufferStore = new Map();

  appendRoomChatMessage(roomChatBufferStore, 'room-1', {
    senderMemberId: 'u1',
    message: 'bye',
  });
  appendRoomChatMessage(roomChatBufferStore, 'room-2', {
    senderMemberId: 'u2',
    message: 'stay',
  });

  clearRoomChatBuffer(roomChatBufferStore, 'room-1');

  assert.deepEqual(getRoomChatMessages(roomChatBufferStore, 'room-1'), []);
  assert.deepEqual(getRoomChatMessages(roomChatBufferStore, 'room-2'), [
    { senderMemberId: 'u2', message: 'stay' },
  ]);
});
