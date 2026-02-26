export type RoomParticipant = {
  memberId: string;
  roomId: string;
};

export type RoomChatEvent = {
  roomId: string;
  senderMemberId: string;
  message: string;
};

export type RoomChatBroadcast = {
  recipients: string[];
  event: RoomChatEvent;
};

export type RoomChatMessage = {
  senderMemberId: string;
  message: string;
};

export type RoomChatBufferStore = Map<string, RoomChatMessage[]>;

export function broadcastRoomChat(
  participants: RoomParticipant[],
  roomId: string,
  senderMemberId: string,
  message: string,
): RoomChatBroadcast {
  const recipients = participants
    .filter((participant) => participant.roomId === roomId)
    .map((participant) => participant.memberId);

  return {
    recipients,
    event: {
      roomId,
      senderMemberId,
      message,
    },
  };
}

export function appendRoomChatMessage(
  roomChatBufferStore: RoomChatBufferStore,
  roomId: string,
  roomChatMessage: RoomChatMessage,
): RoomChatBufferStore {
  const previousMessages = roomChatBufferStore.get(roomId) ?? [];
  roomChatBufferStore.set(roomId, [...previousMessages, roomChatMessage]);

  return roomChatBufferStore;
}

export function getRoomChatMessages(roomChatBufferStore: RoomChatBufferStore, roomId: string): RoomChatMessage[] {
  return roomChatBufferStore.get(roomId) ?? [];
}

export function clearRoomChatBuffer(roomChatBufferStore: RoomChatBufferStore, roomId: string): RoomChatBufferStore {
  roomChatBufferStore.delete(roomId);
  return roomChatBufferStore;
}
