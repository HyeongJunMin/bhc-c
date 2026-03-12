import { createServer } from 'node:http';

import { createAuthRequestHandler } from './auth/http.ts';
import { createLobbyRequestHandler } from './lobby/http.ts';
import { createFiveAndHalfRequestHandler } from './system/five-and-half.ts';
import { serveStatic } from './static-serve.ts';

const PORT_MIN = 1;
const PORT_MAX = 65535;
const DEFAULT_PORT = 9900;

function parsePort(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number(raw) : fallback;

  if (!Number.isInteger(value) || value < PORT_MIN || value > PORT_MAX) {
    throw new Error(`${name} must be an integer in range ${PORT_MIN}-${PORT_MAX}. received: ${raw ?? fallback}`);
  }

  return value;
}

const port = parsePort('PORT', DEFAULT_PORT);
const staticDir = process.env['STATIC_DIR']?.trim() || null;

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
  lobbyChatMessages: [],
  userLastLobbyChatSentAt: new Map(),
};

const authHandler = createAuthRequestHandler(authState);
const lobbyHandler = createLobbyRequestHandler(lobbyState);
const fiveAndHalfHandler = createFiveAndHalfRequestHandler();

const server = createServer(async (req, res) => {
  if (req.url === '/health') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  if (req.url?.startsWith('/auth/')) {
    void authHandler(req, res);
    return;
  }
  if (req.url?.startsWith('/api/lobby/')) {
    req.url = req.url.slice(4); // strip '/api' → lobbyHandler는 '/lobby/...' 그대로 처리
    void lobbyHandler(req, res);
    return;
  }
  if (req.url?.startsWith('/v1/systems/five-and-half/')) {
    void fiveAndHalfHandler(req, res);
    return;
  }
  if (staticDir) {
    const served = await serveStatic(staticDir, req, res);
    if (served) return;
  }
  res.statusCode = 404;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify({ errorCode: 'NOT_FOUND' }));
});

server.listen(port, () => {
  console.log(`[game-server] listening on http://localhost:${port}`);
});

function shutdown(): void {
  server.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
