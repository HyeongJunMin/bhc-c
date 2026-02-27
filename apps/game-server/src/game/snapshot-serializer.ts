type SnapshotBallId = 'cueBall' | 'objectBall1' | 'objectBall2';
type SnapshotBallMotionState = 'SLIDING' | 'ROLLING' | 'SPINNING' | 'STATIONARY';

export type SnapshotBallFrame = {
  id: SnapshotBallId;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  motionState: SnapshotBallMotionState;
  isPocketed: boolean;
};

export type SerializeRoomSnapshotInput = {
  roomId: string;
  seq: number;
  serverTimeMs: number;
  state: 'WAITING' | 'IN_GAME' | 'FINISHED';
  currentMemberId: string | null;
  turnDeadlineMs: number | null;
  scoreBoard: Record<string, number>;
  balls: SnapshotBallFrame[];
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
    turn: { currentMemberId: input.currentMemberId, turnDeadlineMs: input.turnDeadlineMs },
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
      motionState: ball.motionState,
      isPocketed: Boolean(ball.isPocketed),
    })),
  };
}
