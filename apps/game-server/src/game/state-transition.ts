export type RoomState = 'WAITING' | 'IN_GAME' | 'FINISHED';

const allowedTransitions: Record<RoomState, RoomState[]> = {
  WAITING: ['IN_GAME'],
  IN_GAME: ['FINISHED', 'WAITING'],
  FINISHED: ['WAITING'],
};

export function assertStateTransition(from: RoomState, to: RoomState): void {
  const allowed = allowedTransitions[from] ?? [];
  if (!allowed.includes(to)) {
    throw new Error(`Invalid state transition: ${from} -> ${to}`);
  }
}
