export type GameState = 'WAITING' | 'IN_GAME' | 'FINISHED';

export type GameStartContext = {
  roomState: GameState;
  hostMemberId: string | null;
  actorMemberId: string;
  playerIds: string[];
};

export type StartResult =
  | { ok: true; nextRoomState: 'IN_GAME' }
  | { ok: false; errorCode: 'ROOM_HOST_ONLY' | 'GAME_ALREADY_STARTED' | 'GAME_NOT_ENOUGH_PLAYERS' };

export function startGameRequest(context: GameStartContext): StartResult {
  if (context.roomState === 'IN_GAME') {
    return { ok: false, errorCode: 'GAME_ALREADY_STARTED' };
  }

  if (!context.hostMemberId || context.actorMemberId !== context.hostMemberId) {
    return { ok: false, errorCode: 'ROOM_HOST_ONLY' };
  }

  if (context.playerIds.length < 2) {
    return { ok: false, errorCode: 'GAME_NOT_ENOUGH_PLAYERS' };
  }

  return { ok: true, nextRoomState: 'IN_GAME' };
}
