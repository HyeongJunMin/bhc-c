import type { IncomingMessage, ServerResponse } from 'node:http';
import type { TurnTimer } from '../game/turn-timer.ts';

const ADMIN_USERNAME = 'admin';
const ADMIN_PASSWORD = 'rsup#4430';
const SESSION_COOKIE_NAME = 'admin_session';

const activeSessions = new Set<string>();

type AdminRoom = {
  roomId: string;
  title: string;
  state: 'WAITING' | 'IN_GAME' | 'FINISHED';
  members: Array<unknown>;
  createdAt: string;
};

type AdminLobbyState = {
  rooms: AdminRoom[];
  roomStreamSeqByRoomId: Record<string, number>;
  roomStreamSubscribers: Record<string, Set<ServerResponse>>;
  shotStateResetTimers: Record<string, ReturnType<typeof setTimeout> | null>;
  disconnectGraceTimers: Record<string, ReturnType<typeof setTimeout> | null>;
  turnTimers: Record<string, TurnTimer | null>;
  roomHeartbeatTimers: Record<string, ReturnType<typeof setInterval> | null>;
};

function generateToken(): string {
  return Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2);
}

function getSessionToken(req: IncomingMessage): string | null {
  const cookieHeader = req.headers['cookie'] ?? '';
  for (const part of cookieHeader.split(';')) {
    const [name, ...rest] = part.trim().split('=');
    if (name === SESSION_COOKIE_NAME) return rest.join('=');
  }
  return null;
}

function isAuthenticated(req: IncomingMessage): boolean {
  const token = getSessionToken(req);
  return token !== null && activeSessions.has(token);
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = [];
    req.on('data', (chunk: Buffer) => chunks.push(chunk));
    req.on('end', () => resolve(Buffer.concat(chunks).toString('utf-8')));
  });
}

function parseFormBody(body: string): Record<string, string> {
  const params: Record<string, string> = {};
  for (const pair of body.split('&')) {
    const [key, ...rest] = pair.split('=');
    if (key) params[decodeURIComponent(key)] = decodeURIComponent(rest.join('=').replace(/\+/g, ' '));
  }
  return params;
}

function escapeHtml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderLoginPage(error?: string): string {
  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BHC Admin 로그인</title>
  <style>
    * { box-sizing: border-box; }
    body { font-family: sans-serif; background: #f5f5f5; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; }
    .card { background: #fff; padding: 2rem; border-radius: 8px; box-shadow: 0 2px 8px rgba(0,0,0,0.15); width: 100%; max-width: 360px; }
    h1 { margin: 0 0 1.5rem; font-size: 1.3rem; color: #333; text-align: center; }
    label { display: block; font-size: 0.85rem; color: #555; margin-bottom: 0.25rem; }
    input { display: block; width: 100%; padding: 0.5rem 0.75rem; border: 1px solid #ccc; border-radius: 4px; font-size: 1rem; margin-bottom: 1rem; }
    input:focus { outline: none; border-color: #333; }
    button { display: block; width: 100%; padding: 0.6rem; background: #333; color: #fff; border: none; border-radius: 4px; font-size: 1rem; cursor: pointer; }
    button:hover { background: #555; }
    .error { color: #d9534f; font-size: 0.85rem; margin-bottom: 1rem; text-align: center; }
  </style>
</head>
<body>
  <div class="card">
    <h1>BHC 어드민</h1>
    ${error ? `<p class="error">${escapeHtml(error)}</p>` : ''}
    <form method="POST" action="/djemals">
      <input type="hidden" name="action" value="login">
      <label for="username">아이디</label>
      <input id="username" type="text" name="username" autocomplete="username" required>
      <label for="password">비밀번호</label>
      <input id="password" type="password" name="password" autocomplete="current-password" required>
      <button type="submit">로그인</button>
    </form>
  </div>
</body>
</html>`;
}

function renderAdminPage(state: AdminLobbyState): string {
  const emptyWaiting = state.rooms.filter((r) => r.state === 'WAITING' && r.members.length === 0);
  const emptyFinished = state.rooms.filter((r) => r.state === 'FINISHED' && r.members.length === 0);

  const rows = state.rooms
    .map(
      (r) => `
    <tr>
      <td>${escapeHtml(r.roomId)}</td>
      <td>${escapeHtml(r.title)}</td>
      <td>${escapeHtml(r.state)}</td>
      <td>${r.members.length}</td>
      <td>${escapeHtml(r.createdAt)}</td>
    </tr>`,
    )
    .join('');

  return `<!DOCTYPE html>
<html lang="ko">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>BHC Admin</title>
  <style>
    body { font-family: sans-serif; padding: 2rem; background: #f5f5f5; }
    h1 { color: #333; }
    .stats { margin: 1rem 0; padding: 1rem; background: #fff; border-radius: 4px; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    .actions { margin: 1rem 0; display: flex; gap: 1rem; }
    form button {
      padding: 0.5rem 1rem;
      border: none;
      border-radius: 4px;
      cursor: pointer;
      font-size: 0.9rem;
    }
    .btn-warning { background: #f0ad4e; color: #fff; }
    .btn-danger { background: #d9534f; color: #fff; }
    table { width: 100%; border-collapse: collapse; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.1); }
    th, td { padding: 0.6rem 1rem; text-align: left; border-bottom: 1px solid #eee; }
    th { background: #333; color: #fff; }
    tr:hover { background: #f9f9f9; }
  </style>
</head>
<body>
  <h1>BHC 어드민</h1>
  <div class="stats">
    <strong>전체 방:</strong> ${state.rooms.length}개 &nbsp;|&nbsp;
    <strong>빈 WAITING:</strong> ${emptyWaiting.length}개 &nbsp;|&nbsp;
    <strong>빈 FINISHED:</strong> ${emptyFinished.length}개
  </div>
  <div class="actions">
    <form method="POST" action="/djemals">
      <input type="hidden" name="action" value="clean-waiting">
      <button class="btn-warning" type="submit">빈 대기실 삭제 (${emptyWaiting.length}개)</button>
    </form>
    <form method="POST" action="/djemals">
      <input type="hidden" name="action" value="clean-finished">
      <button class="btn-danger" type="submit">종료된 방 삭제 (${emptyFinished.length}개)</button>
    </form>
  </div>
  <table>
    <thead>
      <tr>
        <th>roomId</th>
        <th>title</th>
        <th>state</th>
        <th>members</th>
        <th>createdAt</th>
      </tr>
    </thead>
    <tbody>
      ${rows || '<tr><td colspan="5" style="text-align:center;color:#999">방이 없습니다</td></tr>'}
    </tbody>
  </table>
</body>
</html>`;
}

function deleteRoom(state: AdminLobbyState, roomId: string): void {
  const subscribers = state.roomStreamSubscribers[roomId];
  if (subscribers) {
    for (const sub of subscribers) sub.end();
    delete state.roomStreamSubscribers[roomId];
  }

  delete state.roomStreamSeqByRoomId[roomId];

  const turnTimer = state.turnTimers[roomId];
  if (turnTimer) {
    turnTimer.cancel();
    delete state.turnTimers[roomId];
  }

  const shotTimer = state.shotStateResetTimers[roomId];
  if (shotTimer) {
    clearInterval(shotTimer);
    delete state.shotStateResetTimers[roomId];
  }

  const heartbeatTimer = state.roomHeartbeatTimers[roomId];
  if (heartbeatTimer) {
    clearInterval(heartbeatTimer);
    delete state.roomHeartbeatTimers[roomId];
  }

  const prefix = `${roomId}:`;
  for (const key of Object.keys(state.disconnectGraceTimers)) {
    if (key.startsWith(prefix)) {
      const timer = state.disconnectGraceTimers[key];
      if (timer) clearTimeout(timer);
      delete state.disconnectGraceTimers[key];
    }
  }

  state.rooms = state.rooms.filter((r) => r.roomId !== roomId);
}

export function createAdminRequestHandler(
  state: AdminLobbyState,
): (req: IncomingMessage, res: ServerResponse) => Promise<void> {
  return async (req, res) => {
    if (req.method === 'GET') {
      if (!isAuthenticated(req)) {
        res.statusCode = 200;
        res.setHeader('content-type', 'text/html; charset=utf-8');
        res.end(renderLoginPage());
        return;
      }

      res.statusCode = 200;
      res.setHeader('content-type', 'text/html; charset=utf-8');
      res.end(renderAdminPage(state));
      return;
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const params = parseFormBody(body);
      const action = params['action'];

      if (action === 'login') {
        if (params['username'] === ADMIN_USERNAME && params['password'] === ADMIN_PASSWORD) {
          const token = generateToken();
          activeSessions.add(token);
          res.statusCode = 303;
          res.setHeader('Set-Cookie', `${SESSION_COOKIE_NAME}=${token}; HttpOnly; Path=/djemals; SameSite=Strict`);
          res.setHeader('Location', '/djemals');
          res.end();
        } else {
          res.statusCode = 200;
          res.setHeader('content-type', 'text/html; charset=utf-8');
          res.end(renderLoginPage('아이디 또는 비밀번호가 올바르지 않습니다.'));
        }
        return;
      }

      if (!isAuthenticated(req)) {
        res.statusCode = 303;
        res.setHeader('Location', '/djemals');
        res.end();
        return;
      }

      if (action === 'clean-waiting') {
        const targets = state.rooms.filter((r) => r.state === 'WAITING' && r.members.length === 0);
        for (const room of targets) deleteRoom(state, room.roomId);
      } else if (action === 'clean-finished') {
        const targets = state.rooms.filter((r) => r.state === 'FINISHED' && r.members.length === 0);
        for (const room of targets) deleteRoom(state, room.roomId);
      }

      res.statusCode = 303;
      res.setHeader('Location', '/djemals');
      res.end();
      return;
    }

    res.statusCode = 405;
    res.setHeader('content-type', 'text/plain; charset=utf-8');
    res.end('Method Not Allowed');
  };
}
