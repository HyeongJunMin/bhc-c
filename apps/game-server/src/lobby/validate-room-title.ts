const ROOM_TITLE_MAX_LENGTH = 15;

export type RoomTitleValidationResult =
  | { ok: true; normalizedTitle: string }
  | { ok: false; errorCode: 'ROOM_TITLE_REQUIRED' | 'ROOM_TITLE_TOO_LONG' };

export function validateRoomTitle(value: unknown): RoomTitleValidationResult {
  if (typeof value !== 'string') {
    return { ok: false, errorCode: 'ROOM_TITLE_REQUIRED' };
  }

  const normalizedTitle = value.trim();
  if (normalizedTitle.length === 0) {
    return { ok: false, errorCode: 'ROOM_TITLE_REQUIRED' };
  }

  if (normalizedTitle.length > ROOM_TITLE_MAX_LENGTH) {
    return { ok: false, errorCode: 'ROOM_TITLE_TOO_LONG' };
  }

  return { ok: true, normalizedTitle };
}
