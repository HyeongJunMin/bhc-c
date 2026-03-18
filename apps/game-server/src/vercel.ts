import type { IncomingMessage, ServerResponse } from 'node:http';

import { createAuthRequestHandler } from './auth/http.ts';
import { createLobbyRequestHandler } from './lobby/http.ts';

const authState = {
  nextUserId: 1,
  nextGuestId: 1,
  usersByUsername: new Map(),
};

const lobbyState = {
  nextRoomId: 1,
  rooms: [],
  roomStreamSeqByRoomId: {},
  roomStreamSubscribers: {},
  shotStateResetTimers: {},
  disconnectGraceTimers: {},
  userLastChatSentAtByRoomAndMember: new Map(),
};

const authHandler = createAuthRequestHandler(authState);
const lobbyHandler = createLobbyRequestHandler(lobbyState);

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

export default async function handler(req: IncomingMessage, res: ServerResponse): Promise<void> {
  if (req.url === '/health') {
    writeJson(res, 200, { ok: true });
    return;
  }
  if (req.url?.startsWith('/auth/')) {
    await authHandler(req, res);
    return;
  }
  if (req.url?.startsWith('/api/lobby/')) {
    req.url = req.url.slice(4); // strip '/api' → lobbyHandler는 '/lobby/...' 그대로 처리
    await lobbyHandler(req, res);
    return;
  }
  if (req.url === '/simulate' && req.method === 'POST') {
    await lobbyHandler(req, res);
    return;
  }
  writeJson(res, 404, { errorCode: 'NOT_FOUND' });
}
