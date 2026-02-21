export const GAME_TARGET_SCORE = 10;

export type ScoreBoard = Record<string, number>;

export type IncreaseScoreResult =
  | {
      ok: true;
      playerId: string;
      nextScore: number;
      scoreBoard: ScoreBoard;
    }
  | {
      ok: false;
      errorCode: 'GAME_PLAYER_NOT_FOUND' | 'GAME_INVALID_SCORE_DELTA';
    };

export function createScoreBoard(playerIds: string[]): ScoreBoard {
  return playerIds.reduce<ScoreBoard>((scoreBoard, playerId) => {
    scoreBoard[playerId] = 0;
    return scoreBoard;
  }, {});
}

export function increasePlayerScore(
  scoreBoard: ScoreBoard,
  playerId: string,
  delta: number = 1,
): IncreaseScoreResult {
  if (!Number.isInteger(delta) || delta < 1) {
    return { ok: false, errorCode: 'GAME_INVALID_SCORE_DELTA' };
  }

  if (!(playerId in scoreBoard)) {
    return { ok: false, errorCode: 'GAME_PLAYER_NOT_FOUND' };
  }

  const nextScore = scoreBoard[playerId] + delta;
  scoreBoard[playerId] = nextScore;

  return {
    ok: true,
    playerId,
    nextScore,
    scoreBoard,
  };
}
