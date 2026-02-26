export type SortableRoom = {
  state: 'WAITING' | 'IN_GAME' | 'FINISHED';
  playerCount: number;
  createdAt: string;
};

const WAITING_PRIORITY = 0;
const NON_WAITING_PRIORITY = 1;

export function compareRoomsWaitingFirst(a: SortableRoom, b: SortableRoom): number {
  const aPriority = a.state === 'WAITING' ? WAITING_PRIORITY : NON_WAITING_PRIORITY;
  const bPriority = b.state === 'WAITING' ? WAITING_PRIORITY : NON_WAITING_PRIORITY;

  return aPriority - bPriority;
}

export function compareRoomsForLobby(a: SortableRoom, b: SortableRoom): number {
  const byState = compareRoomsWaitingFirst(a, b);
  if (byState !== 0) {
    return byState;
  }

  if (a.playerCount !== b.playerCount) {
    return a.playerCount - b.playerCount;
  }

  return Date.parse(b.createdAt) - Date.parse(a.createdAt);
}
