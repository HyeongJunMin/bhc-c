import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { paginateRooms } from './pagination.ts';
import { compareRoomsForLobby } from './sort-rooms.ts';
import { validateRoomTitle } from './validate-room-title.ts';
import { evaluateRoomJoin } from '../room/join-policy.ts';
import { startGameRequest } from '../game/start-policy.ts';

type LobbyRoom = {
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

type LobbyState = {
  nextRoomId: number;
  rooms: LobbyRoom[];
};

type CreateRoomResult =
  | { ok: true; room: LobbyRoom }
  | { ok: false; statusCode: 400; errorCode: 'ROOM_TITLE_REQUIRED' | 'ROOM_TITLE_TOO_LONG' };

type JoinRoomResult =
  | { ok: true; room: LobbyRoom }
  | { ok: false; statusCode: 404 | 409; errorCode: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'ROOM_IN_GAME' };

type RoomDetailResult = { ok: true; room: LobbyRoom } | { ok: false; statusCode: 404; errorCode: 'ROOM_NOT_FOUND' };
type RoomActionResult =
  | { ok: true; room: LobbyRoom }
  | {
      ok: false;
      statusCode: 400 | 404 | 409;
      errorCode:
        | 'ROOM_NOT_FOUND'
        | 'ROOM_HOST_ONLY'
        | 'ROOM_MEMBER_NOT_FOUND'
        | 'ROOM_CANNOT_KICK_SELF'
        | 'GAME_ALREADY_STARTED'
        | 'GAME_NOT_ENOUGH_PLAYERS';
    };

type ListRoomsResult = {
  items: LobbyRoom[];
  hasMore: boolean;
  nextOffset: number;
};

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

async function parseJsonBody(req: IncomingMessage, res: ServerResponse): Promise<Record<string, unknown> | null> {
  try {
    const rawBody = await readBody(req);
    return JSON.parse(rawBody || '{}') as Record<string, unknown>;
  } catch {
    writeJson(res, 400, { errorCode: 'ROOM_INVALID_JSON' });
    return null;
  }
}

export function createRoom(state: LobbyState, input: { title: unknown }): CreateRoomResult {
  const validated = validateRoomTitle(input.title);
  if (!validated.ok) {
    return { ok: false, statusCode: 400, errorCode: validated.errorCode };
  }

  const room: LobbyRoom = {
    roomId: `room-${state.nextRoomId}`,
    title: validated.normalizedTitle,
    state: 'WAITING',
    playerCount: 0,
    createdAt: new Date().toISOString(),
    hostMemberId: null,
    members: [],
  };

  state.nextRoomId += 1;
  state.rooms.push(room);

  return { ok: true, room };
}

async function handleCreateRoom(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const result = createRoom(state, { title: body.title });
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }

  writeJson(res, 201, { room: result.room });
}

function parseNumber(value: string | null, fallback: number): number {
  if (value === null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function listRooms(state: LobbyState, input: { offset?: number; limit?: number }): ListRoomsResult {
  const safeOffset = Math.max(0, input.offset ?? 0);
  const safeLimit = Math.max(1, input.limit ?? 20);
  const sorted = [...state.rooms].sort(compareRoomsForLobby);
  return paginateRooms(sorted, safeOffset, safeLimit);
}

function handleListRooms(req: IncomingMessage, res: ServerResponse, state: LobbyState): void {
  const url = new URL(req.url ?? '/lobby/rooms', 'http://localhost');
  const offset = parseNumber(url.searchParams.get('offset'), 0);
  const limit = parseNumber(url.searchParams.get('limit'), 20);
  const page = listRooms(state, { offset, limit });
  writeJson(res, 200, page);
}

export function joinRoom(state: LobbyState, roomId: string, member: { memberId: string; displayName: string }): JoinRoomResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const decision = evaluateRoomJoin({
    currentPlayerCount: room.playerCount,
    roomState: room.state,
  });
  if (!decision.ok) {
    return { ok: false, statusCode: 409, errorCode: decision.errorCode };
  }

  room.playerCount += 1;
  room.members.push({
    memberId: member.memberId,
    displayName: member.displayName,
    joinedAt: new Date().toISOString(),
  });
  if (!room.hostMemberId) {
    room.hostMemberId = member.memberId;
  }

  return { ok: true, room };
}

async function handleJoinRoom(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/join$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const memberIdRaw = typeof body.memberId === 'string' ? body.memberId.trim() : '';
  const displayNameRaw = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const room = state.rooms.find((item) => item.roomId === roomId);
  const fallbackMemberNo = (room?.members.length ?? 0) + 1;
  const memberId = memberIdRaw.length > 0 ? memberIdRaw : `member-${fallbackMemberNo}`;
  const displayName = displayNameRaw.length > 0 ? displayNameRaw : memberId;

  const result = joinRoom(state, roomId, { memberId, displayName });
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }

  writeJson(res, 200, { room: result.room });
}

function requireHost(room: LobbyRoom, actorMemberId: string): RoomActionResult | null {
  if (!room.hostMemberId || actorMemberId !== room.hostMemberId) {
    return { ok: false, statusCode: 409, errorCode: 'ROOM_HOST_ONLY' };
  }
  return null;
}

export function startRoomGame(state: LobbyState, roomId: string, actorMemberId: string): RoomActionResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const startResult = startGameRequest({
    roomState: room.state,
    hostMemberId: room.hostMemberId,
    actorMemberId,
    playerIds: room.members.map((member) => member.memberId),
  });
  if (!startResult.ok) {
    return { ok: false, statusCode: 409, errorCode: startResult.errorCode };
  }

  room.state = startResult.nextRoomState;
  return { ok: true, room };
}

export function rematchRoomGame(state: LobbyState, roomId: string, actorMemberId: string): RoomActionResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const permission = requireHost(room, actorMemberId);
  if (permission) {
    return permission;
  }

  if (room.members.length < 2) {
    return { ok: false, statusCode: 409, errorCode: 'GAME_NOT_ENOUGH_PLAYERS' };
  }

  room.state = 'IN_GAME';
  return { ok: true, room };
}

export function kickRoomMember(
  state: LobbyState,
  roomId: string,
  actorMemberId: string,
  targetMemberId: string,
): RoomActionResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const permission = requireHost(room, actorMemberId);
  if (permission) {
    return permission;
  }

  if (actorMemberId === targetMemberId) {
    return { ok: false, statusCode: 409, errorCode: 'ROOM_CANNOT_KICK_SELF' };
  }

  const targetIndex = room.members.findIndex((member) => member.memberId === targetMemberId);
  if (targetIndex < 0) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_MEMBER_NOT_FOUND' };
  }

  room.members.splice(targetIndex, 1);
  room.playerCount = room.members.length;
  return { ok: true, room };
}

async function handleStartRoom(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/start$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const result = startRoomGame(state, roomId, actorMemberId);
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }
  writeJson(res, 200, { room: result.room });
}

async function handleRematchRoom(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/rematch$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const result = rematchRoomGame(state, roomId, actorMemberId);
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }
  writeJson(res, 200, { room: result.room });
}

async function handleKickRoomMember(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/kick$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const targetMemberId = typeof body.targetMemberId === 'string' ? body.targetMemberId : '';
  const result = kickRoomMember(state, roomId, actorMemberId, targetMemberId);
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }
  writeJson(res, 200, { room: result.room });
}

export function getRoomDetail(state: LobbyState, roomId: string): RoomDetailResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  return { ok: true, room };
}

function handleGetRoomDetail(req: IncomingMessage, res: ServerResponse, state: LobbyState): void {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/?#]+)$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const result = getRoomDetail(state, roomId);
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }

  writeJson(res, 200, { room: result.room });
}

export function createLobbyHttpServer() {
  const state: LobbyState = {
    nextRoomId: 1,
    rooms: [],
  };

  const server = createServer(async (req, res) => {
    if (req.method === 'GET' && req.url?.startsWith('/lobby/rooms/')) {
      handleGetRoomDetail(req, res, state);
      return;
    }

    if (req.method === 'GET' && req.url?.startsWith('/lobby/rooms')) {
      handleListRooms(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url === '/lobby/rooms') {
      await handleCreateRoom(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/join')) {
      await handleJoinRoom(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/start')) {
      await handleStartRoom(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/rematch')) {
      await handleRematchRoom(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/kick')) {
      await handleKickRoomMember(req, res, state);
      return;
    }

    writeJson(res, 404, { errorCode: 'NOT_FOUND' });
  });

  return {
    state,
    server,
  };
}
