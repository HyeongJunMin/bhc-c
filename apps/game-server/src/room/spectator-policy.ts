export type JoinRole = 'PLAYER' | 'SPECTATOR';

export type SpectatorJoinDecision =
  | { ok: true }
  | { ok: false; errorCode: 'ROOM_SPECTATOR_NOT_ALLOWED' };

export function evaluateSpectatorJoin(role: JoinRole): SpectatorJoinDecision {
  if (role === 'SPECTATOR') {
    return { ok: false, errorCode: 'ROOM_SPECTATOR_NOT_ALLOWED' };
  }

  return { ok: true };
}

export function mapSpectatorJoinErrorToMessage(errorCode: 'ROOM_SPECTATOR_NOT_ALLOWED'): string {
  if (errorCode === 'ROOM_SPECTATOR_NOT_ALLOWED') {
    return '관전 모드는 현재 지원하지 않습니다. 플레이어로 입장해 주세요.';
  }

  return '입장할 수 없습니다.';
}
