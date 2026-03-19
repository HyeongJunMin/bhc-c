type SnapshotBallId = 'cueBall' | 'objectBall1' | 'objectBall2';

export type SnapshotBallFrame = {
  id: SnapshotBallId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  isPocketed: boolean;
};

export type SnapshotEvent = {
  type: 'BALL_COLLISION' | 'CUSHION_COLLISION' | 'SHOT_END';
  sourceBallId: string;
  targetBallId?: string;
  cushionId?: string;
};

export type SerializeRoomSnapshotInput = {
  roomId: string;
  seq: number;
  serverTimeMs: number;
  state: 'WAITING' | 'IN_GAME' | 'FINISHED';
  currentMemberId: string | null;
  turnDeadlineMs: number | null;
  activeCueBallId: 'cueBall' | 'objectBall2';
  shotState: string;
  scoreBoard: Record<string, number>;
  balls: SnapshotBallFrame[];
  events?: SnapshotEvent[];
};

function toFiniteNumber(value: number): number {
  if (!Number.isFinite(value)) {
    return 0;
  }
  return Number(value.toFixed(6));
}

export function serializeRoomSnapshot(input: SerializeRoomSnapshotInput) {
  const scoreBoard = Object.entries(input.scoreBoard).reduce<Record<string, number>>((acc, [memberId, score]) => {
    acc[memberId] = toFiniteNumber(score);
    return acc;
  }, {});

  return {
    roomId: input.roomId,
    seq: input.seq,
    serverTimeMs: input.serverTimeMs,
    state: input.state,
    turn: { currentMemberId: input.currentMemberId, turnDeadlineMs: input.turnDeadlineMs, activeCueBallId: input.activeCueBallId, shotState: input.shotState },
    scoreBoard,
    balls: input.balls.map((ball) => ({
      id: ball.id,
      x: toFiniteNumber(ball.x),
      y: toFiniteNumber(ball.y),
      vx: toFiniteNumber(ball.vx),
      vy: toFiniteNumber(ball.vy),
      spinX: toFiniteNumber(ball.spinX),
      spinY: toFiniteNumber(ball.spinY),
      spinZ: toFiniteNumber(ball.spinZ),
      isPocketed: Boolean(ball.isPocketed),
    })),
    ...(input.events && input.events.length > 0 ? { events: input.events } : {}),
  };
}
