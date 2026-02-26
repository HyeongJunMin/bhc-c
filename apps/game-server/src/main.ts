import { createAuthHttpServer } from './auth/http.ts';
import { createLobbyHttpServer } from './lobby/http.ts';

const PORT_MIN = 9211;
const PORT_MAX = 9220;
const DEFAULT_AUTH_PORT = 9211;
const DEFAULT_LOBBY_PORT = 9212;

function parsePort(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number(raw) : fallback;

  if (!Number.isInteger(value) || value < PORT_MIN || value > PORT_MAX) {
    throw new Error(`${name} must be an integer in range ${PORT_MIN}-${PORT_MAX}. received: ${raw ?? fallback}`);
  }

  return value;
}

const authPort = parsePort('AUTH_PORT', DEFAULT_AUTH_PORT);
const lobbyPort = parsePort('LOBBY_PORT', DEFAULT_LOBBY_PORT);

if (authPort === lobbyPort) {
  throw new Error(`AUTH_PORT and LOBBY_PORT must be different. received: ${authPort}`);
}

const { server: authServer } = createAuthHttpServer();
const { server: lobbyServer } = createLobbyHttpServer();

authServer.listen(authPort, () => {
  console.log(`[game-server] auth listening on http://localhost:${authPort}`);
});

lobbyServer.listen(lobbyPort, () => {
  console.log(`[game-server] lobby listening on http://localhost:${lobbyPort}`);
});

function shutdown(): void {
  authServer.close();
  lobbyServer.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
