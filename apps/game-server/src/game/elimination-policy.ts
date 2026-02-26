export type PlayerLeaveOutcome =
  | {
      ok: true;
      defeatedPlayerId: string;
      activePlayerIds: string[];
      gameEnded: boolean;
      winnerPlayerId: string | null;
    }
  | {
      ok: false;
      errorCode: 'GAME_PLAYER_NOT_FOUND';
    };

export function handlePlayerLeave(activePlayerIds: string[], leavingPlayerId: string): PlayerLeaveOutcome {
  const leavingIndex = activePlayerIds.indexOf(leavingPlayerId);
  if (leavingIndex === -1) {
    return {
      ok: false,
      errorCode: 'GAME_PLAYER_NOT_FOUND',
    };
  }

  const nextActivePlayerIds = activePlayerIds.filter((playerId) => playerId !== leavingPlayerId);

  if (nextActivePlayerIds.length === 1) {
    return {
      ok: true,
      defeatedPlayerId: leavingPlayerId,
      activePlayerIds: nextActivePlayerIds,
      gameEnded: true,
      winnerPlayerId: nextActivePlayerIds[0] ?? null,
    };
  }

  return {
    ok: true,
    defeatedPlayerId: leavingPlayerId,
    activePlayerIds: nextActivePlayerIds,
    gameEnded: false,
    winnerPlayerId: null,
  };
}
