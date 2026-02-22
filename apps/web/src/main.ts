import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

const PORT_MIN = 9211;
const PORT_MAX = 9220;
const DEFAULT_WEB_PORT = 9213;
const DEFAULT_AUTH_SERVER_URL = `http://localhost:${PORT_MIN}`;
const DEFAULT_LOBBY_SERVER_URL = `http://localhost:${PORT_MIN + 1}`;

function parsePort(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number(raw) : fallback;

  if (!Number.isInteger(value) || value < PORT_MIN || value > PORT_MAX) {
    throw new Error(`${name} must be an integer in range ${PORT_MIN}-${PORT_MAX}. received: ${raw ?? fallback}`);
  }

  return value;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

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

async function proxyJsonRequest(
  req: IncomingMessage,
  res: ServerResponse,
  targetUrl: string,
  method: 'GET' | 'POST',
  upstreamUnavailableCode: 'AUTH_SERVER_UNAVAILABLE' | 'LOBBY_SERVER_UNAVAILABLE',
): Promise<void> {
  const body = method === 'POST' ? await readBody(req) : '';

  try {
    const upstream = await fetch(targetUrl, {
      method,
      headers: {
        'content-type': 'application/json; charset=utf-8',
      },
      body: method === 'POST' ? body || '{}' : undefined,
    });

    const text = await upstream.text();
    res.statusCode = upstream.status;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(text);
  } catch {
    writeJson(res, 502, { errorCode: upstreamUnavailableCode });
  }
}

function renderLoginPage(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BHC Login</title>
  <style>
    :root {
      --bg: #f4f7fb;
      --surface: #ffffff;
      --text: #111827;
      --muted: #6b7280;
      --line: #d1d5db;
      --primary: #0b5fff;
      --primary-dark: #0a4fe0;
      --ok: #0f766e;
      --error: #b91c1c;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Pretendard", "Noto Sans KR", sans-serif;
      background: radial-gradient(circle at top right, #dbeafe, transparent 40%), var(--bg);
      color: var(--text);
      display: grid;
      place-items: center;
      padding: 24px;
    }
    .card {
      width: min(760px, 100%);
      background: var(--surface);
      border: 1px solid var(--line);
      border-radius: 16px;
      box-shadow: 0 12px 30px rgba(17, 24, 39, 0.08);
      padding: 28px;
    }
    h1 { margin: 0 0 6px; font-size: 28px; }
    .desc { margin: 0 0 20px; color: var(--muted); }
    .grid {
      display: grid;
      gap: 14px;
      grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    }
    .panel {
      border: 1px solid var(--line);
      border-radius: 12px;
      padding: 14px;
      background: #f9fbff;
    }
    .panel h2 {
      margin: 0 0 10px;
      font-size: 16px;
    }
    form { display: grid; gap: 8px; }
    label { font-size: 13px; color: var(--muted); }
    input {
      width: 100%;
      border: 1px solid var(--line);
      border-radius: 8px;
      padding: 10px;
      font-size: 14px;
    }
    button {
      border: 0;
      border-radius: 8px;
      padding: 10px 12px;
      background: var(--primary);
      color: #fff;
      font-weight: 600;
      cursor: pointer;
    }
    button:hover { background: var(--primary-dark); }
    #auth-message {
      margin-top: 16px;
      min-height: 24px;
      font-size: 14px;
      color: var(--muted);
      white-space: pre-wrap;
    }
    #auth-message.ok { color: var(--ok); }
    #auth-message.error { color: var(--error); }
  </style>
</head>
<body>
  <main class="card">
    <h1>BHC 인증</h1>
    <p class="desc">로그인, 회원가입, 게스트 입장을 한 화면에서 처리합니다.</p>
    <section class="grid">
      <article class="panel">
        <h2>로그인</h2>
        <form id="login-form">
          <label for="login-username">아이디</label>
          <input id="login-username" name="username" autocomplete="username" required>
          <label for="login-password">비밀번호</label>
          <input id="login-password" name="password" type="password" autocomplete="current-password" required>
          <button type="submit">로그인</button>
        </form>
      </article>
      <article class="panel">
        <h2>회원가입</h2>
        <form id="signup-form">
          <label for="signup-username">아이디</label>
          <input id="signup-username" name="username" autocomplete="username" required>
          <label for="signup-password">비밀번호</label>
          <input id="signup-password" name="password" type="password" autocomplete="new-password" required>
          <button type="submit">회원가입</button>
        </form>
      </article>
      <article class="panel">
        <h2>게스트 로그인</h2>
        <form id="guest-form">
          <label for="guest-nickname">닉네임</label>
          <input id="guest-nickname" name="nickname" required>
          <button type="submit">게스트 입장</button>
        </form>
      </article>
    </section>
    <p id="auth-message">API 연동 대기 중</p>
  </main>
  <script>
    const message = document.getElementById('auth-message');
    const ERROR_MESSAGES = {
      AUTH_INVALID_INPUT: '입력값이 올바르지 않습니다.',
      AUTH_DUPLICATE_USERNAME: '이미 사용 중인 아이디입니다.',
      AUTH_INVALID_CREDENTIALS: '아이디 또는 비밀번호가 일치하지 않습니다.',
      AUTH_INVALID_JSON: '요청 형식이 잘못되었습니다.',
      AUTH_SERVER_UNAVAILABLE: '인증 서버에 연결할 수 없습니다.',
      NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
      UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
    };

    function setMessage(text, type) {
      message.textContent = text;
      message.className = type || '';
    }

    function getErrorMessage(errorCode) {
      return ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.UNKNOWN_ERROR;
    }

    async function postJson(url, payload) {
      try {
        const response = await fetch(url, {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, status: response.status, data };
      } catch {
        return { ok: false, status: 0, data: { errorCode: 'NETWORK_ERROR' } };
      }
    }

    document.getElementById('signup-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = {
        username: form.username.value,
        password: form.password.value,
      };
      setMessage('회원가입 요청 중...', '');
      const result = await postJson('/api/auth/signup', payload);
      if (!result.ok) {
        const errorCode = result.data.errorCode || 'UNKNOWN_ERROR';
        setMessage('회원가입 실패: ' + getErrorMessage(errorCode), 'error');
        return;
      }
      setMessage('회원가입 성공: ' + result.data.username, 'ok');
    });

    document.getElementById('login-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = {
        username: form.username.value,
        password: form.password.value,
      };
      setMessage('로그인 요청 중...', '');
      const result = await postJson('/api/auth/login', payload);
      if (!result.ok) {
        const errorCode = result.data.errorCode || 'UNKNOWN_ERROR';
        setMessage('로그인 실패: ' + getErrorMessage(errorCode), 'error');
        return;
      }
      localStorage.setItem('bhc_auth', JSON.stringify({
        tokenType: result.data.tokenType,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        userId: result.data.userId,
        username: result.data.username,
      }));
      setMessage('로그인 성공, 로비로 이동합니다.', 'ok');
      window.location.href = '/lobby';
    });

    document.getElementById('guest-form').addEventListener('submit', async (event) => {
      event.preventDefault();
      const form = event.currentTarget;
      const payload = {
        nickname: form.nickname.value,
      };
      setMessage('게스트 로그인 요청 중...', '');
      const result = await postJson('/api/auth/guest', payload);
      if (!result.ok) {
        const errorCode = result.data.errorCode || 'UNKNOWN_ERROR';
        setMessage('게스트 로그인 실패: ' + getErrorMessage(errorCode), 'error');
        return;
      }
      localStorage.setItem('bhc_auth', JSON.stringify({
        tokenType: result.data.tokenType,
        accessToken: result.data.accessToken,
        refreshToken: result.data.refreshToken,
        guestId: result.data.guestId,
        nickname: result.data.nickname,
      }));
      setMessage('게스트 로그인 성공, 로비로 이동합니다.', 'ok');
      window.location.href = '/lobby';
    });
  </script>
</body>
</html>`;
}

function renderLobbyPage(): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BHC Lobby</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Pretendard", "Noto Sans KR", sans-serif;
      background: #f3f6fb;
      color: #111827;
      padding: 24px;
    }
    main {
      width: min(900px, 100%);
      margin: 0 auto;
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 14px;
      padding: 24px;
    }
    .topbar {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      margin-bottom: 12px;
      flex-wrap: wrap;
    }
    .actions {
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    button {
      border: 0;
      border-radius: 8px;
      padding: 10px 12px;
      background: #0b5fff;
      color: #fff;
      cursor: pointer;
    }
    button.secondary {
      background: #334155;
    }
    .create {
      margin: 14px 0;
      display: flex;
      gap: 8px;
      flex-wrap: wrap;
    }
    .create input {
      flex: 1 1 220px;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 10px;
      font-size: 14px;
    }
    .room-list {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
      gap: 10px;
      margin-top: 10px;
    }
    .room {
      border: 1px solid #d1d5db;
      border-radius: 10px;
      padding: 12px;
      background: #f8fafc;
    }
    .room h3 {
      margin: 0 0 6px;
      font-size: 16px;
    }
    .empty {
      border: 1px dashed #cbd5e1;
      border-radius: 10px;
      padding: 16px;
      color: #475569;
    }
    #lobby-message {
      min-height: 22px;
      margin-top: 8px;
      color: #334155;
    }
    #lobby-message.error {
      color: #b91c1c;
    }
  </style>
</head>
<body>
  <main>
    <div class="topbar">
      <div>
        <h1>로비</h1>
        <p id="session-summary">세션 확인 중...</p>
      </div>
      <div class="actions">
        <button id="refresh-btn" class="secondary" type="button">새로고침</button>
        <button id="logout-btn" type="button">로그아웃</button>
      </div>
    </div>
    <form id="create-room-form" class="create">
      <input id="room-title" name="title" maxlength="15" placeholder="방 제목 (최대 15자)" required>
      <button type="submit">방 만들기</button>
    </form>
    <p id="lobby-message"></p>
    <section id="room-list" class="room-list"></section>
  </main>
  <script>
    const sessionRaw = localStorage.getItem('bhc_auth');
    const sessionSummary = document.getElementById('session-summary');
    const logoutBtn = document.getElementById('logout-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const createRoomForm = document.getElementById('create-room-form');
    const roomList = document.getElementById('room-list');
    const roomTitleInput = document.getElementById('room-title');
    const lobbyMessage = document.getElementById('lobby-message');
    const LOBBY_ERROR_MESSAGES = {
      ROOM_TITLE_REQUIRED: '방 제목을 입력해 주세요.',
      ROOM_TITLE_TOO_LONG: '방 제목은 15자 이하만 가능합니다.',
      ROOM_INVALID_JSON: '요청 형식이 올바르지 않습니다.',
      LOBBY_SERVER_UNAVAILABLE: '로비 서버에 연결할 수 없습니다.',
      NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
      UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
    };

    function setLobbyMessage(text, type) {
      lobbyMessage.textContent = text;
      lobbyMessage.className = type === 'error' ? 'error' : '';
    }

    function getLobbyErrorMessage(errorCode) {
      return LOBBY_ERROR_MESSAGES[errorCode] || LOBBY_ERROR_MESSAGES.UNKNOWN_ERROR;
    }

    async function requestJson(url, options) {
      try {
        const response = await fetch(url, options);
        const data = await response.json().catch(() => ({}));
        return { ok: response.ok, status: response.status, data };
      } catch {
        return { ok: false, status: 0, data: { errorCode: 'NETWORK_ERROR' } };
      }
    }

    function renderRooms(items) {
      if (!Array.isArray(items) || items.length === 0) {
        roomList.innerHTML = '<article class="empty">생성된 게임방이 없습니다. 첫 방을 만들어 주세요.</article>';
        return;
      }

      roomList.innerHTML = items
        .map((room) => (
          '<article class="room">' +
          '<h3>' + room.title + '</h3>' +
          '<p>ID: ' + room.roomId + '</p>' +
          '<p>상태: ' + room.state + '</p>' +
          '<p>인원: ' + room.playerCount + '</p>' +
          '</article>'
        ))
        .join('');
    }

    async function loadRooms() {
      const result = await requestJson('/api/lobby/rooms?offset=0&limit=50', { method: 'GET' });
      if (!result.ok) {
        const errorCode = result.data.errorCode || 'UNKNOWN_ERROR';
        setLobbyMessage('방 목록 조회 실패: ' + getLobbyErrorMessage(errorCode), 'error');
        return;
      }

      renderRooms(result.data.items);
      setLobbyMessage('방 목록을 갱신했습니다.', '');
    }

    if (!sessionRaw) {
      window.location.href = '/login';
    } else {
      let parsed = null;
      try {
        parsed = JSON.parse(sessionRaw);
      } catch {
        localStorage.removeItem('bhc_auth');
        window.location.href = '/login';
      }
      if (parsed) {
        const name = parsed.username || parsed.nickname || parsed.userId || parsed.guestId || 'unknown';
        sessionSummary.textContent = '접속 사용자: ' + name;
      }
    }

    createRoomForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const title = roomTitleInput.value;
      const result = await requestJson('/api/lobby/rooms', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ title }),
      });

      if (!result.ok) {
        const errorCode = result.data.errorCode || 'UNKNOWN_ERROR';
        setLobbyMessage('방 생성 실패: ' + getLobbyErrorMessage(errorCode), 'error');
        return;
      }

      roomTitleInput.value = '';
      setLobbyMessage('방을 생성했습니다: ' + result.data.room.title, '');
      await loadRooms();
    });

    refreshBtn.addEventListener('click', async () => {
      await loadRooms();
    });

    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('bhc_auth');
      window.location.href = '/login';
    });

    loadRooms();
  </script>
</body>
</html>`;
}

const webPort = parsePort('WEB_PORT', DEFAULT_WEB_PORT);
const authServerUrl = process.env.AUTH_SERVER_URL || DEFAULT_AUTH_SERVER_URL;
const lobbyServerUrl = process.env.LOBBY_SERVER_URL || DEFAULT_LOBBY_SERVER_URL;

const server = createServer(async (req, res) => {
  if (req.url === '/health') {
    writeJson(res, 200, { ok: true });
    return;
  }

  if (req.method === 'POST' && req.url === '/api/auth/signup') {
    await proxyJsonRequest(req, res, `${authServerUrl}/auth/signup`, 'POST', 'AUTH_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'POST' && req.url === '/api/auth/login') {
    await proxyJsonRequest(req, res, `${authServerUrl}/auth/login`, 'POST', 'AUTH_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'POST' && req.url === '/api/auth/guest') {
    await proxyJsonRequest(req, res, `${authServerUrl}/auth/guest`, 'POST', 'AUTH_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/lobby/rooms')) {
    const url = new URL(req.url, 'http://localhost');
    const query = url.searchParams.toString();
    const target = query.length > 0 ? `${lobbyServerUrl}/lobby/rooms?${query}` : `${lobbyServerUrl}/lobby/rooms`;
    await proxyJsonRequest(req, res, target, 'GET', 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'POST' && req.url === '/api/lobby/rooms') {
    await proxyJsonRequest(req, res, `${lobbyServerUrl}/lobby/rooms`, 'POST', 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.url === '/login') {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(renderLoginPage());
    return;
  }

  if (req.url === '/lobby') {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(renderLobbyPage());
    return;
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html><head><meta charset="utf-8"><title>BHC Web</title></head><body><h1>BHC Web</h1><p>Server is running.</p><a href="/login">/login</a> <a href="/lobby">/lobby</a></body></html>');
});

server.listen(webPort, () => {
  console.log(`[web] listening on http://localhost:${webPort}`);
  console.log(`[web] auth proxy -> ${authServerUrl}`);
  console.log(`[web] lobby proxy -> ${lobbyServerUrl}`);
});

function shutdown(): void {
  server.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
