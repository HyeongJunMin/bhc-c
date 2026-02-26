export const ROOM_MAX_PLAYERS = 6;

export type RoomJoinContext = {
  currentPlayerCount: number;
  roomState: 'WAITING' | 'IN_GAME' | 'FINISHED';
};

export function isRoomFull(currentPlayerCount: number): boolean {
  return currentPlayerCount >= ROOM_MAX_PLAYERS;
}

export function isJoinBlockedByState(roomState: RoomJoinContext['roomState']): boolean {
  return roomState === 'IN_GAME';
}

export type RoomJoinDecision =
  | { ok: true }
  | { ok: false; errorCode: 'ROOM_FULL' | 'ROOM_IN_GAME' };

export function evaluateRoomJoin(context: RoomJoinContext): RoomJoinDecision {
  if (isRoomFull(context.currentPlayerCount)) {
    return { ok: false, errorCode: 'ROOM_FULL' };
  }

  if (isJoinBlockedByState(context.roomState)) {
    return { ok: false, errorCode: 'ROOM_IN_GAME' };
  }

  return { ok: true };
}
