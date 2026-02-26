export type HostPermissionResult =
  | { ok: true }
  | { ok: false; errorCode: 'ROOM_HOST_ONLY' };

export function requireHostPermission(actorMemberId: string, hostMemberId: string | null): HostPermissionResult {
  if (!hostMemberId || actorMemberId !== hostMemberId) {
    return { ok: false, errorCode: 'ROOM_HOST_ONLY' };
  }

  return { ok: true };
}
