function resolveApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_GAME_SERVER_URL as string | undefined)?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }
  // 기본값: same-origin (프로덕션에서 game-server가 정적 파일 서빙)
  return '';
}

export type LobbyRoom = {
  roomId: string;
  title: string;
  state: 'WAITING' | 'IN_GAME' | 'FINISHED';
  playerCount: number;
  createdAt: string;
  hostMemberId: string | null;
  members: Array<{
    memberId: string;
    displayName: string;
    joinedAt: string;
  }>;
};

export type GuestLoginResponse = {
  guestId: string;
  nickname: string;
  accessToken: string;
  refreshToken: string;
};

export type ListRoomsResponse = {
  items: LobbyRoom[];
  hasMore: boolean;
  nextOffset: number;
};

async function postJson<T>(path: string, body?: unknown): Promise<T> {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ errorCode: 'UNKNOWN' }));
    throw new Error((error as { errorCode?: string }).errorCode ?? 'UNKNOWN');
  }
  return response.json() as Promise<T>;
}

async function getJson<T>(path: string): Promise<T> {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}${path}`);
  if (!response.ok) {
    const error = await response.json().catch(() => ({ errorCode: 'UNKNOWN' }));
    throw new Error((error as { errorCode?: string }).errorCode ?? 'UNKNOWN');
  }
  return response.json() as Promise<T>;
}

export type ChatMessage = {
  senderMemberId: string;
  senderDisplayName: string;
  message: string;
  sentAt: string;
};

export async function getLobbyChatMessages(): Promise<{ items: ChatMessage[] }> {
  return getJson<{ items: ChatMessage[] }>('/api/lobby/chat');
}

export async function sendLobbyChatMessage(
  senderMemberId: string,
  senderDisplayName: string,
  message: string,
): Promise<{ item: ChatMessage }> {
  return postJson<{ item: ChatMessage }>('/api/lobby/chat', { senderMemberId, senderDisplayName, message });
}

export async function getRoomChatMessages(roomId: string): Promise<{ items: ChatMessage[] }> {
  return getJson<{ items: ChatMessage[] }>(`/api/lobby/rooms/${roomId}/chat`);
}

export async function sendRoomChatMessage(
  roomId: string,
  senderMemberId: string,
  message: string,
): Promise<{ item: ChatMessage }> {
  return postJson<{ item: ChatMessage }>(`/api/lobby/rooms/${roomId}/chat`, { senderMemberId, message });
}

export async function authGuest(nickname: string): Promise<GuestLoginResponse> {
  return postJson<GuestLoginResponse>('/auth/guest', { nickname });
}

export async function listRooms(): Promise<ListRoomsResponse> {
  return getJson<ListRoomsResponse>('/api/lobby/rooms');
}

export async function createRoom(title: string, memberId: string, displayName: string): Promise<{ room: LobbyRoom }> {
  const { room } = await postJson<{ room: LobbyRoom }>('/api/lobby/rooms', { title });
  return joinRoom(room.roomId, memberId, displayName);
}

export async function joinRoom(roomId: string, memberId: string, displayName: string): Promise<{ room: LobbyRoom }> {
  return postJson<{ room: LobbyRoom }>(`/api/lobby/rooms/${roomId}/join`, { memberId, displayName });
}

export async function leaveRoom(roomId: string, memberId: string): Promise<void> {
  await postJson(`/api/lobby/rooms/${roomId}/leave`, { actorMemberId: memberId });
}

export async function getRoomDetail(roomId: string): Promise<LobbyRoom> {
  const { room } = await getJson<{ room: LobbyRoom }>(`/api/lobby/rooms/${roomId}`);
  return room;
}

export async function startGame(roomId: string, memberId: string): Promise<void> {
  await postJson(`/api/lobby/rooms/${roomId}/start`, { actorMemberId: memberId });
}

export function createRoomStream(roomId: string, memberId: string): EventSource {
  const baseUrl = resolveApiBaseUrl();
  return new EventSource(
    `${baseUrl}/api/lobby/rooms/${roomId}/stream?memberId=${encodeURIComponent(memberId)}`,
  );
}

export async function requestReplay(roomId: string, actorMemberId: string): Promise<void> {
  await postJson(`/api/lobby/rooms/${roomId}/replay`, { actorMemberId });
}

export async function endReplay(roomId: string, actorMemberId: string): Promise<void> {
  await postJson(`/api/lobby/rooms/${roomId}/replay-end`, { actorMemberId });
}

export async function submitShot(
  roomId: string,
  actorMemberId: string,
  payload: {
    shotDirectionDeg: number;
    cueElevationDeg: number;
    dragPx: number;
    impactOffsetX: number;
    impactOffsetY: number;
  },
): Promise<void> {
  await postJson(`/api/lobby/rooms/${roomId}/shot`, {
    actorMemberId,
    payload: {
      schemaName: 'shot_input',
      schemaVersion: '1.0.0',
      roomId,
      matchId: roomId,
      turnId: `${roomId}-${Date.now()}`,
      playerId: actorMemberId,
      clientTsMs: Date.now(),
      ...payload,
    },
  });
}

export async function requestVAR(roomId: string, actorMemberId: string): Promise<void> {
  await postJson(`/api/lobby/rooms/${roomId}/var-request`, { actorMemberId });
}

export async function submitVARVote(roomId: string, actorMemberId: string, vote: boolean): Promise<void> {
  await postJson(`/api/lobby/rooms/${roomId}/var-vote`, { actorMemberId, vote });
}

export async function signalVARReplayEnd(roomId: string, actorMemberId: string): Promise<void> {
  await postJson(`/api/lobby/rooms/${roomId}/var-replay-end`, { actorMemberId });
}
