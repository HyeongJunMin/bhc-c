import { removeMemberAndCollectHostEvents, type RoomHostEvent, type RoomRoster } from './host-policy.ts';
import { requireHostPermission } from './permission-policy.ts';

export type RoomKickEvent =
  | RoomHostEvent
  | {
      type: 'MEMBER_KICKED';
      actorMemberId: string;
      targetMemberId: string;
    }
  | {
      type: 'MEMBER_DISCONNECTED';
      memberId: string;
      reason: 'KICKED';
    };

export type ExecuteKickResult =
  | { ok: true; events: RoomKickEvent[] }
  | { ok: false; errorCode: 'ROOM_HOST_ONLY' | 'ROOM_MEMBER_NOT_FOUND' | 'ROOM_CANNOT_KICK_SELF' };

export function executeKickCommand(
  roster: RoomRoster,
  actorMemberId: string,
  targetMemberId: string,
): ExecuteKickResult {
  const permission = requireHostPermission(actorMemberId, roster.hostMemberId);
  if (!permission.ok) {
    return { ok: false, errorCode: permission.errorCode };
  }

  if (!roster.membersById.has(targetMemberId)) {
    return { ok: false, errorCode: 'ROOM_MEMBER_NOT_FOUND' };
  }

  if (actorMemberId === targetMemberId) {
    return { ok: false, errorCode: 'ROOM_CANNOT_KICK_SELF' };
  }

  const { events: hostEvents } = removeMemberAndCollectHostEvents(roster, targetMemberId);

  return {
    ok: true,
    events: [
      {
        type: 'MEMBER_KICKED',
        actorMemberId,
        targetMemberId,
      },
      {
        type: 'MEMBER_DISCONNECTED',
        memberId: targetMemberId,
        reason: 'KICKED',
      },
      ...hostEvents,
    ],
  };
}
