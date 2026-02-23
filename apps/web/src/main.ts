import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';
import { readFile } from 'node:fs/promises';
import { extname, resolve, sep } from 'node:path';
import { Readable } from 'node:stream';
import { fileURLToPath } from 'node:url';

const PORT_MIN = 9211;
const PORT_MAX = 9220;
const DEFAULT_WEB_PORT = 9213;
const DEFAULT_AUTH_SERVER_URL = `http://localhost:${PORT_MIN}`;
const DEFAULT_LOBBY_SERVER_URL = `http://localhost:${PORT_MIN + 1}`;
const WEB_PUBLIC_ROOT = fileURLToPath(new URL('../public', import.meta.url));

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

async function proxyEventStreamRequest(
  res: ServerResponse,
  targetUrl: string,
  upstreamUnavailableCode: 'LOBBY_SERVER_UNAVAILABLE',
): Promise<void> {
  try {
    const upstream = await fetch(targetUrl, {
      method: 'GET',
      headers: {
        accept: 'text/event-stream',
      },
    });
    if (!upstream.ok) {
      const text = await upstream.text();
      res.statusCode = upstream.status;
      res.setHeader('content-type', upstream.headers.get('content-type') || 'application/json; charset=utf-8');
      res.end(text);
      return;
    }
    if (!upstream.body) {
      writeJson(res, 502, { errorCode: upstreamUnavailableCode });
      return;
    }

    res.statusCode = 200;
    res.setHeader('content-type', upstream.headers.get('content-type') || 'text/event-stream; charset=utf-8');
    res.setHeader('cache-control', 'no-cache, no-transform');
    res.setHeader('connection', 'keep-alive');
    const readable = Readable.fromWeb(upstream.body as globalThis.ReadableStream<Uint8Array>);
    readable.pipe(res);
    const dispose = () => {
      readable.destroy();
    };
    res.on('close', dispose);
  } catch {
    writeJson(res, 502, { errorCode: upstreamUnavailableCode });
  }
}

function getAssetContentType(pathname: string): string {
  const extension = extname(pathname).toLowerCase();
  if (extension === '.png') {
    return 'image/png';
  }
  if (extension === '.jpg' || extension === '.jpeg') {
    return 'image/jpeg';
  }
  if (extension === '.webp') {
    return 'image/webp';
  }
  if (extension === '.svg') {
    return 'image/svg+xml';
  }
  return 'application/octet-stream';
}

async function tryServePublicAsset(req: IncomingMessage, res: ServerResponse): Promise<boolean> {
  if (req.method !== 'GET' || !req.url) {
    return false;
  }

  const { pathname } = new URL(req.url, 'http://localhost');
  if (!pathname.startsWith('/assets/')) {
    return false;
  }

  const absolutePath = resolve(WEB_PUBLIC_ROOT, `.${pathname}`);
  const isInsidePublicRoot = absolutePath === WEB_PUBLIC_ROOT || absolutePath.startsWith(`${WEB_PUBLIC_ROOT}${sep}`);
  if (!isInsidePublicRoot) {
    res.statusCode = 404;
    res.end('Not Found');
    return true;
  }

  try {
    const content = await readFile(absolutePath);
    res.statusCode = 200;
    res.setHeader('content-type', getAssetContentType(pathname));
    res.end(content);
  } catch {
    res.statusCode = 404;
    res.end('Not Found');
  }

  return true;
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
    #room-stage {
      width: 100%;
      max-width: 960px;
      aspect-ratio: 2 / 1;
      border-radius: 12px;
      border: 1px solid #cbd5e1;
      background: #0f172a;
      display: block;
    }
    #stage-message {
      margin-top: 8px;
      color: #334155;
      min-height: 20px;
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
    <p id="room-list-more" style="margin-top: 8px; color: #64748b;"></p>
    <div id="room-list-sentinel" aria-hidden="true" style="height: 1px;"></div>
  </main>
  <script>
    const sessionRaw = localStorage.getItem('bhc_auth');
    const sessionSummary = document.getElementById('session-summary');
    const logoutBtn = document.getElementById('logout-btn');
    const refreshBtn = document.getElementById('refresh-btn');
    const createRoomForm = document.getElementById('create-room-form');
    const roomList = document.getElementById('room-list');
    const roomListMore = document.getElementById('room-list-more');
    const roomListSentinel = document.getElementById('room-list-sentinel');
    const roomTitleInput = document.getElementById('room-title');
    const lobbyMessage = document.getElementById('lobby-message');
    let session = null;
    const LOBBY_PAGE_SIZE = 9;
    const lobbyRoomsState = {
      items: [],
      nextOffset: 0,
      hasMore: true,
      isLoading: false,
      lastRequestedOffset: -1,
    };
    let roomListObserver = null;
    const LOBBY_ERROR_MESSAGES = {
      ROOM_TITLE_REQUIRED: '방 제목을 입력해 주세요.',
      ROOM_TITLE_TOO_LONG: '방 제목은 15자 이하만 가능합니다.',
      ROOM_FULL: '방 인원이 가득 찼습니다.',
      ROOM_IN_GAME: '게임 진행 중인 방은 입장할 수 없습니다.',
      ROOM_NOT_FOUND: '존재하지 않는 방입니다.',
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
        .map((room) => {
          const isBlocked = room.state === 'IN_GAME';
          const joinLabel = isBlocked ? '게임중' : '입장';
          const disabledAttr = isBlocked ? ' disabled aria-disabled="true"' : '';
          return (
            '<article class="room">' +
            '<h3>' + room.title + '</h3>' +
            '<p>ID: ' + room.roomId + '</p>' +
            '<p>상태: ' + room.state + '</p>' +
            '<p>인원: ' + room.playerCount + '</p>' +
            '<button type="button" class="join-room-btn" data-room-id="' + room.roomId + '"' + disabledAttr + '>' +
            joinLabel +
            '</button>' +
            '</article>'
          );
        })
        .join('');
    }

    function updateRoomListMoreText() {
      if (!roomListMore) {
        return;
      }
      if (lobbyRoomsState.isLoading) {
        roomListMore.textContent = '방 목록을 불러오는 중입니다...';
        return;
      }
      if (lobbyRoomsState.items.length === 0) {
        roomListMore.textContent = '';
        return;
      }
      roomListMore.textContent = lobbyRoomsState.hasMore ? '아래로 스크롤하면 더 불러옵니다.' : '모든 방을 불러왔습니다.';
    }

    async function loadRoomsPage(options) {
      const reset = options?.reset === true;
      const showMessage = options?.showMessage === true;
      if (lobbyRoomsState.isLoading) {
        return;
      }

      const offset = reset ? 0 : lobbyRoomsState.nextOffset;
      if (!reset && !lobbyRoomsState.hasMore) {
        return;
      }
      if (!reset && lobbyRoomsState.lastRequestedOffset === offset) {
        return;
      }

      lobbyRoomsState.isLoading = true;
      updateRoomListMoreText();
      lobbyRoomsState.lastRequestedOffset = offset;
      const result = await requestJson('/api/lobby/rooms?offset=' + offset + '&limit=' + LOBBY_PAGE_SIZE, { method: 'GET' });
      lobbyRoomsState.isLoading = false;
      updateRoomListMoreText();
      if (!result.ok) {
        lobbyRoomsState.lastRequestedOffset = -1;
        const errorCode = result.data.errorCode || 'UNKNOWN_ERROR';
        setLobbyMessage('방 목록 조회 실패: ' + getLobbyErrorMessage(errorCode), 'error');
        return;
      }

      const pageItems = Array.isArray(result.data.items) ? result.data.items : [];
      if (reset) {
        lobbyRoomsState.items = pageItems;
      } else if (pageItems.length > 0) {
        const seenRoomIds = new Set(lobbyRoomsState.items.map((item) => item.roomId));
        const deduped = pageItems.filter((item) => !seenRoomIds.has(item.roomId));
        lobbyRoomsState.items = lobbyRoomsState.items.concat(deduped);
      }

      const hasMore = Boolean(result.data.hasMore);
      const nextOffset = Number(result.data.nextOffset);
      lobbyRoomsState.hasMore = hasMore;
      lobbyRoomsState.nextOffset = Number.isFinite(nextOffset)
        ? Math.max(0, Math.floor(nextOffset))
        : lobbyRoomsState.items.length;
      if (lobbyRoomsState.hasMore) {
        lobbyRoomsState.lastRequestedOffset = -1;
      }

      renderRooms(lobbyRoomsState.items);
      updateRoomListMoreText();
      if (showMessage) {
        setLobbyMessage('방 목록을 갱신했습니다.', '');
      }
    }

    function setupRoomListInfiniteScroll() {
      if (!roomListSentinel) {
        return;
      }
      if (roomListObserver) {
        roomListObserver.disconnect();
      }
      roomListObserver = new IntersectionObserver((entries) => {
        const first = entries[0];
        if (!first || !first.isIntersecting) {
          return;
        }
        loadRoomsPage({ reset: false, showMessage: false });
      }, {
        root: null,
        rootMargin: '320px 0px',
        threshold: 0,
      });
      roomListObserver.observe(roomListSentinel);
    }

    async function refreshLoadedRooms() {
      const loadedCount = Math.max(LOBBY_PAGE_SIZE, lobbyRoomsState.items.length || 0);
      if (lobbyRoomsState.isLoading) {
        return;
      }
      lobbyRoomsState.isLoading = true;
      updateRoomListMoreText();
      const result = await requestJson('/api/lobby/rooms?offset=0&limit=' + loadedCount, { method: 'GET' });
      lobbyRoomsState.isLoading = false;
      updateRoomListMoreText();
      if (!result.ok) {
        return;
      }
      const pageItems = Array.isArray(result.data.items) ? result.data.items : [];
      lobbyRoomsState.items = pageItems;
      const hasMore = Boolean(result.data.hasMore);
      const nextOffset = Number(result.data.nextOffset);
      lobbyRoomsState.hasMore = hasMore;
      lobbyRoomsState.nextOffset = Number.isFinite(nextOffset)
        ? Math.max(0, Math.floor(nextOffset))
        : pageItems.length;
      lobbyRoomsState.lastRequestedOffset = -1;
      renderRooms(lobbyRoomsState.items);
      updateRoomListMoreText();
    }

    if (!sessionRaw) {
      window.location.href = '/login';
    } else {
      try {
        session = JSON.parse(sessionRaw);
      } catch {
        localStorage.removeItem('bhc_auth');
        window.location.href = '/login';
      }
      if (session) {
        const name = session.username || session.nickname || session.userId || session.guestId || 'unknown';
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
      await loadRoomsPage({ reset: true, showMessage: false });
    });

    roomList.addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }

      if (!target.classList.contains('join-room-btn')) {
        return;
      }

      const roomId = target.dataset.roomId;
      if (!roomId) {
        return;
      }

      const memberId = session?.userId ? String(session.userId) : (session?.guestId || '');
      const displayName = session?.username || session?.nickname || memberId || 'guest';
      const result = await requestJson('/api/lobby/rooms/' + roomId + '/join', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ memberId, displayName }),
      });

      if (!result.ok) {
        const errorCode = result.data.errorCode || 'UNKNOWN_ERROR';
        setLobbyMessage('방 입장 실패: ' + getLobbyErrorMessage(errorCode), 'error');
        return;
      }

      window.location.href = '/room/' + roomId;
    });

    refreshBtn.addEventListener('click', async () => {
      await loadRoomsPage({ reset: true, showMessage: true });
    });

    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('bhc_auth');
      window.location.href = '/login';
    });

    setupRoomListInfiniteScroll();
    loadRoomsPage({ reset: true, showMessage: true });
    setInterval(refreshLoadedRooms, 3000);
  </script>
</body>
</html>`;
}

function renderRoomPage(roomId: string): string {
  return `<!doctype html>
<html lang="ko">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>BHC Room</title>
  <style>
    body {
      margin: 0;
      min-height: 100vh;
      font-family: "Pretendard", "Noto Sans KR", sans-serif;
      background: #eef2ff;
      color: #111827;
      padding: 24px;
    }
    main {
      width: min(980px, 100%);
      margin: 0 auto;
      background: #fff;
      border: 1px solid #d1d5db;
      border-radius: 14px;
      padding: 24px;
    }
    .top {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      margin-bottom: 14px;
    }
    .grid {
      display: grid;
      grid-template-columns: 1.2fr 1fr;
      gap: 14px;
    }
    @media (max-width: 900px) {
      .grid {
        grid-template-columns: 1fr;
      }
    }
    .panel {
      border: 1px solid #d1d5db;
      border-radius: 12px;
      padding: 14px;
      background: #f8fafc;
    }
    .panel h2 {
      margin: 0 0 10px;
      font-size: 17px;
    }
    .pill {
      display: inline-block;
      background: #e0e7ff;
      color: #3730a3;
      font-weight: 700;
      font-size: 12px;
      border-radius: 999px;
      padding: 4px 8px;
      margin-left: 8px;
    }
    .members {
      display: grid;
      gap: 8px;
    }
    .member {
      border: 1px solid #cbd5e1;
      border-radius: 10px;
      padding: 10px;
      background: #fff;
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 8px;
    }
    .member-actions {
      display: flex;
      gap: 6px;
      align-items: center;
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
      font-weight: 600;
    }
    button.secondary {
      background: #334155;
    }
    button[disabled] {
      opacity: 0.5;
      cursor: not-allowed;
    }
    #room-message {
      min-height: 22px;
      margin-top: 10px;
      color: #334155;
    }
    #room-message.error {
      color: #b91c1c;
    }
    a {
      color: #0b5fff;
      text-decoration: none;
      font-weight: 600;
    }
  </style>
</head>
<body>
  <main>
    <div class="top">
      <div>
        <h1>게임방</h1>
        <p>방 ID: <strong id="room-id">${roomId}</strong></p>
        <p id="flow-banner"></p>
      </div>
      <div class="actions">
        <button id="refresh-room-btn" class="secondary" type="button">새로고침</button>
        <a href="/lobby">로비로 돌아가기</a>
      </div>
    </div>
    <section class="grid">
      <article class="panel">
        <h2>방 정보</h2>
        <p>제목: <strong id="room-title">-</strong></p>
        <p>상태: <strong id="room-state">-</strong></p>
        <p>인원: <strong id="room-player-count">-</strong></p>
        <p>방장: <strong id="room-host">-</strong></p>
        <p>생성시각: <strong id="room-created-at">-</strong></p>
      </article>
      <article class="panel">
        <h2>방 액션</h2>
        <div class="actions">
          <button id="start-btn" type="button" disabled>게임 시작</button>
          <button id="rematch-btn" type="button" disabled>재경기</button>
          <button id="leave-btn" class="secondary" type="button">나가기</button>
        </div>
        <p id="room-message">ROOM-ACTION-001: 방 액션 API 연결 중...</p>
      </article>
    </section>
    <section class="panel" style="margin-top: 14px;">
      <h2>참가자 목록</h2>
      <div id="members" class="members"></div>
    </section>
    <section class="panel" style="margin-top: 14px;">
      <h2>테이블 스테이지</h2>
      <canvas id="room-stage" width="1200" height="600" aria-label="billiards-table-stage"></canvas>
      <p id="stage-message">ROOM-UI-002A: 테이블 이미지 로딩 중...</p>
    </section>
    <section class="panel" style="margin-top: 14px;">
      <h2>인게임 HUD</h2>
      <p>현재 턴: <strong id="hud-turn">-</strong></p>
      <p>턴 타이머: <strong id="hud-timer">10</strong>초</p>
      <div id="hud-scoreboard" class="members"></div>
    </section>
    <section class="panel" style="margin-top: 14px;">
      <h2>샷 입력</h2>
      <form id="shot-form" class="create">
        <input id="shot-direction" type="number" min="0" max="359.99" step="0.01" value="120" required>
        <input id="shot-elevation" type="number" min="0" max="89" step="0.01" value="10" required>
        <input id="shot-drag" type="number" min="10" max="400" step="1" value="300" required>
        <button type="submit">샷 제출</button>
      </form>
      <p id="impact-indicator" style="margin: 6px 0 0; color: #475569;">당점: X 0.00R / Y 0.00R (W/A/S/D)</p>
      <p id="shot-message"></p>
      <pre id="shot-errors" style="white-space: pre-wrap;"></pre>
    </section>
    <section class="panel" style="margin-top: 14px;">
      <h2>채팅</h2>
      <div id="chat-list" class="members"></div>
      <form id="chat-form" class="create" style="margin-top: 10px;">
        <input id="chat-input" maxlength="120" placeholder="메시지를 입력하세요" required>
        <button type="submit">전송</button>
      </form>
    </section>
  </main>
  <script>
    const sessionRaw = localStorage.getItem('bhc_auth');
    const refreshBtn = document.getElementById('refresh-room-btn');
    const leaveBtn = document.getElementById('leave-btn');
    const startBtn = document.getElementById('start-btn');
    const rematchBtn = document.getElementById('rematch-btn');
    const roomMessage = document.getElementById('room-message');
    const flowBanner = document.getElementById('flow-banner');
    const chatList = document.getElementById('chat-list');
    const chatForm = document.getElementById('chat-form');
    const chatInput = document.getElementById('chat-input');
    const roomStage = document.getElementById('room-stage');
    const stageMessage = document.getElementById('stage-message');
    const hudTurn = document.getElementById('hud-turn');
    const hudTimer = document.getElementById('hud-timer');
    const hudScoreboard = document.getElementById('hud-scoreboard');
    const shotForm = document.getElementById('shot-form');
    const shotDirection = document.getElementById('shot-direction');
    const shotElevation = document.getElementById('shot-elevation');
    const shotDrag = document.getElementById('shot-drag');
    const impactIndicator = document.getElementById('impact-indicator');
    const shotMessage = document.getElementById('shot-message');
    const shotErrors = document.getElementById('shot-errors');
    let roomStream = null;
    let streamMemberId = null;
    let myMemberId = null;
    let currentTurnDeadlineMs = null;
    let currentRoomState = 'WAITING';
    let currentTurnMemberId = null;
    const cueBallAnchor = { x: 0.70, y: 0.71 };
    const cueBallRadiusM = 0.0615 / 2;
    const impactOffsetLimitR = 0.9;
    const impactOffsetStepR = 0.05;
    const MIN_STROKE_PX = 10;
    const MAX_STROKE_PX = 400;
    const impactOffsetState = { x: 0, y: 0 };
    const aimInputState = {
      mode: 'idle',
      pointerId: -1,
      startX: 0,
      startY: 0,
    };
    const dragInputState = {
      active: false,
      pointerId: -1,
      startX: 0,
      startY: 0,
    };
    let shotSubmitInFlight = false;
    let shotInputLocked = false;
    const TABLE_WORLD_WIDTH_M = 2.84;
    const TABLE_WORLD_HEIGHT_M = 1.42;
    const stageState = {
      context: null,
      image: null,
      imageLoaded: false,
      animationFrameId: 0,
      lastSnapshotSeq: 0,
      snapshotBuffer: [],
      renderedBalls: [],
      viewport: {
        offsetX: 0,
        offsetY: 0,
        width: 0,
        height: 0,
      },
      dpr: 1,
    };
    const ROOM_ERROR_MESSAGES = {
      ROOM_HOST_ONLY: '방장만 실행할 수 있습니다.',
      ROOM_MEMBER_NOT_FOUND: '대상을 찾을 수 없습니다.',
      ROOM_CANNOT_KICK_SELF: '자기 자신은 강퇴할 수 없습니다.',
      GAME_ALREADY_STARTED: '이미 게임이 시작되었습니다.',
      GAME_NOT_ENOUGH_PLAYERS: '최소 2명 이상이 필요합니다.',
      CHAT_INVALID_INPUT: '채팅 메시지를 입력해 주세요.',
      CHAT_RATE_LIMITED: '채팅 전송이 너무 빠릅니다.',
      SHOT_INPUT_SCHEMA_INVALID: '샷 입력값이 스키마 규칙과 맞지 않습니다.',
      SHOT_STATE_CONFLICT: '이미 진행 중인 샷이 있어 현재 입력을 받을 수 없습니다.',
      ROOM_NOT_FOUND: '방을 찾을 수 없습니다.',
      NETWORK_ERROR: '네트워크 오류가 발생했습니다.',
      UNKNOWN_ERROR: '알 수 없는 오류가 발생했습니다.',
    };

    function setRoomMessage(text, type) {
      roomMessage.textContent = text;
      roomMessage.className = type === 'error' ? 'error' : '';
    }

    function setFlowBanner(text, tone) {
      flowBanner.textContent = text;
      flowBanner.style.color = tone === 'warn' ? '#b91c1c' : '#334155';
      flowBanner.style.fontWeight = '700';
    }

    function setShotMessage(text, type) {
      shotMessage.textContent = text;
      shotMessage.style.color = type === 'error' ? '#b91c1c' : '#334155';
      if (type !== 'error') {
        shotErrors.textContent = '';
      }
    }

    function setShotValidationDetails(errorCode, details) {
      const header = errorCode ? '[errorCode] ' + errorCode : '[errorCode] UNKNOWN_ERROR';
      if (!Array.isArray(details) || details.length === 0) {
        shotErrors.textContent = header;
        return;
      }
      const lines = details.map((detail, index) => {
        const text = String(detail);
        if (text.includes('dragPx')) {
          return (index + 1) + '. dragPx 범위를 확인해 주세요: ' + text;
        }
        if (text.includes('shotDirectionDeg')) {
          return (index + 1) + '. 방향값 범위를 확인해 주세요: ' + text;
        }
        if (text.includes('cueElevationDeg')) {
          return (index + 1) + '. 고각값 범위를 확인해 주세요: ' + text;
        }
        return (index + 1) + '. ' + text;
      });
      shotErrors.textContent = [header, ...lines].join('\\n');
    }

    function getRemainingTurnSeconds(turnDeadlineMs) {
      if (!Number.isFinite(turnDeadlineMs)) {
        return 10;
      }
      const remainingMs = Math.max(0, turnDeadlineMs - Date.now());
      return Math.ceil(remainingMs / 1000);
    }

    function setStageMessage(text, isError) {
      stageMessage.textContent = text;
      stageMessage.style.color = isError ? '#b91c1c' : '#334155';
    }

    function updateImpactIndicator() {
      if (!impactIndicator) {
        return;
      }
      impactIndicator.textContent =
        '당점: X ' + impactOffsetState.x.toFixed(2) + 'R / Y ' + impactOffsetState.y.toFixed(2) + 'R (W/A/S/D)';
    }

    function updateImpactOffset(nextX, nextY) {
      const length = Math.sqrt(nextX * nextX + nextY * nextY);
      if (length > impactOffsetLimitR) {
        const scale = impactOffsetLimitR / length;
        impactOffsetState.x = nextX * scale;
        impactOffsetState.y = nextY * scale;
      } else {
        impactOffsetState.x = nextX;
        impactOffsetState.y = nextY;
      }
      updateImpactIndicator();
      renderStageFrame();
    }

    function updateShotInputLockUi() {
      const disabled = shotSubmitInFlight || shotInputLocked;
      shotDirection.disabled = disabled;
      shotElevation.disabled = disabled;
      shotDrag.disabled = disabled;
      const submitButton = shotForm.querySelector('button[type="submit"]');
      if (submitButton) {
        submitButton.disabled = disabled;
      }
    }

    function canStartAiming() {
      return !shotSubmitInFlight
        && !shotInputLocked
        && currentRoomState === 'IN_GAME'
        && Boolean(myMemberId)
        && Boolean(currentTurnMemberId)
        && String(currentTurnMemberId) === String(myMemberId);
    }

    function setAimMode(nextMode) {
      aimInputState.mode = nextMode;
      if (roomStage instanceof HTMLCanvasElement) {
        roomStage.dataset.aimMode = nextMode;
        roomStage.style.cursor = nextMode === 'aiming' ? 'grabbing' : 'pointer';
      }
    }

    function updateStageViewport() {
      const contentWidth = roomStage.width;
      const contentHeight = roomStage.height;
      const tableAspect = TABLE_WORLD_WIDTH_M / TABLE_WORLD_HEIGHT_M;
      const contentAspect = contentWidth / contentHeight;
      if (contentAspect > tableAspect) {
        stageState.viewport.height = contentHeight;
        stageState.viewport.width = contentHeight * tableAspect;
        stageState.viewport.offsetX = (contentWidth - stageState.viewport.width) / 2;
        stageState.viewport.offsetY = 0;
        return;
      }
      stageState.viewport.width = contentWidth;
      stageState.viewport.height = contentWidth / tableAspect;
      stageState.viewport.offsetX = 0;
      stageState.viewport.offsetY = (contentHeight - stageState.viewport.height) / 2;
    }

    function worldToCanvas(point) {
      return {
        x: stageState.viewport.offsetX + (point.x / TABLE_WORLD_WIDTH_M) * stageState.viewport.width,
        y: stageState.viewport.offsetY + (point.y / TABLE_WORLD_HEIGHT_M) * stageState.viewport.height,
      };
    }

    function canvasToWorld(point) {
      const x = (point.x - stageState.viewport.offsetX) / stageState.viewport.width;
      const y = (point.y - stageState.viewport.offsetY) / stageState.viewport.height;
      return {
        x: Math.max(0, Math.min(TABLE_WORLD_WIDTH_M, x * TABLE_WORLD_WIDTH_M)),
        y: Math.max(0, Math.min(TABLE_WORLD_HEIGHT_M, y * TABLE_WORLD_HEIGHT_M)),
      };
    }

    function resizeStageCanvas() {
      const dpr = Math.max(1, window.devicePixelRatio || 1);
      const cssWidth = Math.max(320, Math.floor(roomStage.clientWidth));
      const cssHeight = Math.max(160, Math.floor(roomStage.clientHeight));
      roomStage.width = Math.floor(cssWidth * dpr);
      roomStage.height = Math.floor(cssHeight * dpr);
      stageState.dpr = dpr;
      updateStageViewport();
    }

    function drawStageFallback(context) {
      const width = roomStage.width;
      const height = roomStage.height;
      context.clearRect(0, 0, width, height);
      context.fillStyle = '#0f172a';
      context.fillRect(0, 0, width, height);
      context.fillStyle = '#155e75';
      context.fillRect(
        stageState.viewport.offsetX,
        stageState.viewport.offsetY,
        stageState.viewport.width,
        stageState.viewport.height,
      );
      context.strokeStyle = '#94a3b8';
      context.lineWidth = 4;
      context.strokeRect(
        stageState.viewport.offsetX,
        stageState.viewport.offsetY,
        stageState.viewport.width,
        stageState.viewport.height,
      );
    }

    function interpolateSnapshots(previous, next, alpha) {
      const nextById = new Map(next.balls.map((ball) => [ball.id, ball]));
      return previous.balls.map((ball) => {
        const matched = nextById.get(ball.id) || ball;
        return {
          id: ball.id,
          x: ball.x + (matched.x - ball.x) * alpha,
          y: ball.y + (matched.y - ball.y) * alpha,
          radiusM: ball.radiusM,
          color: ball.color,
        };
      });
    }

    function drawBalls(balls) {
      const context = stageState.context;
      if (!context) {
        return;
      }
      const pixelsPerMeter = stageState.viewport.width / TABLE_WORLD_WIDTH_M;
      for (const ball of balls) {
        const center = worldToCanvas({ x: ball.x, y: ball.y });
        const radiusPx = Math.max(2, ball.radiusM * pixelsPerMeter);
        context.beginPath();
        context.arc(center.x, center.y, radiusPx, 0, Math.PI * 2);
        context.fillStyle = ball.color;
        context.fill();
        context.lineWidth = 1.5;
        context.strokeStyle = '#0f172a';
        context.stroke();
      }
    }

    function drawImpactOverlay() {
      const context = stageState.context;
      if (!context) {
        return;
      }
      const center = worldToCanvas(cueBallAnchor);
      const overlayRadiusPx = (cueBallRadiusM / TABLE_WORLD_WIDTH_M) * stageState.viewport.width;
      const offsetPoint = worldToCanvas({
        x: cueBallAnchor.x + impactOffsetState.x * cueBallRadiusM,
        y: cueBallAnchor.y + impactOffsetState.y * cueBallRadiusM,
      });

      context.save();
      context.strokeStyle = 'rgba(148, 163, 184, 0.9)';
      context.lineWidth = 1.5;
      context.beginPath();
      context.arc(center.x, center.y, overlayRadiusPx, 0, Math.PI * 2);
      context.stroke();
      context.beginPath();
      context.moveTo(center.x - overlayRadiusPx, center.y);
      context.lineTo(center.x + overlayRadiusPx, center.y);
      context.moveTo(center.x, center.y - overlayRadiusPx);
      context.lineTo(center.x, center.y + overlayRadiusPx);
      context.stroke();
      context.fillStyle = '#ef4444';
      context.beginPath();
      context.arc(offsetPoint.x, offsetPoint.y, 4, 0, Math.PI * 2);
      context.fill();
      context.restore();
    }

    function getCueBallWorldPosition() {
      if (Array.isArray(stageState.renderedBalls) && stageState.renderedBalls.length > 0) {
        const cueBall = stageState.renderedBalls.find((ball) => ball.id === 'cueBall');
        if (cueBall && Number.isFinite(cueBall.x) && Number.isFinite(cueBall.y)) {
          return { x: cueBall.x, y: cueBall.y };
        }
      }
      return cueBallAnchor;
    }

    function computeFirstCushionIntersection(origin, direction) {
      const minX = cueBallRadiusM;
      const maxX = TABLE_WORLD_WIDTH_M - cueBallRadiusM;
      const minY = cueBallRadiusM;
      const maxY = TABLE_WORLD_HEIGHT_M - cueBallRadiusM;
      const epsilon = 1e-6;
      let bestDistance = Number.POSITIVE_INFINITY;
      let bestPoint = null;
      let bestType = '';

      if (Math.abs(direction.x) > epsilon) {
        const targetX = direction.x > 0 ? maxX : minX;
        const t = (targetX - origin.x) / direction.x;
        if (t > 0) {
          const y = origin.y + direction.y * t;
          if (y >= minY && y <= maxY && t < bestDistance) {
            bestDistance = t;
            bestPoint = { x: targetX, y };
            bestType = 'cushion-x';
          }
        }
      }
      if (Math.abs(direction.y) > epsilon) {
        const targetY = direction.y > 0 ? maxY : minY;
        const t = (targetY - origin.y) / direction.y;
        if (t > 0) {
          const x = origin.x + direction.x * t;
          if (x >= minX && x <= maxX && t < bestDistance) {
            bestDistance = t;
            bestPoint = { x, y: targetY };
            bestType = 'cushion-y';
          }
        }
      }
      if (!bestPoint) {
        return null;
      }
      return {
        hitType: bestType,
        distanceM: bestDistance,
        point: bestPoint,
      };
    }

    function computeFirstObjectBallIntersection(origin, direction, cueBallRadius) {
      if (!Array.isArray(stageState.renderedBalls) || stageState.renderedBalls.length === 0) {
        return null;
      }
      const epsilon = 1e-6;
      let bestHit = null;
      for (const ball of stageState.renderedBalls) {
        if (!ball || ball.id === 'cueBall') {
          continue;
        }
        const targetRadius = Number.isFinite(ball.radiusM) && ball.radiusM > 0 ? ball.radiusM : cueBallRadius;
        const combinedRadius = cueBallRadius + targetRadius;
        const relX = origin.x - ball.x;
        const relY = origin.y - ball.y;
        const dot = relX * direction.x + relY * direction.y;
        const c = relX * relX + relY * relY - combinedRadius * combinedRadius;
        const discriminant = dot * dot - c;
        if (discriminant < 0) {
          continue;
        }
        const sqrtD = Math.sqrt(discriminant);
        let t = -dot - sqrtD;
        if (t <= epsilon) {
          t = -dot + sqrtD;
        }
        if (t <= epsilon) {
          continue;
        }
        if (!bestHit || t < bestHit.distanceM) {
          bestHit = {
            hitType: 'object-ball',
            distanceM: t,
            point: {
              x: origin.x + direction.x * t,
              y: origin.y + direction.y * t,
            },
            targetBallId: ball.id,
          };
        }
      }
      return bestHit;
    }

    function drawCueStickOverlay() {
      if (aimInputState.mode !== 'aiming') {
        return;
      }
      const context = stageState.context;
      if (!context) {
        return;
      }
      const cueBall = getCueBallWorldPosition();
      const directionDeg = Number(shotDirection.value);
      if (!Number.isFinite(directionDeg)) {
        return;
      }
      const directionRad = (directionDeg * Math.PI) / 180;
      const unitX = Math.cos(directionRad);
      const unitY = Math.sin(directionRad);
      const cueBallCanvas = worldToCanvas(cueBall);
      const pixelsPerMeter = stageState.viewport.width / TABLE_WORLD_WIDTH_M;
      const cueBallRadiusPx = cueBallRadiusM * pixelsPerMeter;
      const dragPx = Number(shotDrag.value);
      const dragRatio = clampNumber(
        (Number.isFinite(dragPx) ? dragPx : MIN_STROKE_PX) / MAX_STROKE_PX,
        MIN_STROKE_PX / MAX_STROKE_PX,
        1,
      );

      const tipDistancePx = cueBallRadiusPx + 10;
      const stickLengthPx = 120 + dragRatio * 100;
      const backDistancePx = tipDistancePx + stickLengthPx;
      const firstCushionHit = computeFirstCushionIntersection(cueBall, { x: unitX, y: unitY });
      const firstObjectBallHit = computeFirstObjectBallIntersection(cueBall, { x: unitX, y: unitY }, cueBallRadiusM);
      const firstHit = !firstCushionHit
        ? firstObjectBallHit
        : !firstObjectBallHit
          ? firstCushionHit
          : (firstObjectBallHit.distanceM <= firstCushionHit.distanceM ? firstObjectBallHit : firstCushionHit);

      const tipX = cueBallCanvas.x - unitX * tipDistancePx;
      const tipY = cueBallCanvas.y - unitY * tipDistancePx;
      const buttX = cueBallCanvas.x - unitX * backDistancePx;
      const buttY = cueBallCanvas.y - unitY * backDistancePx;

      context.save();
      context.setLineDash([]);
      context.lineCap = 'round';
      context.lineWidth = 10;
      context.strokeStyle = '#8b5a2b';
      context.beginPath();
      context.moveTo(buttX, buttY);
      context.lineTo(tipX, tipY);
      context.stroke();

      context.lineWidth = 3;
      context.strokeStyle = '#f8fafc';
      context.beginPath();
      context.moveTo(tipX, tipY);
      context.lineTo(cueBallCanvas.x - unitX * (cueBallRadiusPx + 2), cueBallCanvas.y - unitY * (cueBallRadiusPx + 2));
      context.stroke();

      context.setLineDash([8, 6]);
      context.lineWidth = 2;
      context.strokeStyle = 'rgba(248, 250, 252, 0.8)';
      context.beginPath();
      context.moveTo(cueBallCanvas.x, cueBallCanvas.y);
      if (firstHit) {
        const hitCanvas = worldToCanvas(firstHit.point);
        context.lineTo(hitCanvas.x, hitCanvas.y);
      } else {
        context.lineTo(cueBallCanvas.x + unitX * 220, cueBallCanvas.y + unitY * 220);
      }
      context.stroke();
      context.restore();
    }

    function createDefaultStageSnapshot(seq, timestampMs) {
      return {
        seq,
        serverTimeMs: timestampMs,
        balls: [
          { id: 'cueBall', x: 0.70, y: 0.71, radiusM: 0.03075, color: '#f8fafc' },
          { id: 'objectBall1', x: 2.10, y: 0.62, radiusM: 0.03075, color: '#facc15' },
          { id: 'objectBall2', x: 2.24, y: 0.80, radiusM: 0.03075, color: '#ef4444' },
        ],
      };
    }

    function normalizeStageBall(ball) {
      if (!ball || typeof ball !== 'object') {
        return null;
      }
      const id = typeof ball.id === 'string' ? ball.id : '';
      const fallbackById = {
        cueBall: { radiusM: 0.03075, color: '#f8fafc' },
        objectBall1: { radiusM: 0.03075, color: '#facc15' },
        objectBall2: { radiusM: 0.03075, color: '#ef4444' },
      };
      const fallback = fallbackById[id] || { radiusM: 0.03075, color: '#e5e7eb' };
      return {
        id,
        x: Number.isFinite(ball.x) ? ball.x : 0,
        y: Number.isFinite(ball.y) ? ball.y : 0,
        radiusM: Number.isFinite(ball.radiusM) && ball.radiusM > 0 ? ball.radiusM : fallback.radiusM,
        color: typeof ball.color === 'string' && ball.color.length > 0 ? ball.color : fallback.color,
      };
    }

    function pushStageSnapshot(snapshot) {
      if (!snapshot || !Array.isArray(snapshot.balls)) {
        return;
      }
      if (typeof snapshot.seq === 'number' && snapshot.seq <= stageState.lastSnapshotSeq) {
        return;
      }
      const normalizedBalls = snapshot.balls
        .map((ball) => normalizeStageBall(ball))
        .filter((ball) => ball !== null);
      if (normalizedBalls.length === 0) {
        return;
      }
      stageState.lastSnapshotSeq = typeof snapshot.seq === 'number' ? snapshot.seq : stageState.lastSnapshotSeq + 1;
      stageState.snapshotBuffer.push({
        seq: typeof snapshot.seq === 'number' ? snapshot.seq : stageState.lastSnapshotSeq,
        serverTimeMs: Number.isFinite(snapshot.serverTimeMs) ? snapshot.serverTimeMs : Date.now(),
        balls: normalizedBalls,
      });
      if (stageState.snapshotBuffer.length > 6) {
        stageState.snapshotBuffer.shift();
      }
    }

    function renderInterpolatedBalls() {
      if (stageState.snapshotBuffer.length === 0) {
        stageState.renderedBalls = [];
        return;
      }
      if (stageState.snapshotBuffer.length === 1) {
        stageState.renderedBalls = stageState.snapshotBuffer[0].balls;
        drawBalls(stageState.renderedBalls);
        return;
      }
      const interpolationDelayMs = 100;
      const renderTimeMs = Date.now() - interpolationDelayMs;
      while (
        stageState.snapshotBuffer.length >= 2 &&
        stageState.snapshotBuffer[1].serverTimeMs <= renderTimeMs
      ) {
        stageState.snapshotBuffer.shift();
      }
      const previous = stageState.snapshotBuffer[0];
      const next = stageState.snapshotBuffer[1] || previous;
      const span = Math.max(1, next.serverTimeMs - previous.serverTimeMs);
      const alpha = Math.max(0, Math.min(1, (renderTimeMs - previous.serverTimeMs) / span));
      stageState.renderedBalls = interpolateSnapshots(previous, next, alpha);
      drawBalls(stageState.renderedBalls);
    }

    function renderStageFrame() {
      const context = stageState.context;
      if (!context) {
        return;
      }
      if (!stageState.imageLoaded || !stageState.image) {
        drawStageFallback(context);
        return;
      }
      context.clearRect(0, 0, roomStage.width, roomStage.height);
      context.drawImage(
        stageState.image,
        stageState.viewport.offsetX,
        stageState.viewport.offsetY,
        stageState.viewport.width,
        stageState.viewport.height,
      );
      renderInterpolatedBalls();
      drawCueStickOverlay();
      drawImpactOverlay();
    }

    function runStageRenderLoop() {
      renderStageFrame();
      stageState.animationFrameId = window.requestAnimationFrame(runStageRenderLoop);
    }

    function seedStageSnapshots() {
      const now = Date.now();
      pushStageSnapshot(createDefaultStageSnapshot(1, now - 50));
      pushStageSnapshot(createDefaultStageSnapshot(2, now));
    }

    function clampNumber(value, min, max) {
      if (value < min) {
        return min;
      }
      if (value > max) {
        return max;
      }
      return value;
    }

    function normalizeStrokeDragPx(value) {
      const finiteValue = Number.isFinite(value) ? value : MIN_STROKE_PX;
      const roundedValue = Math.round(finiteValue);
      return clampNumber(roundedValue, MIN_STROKE_PX, MAX_STROKE_PX);
    }

    function updateShotInputsFromPointer(localX, localY) {
      const worldPoint = canvasToWorld({ x: localX, y: localY });
      const dx = worldPoint.x - cueBallAnchor.x;
      const dy = worldPoint.y - cueBallAnchor.y;
      const directionDeg = ((Math.atan2(dy, dx) * 180) / Math.PI + 360) % 360;
      shotDirection.value = directionDeg.toFixed(2);
      roomStage.dataset.worldX = worldPoint.x.toFixed(3);
      roomStage.dataset.worldY = worldPoint.y.toFixed(3);
    }

    function initRoomStage() {
      if (!(roomStage instanceof HTMLCanvasElement)) {
        return;
      }
      const context = roomStage.getContext('2d');
      if (!context) {
        setStageMessage('캔버스 컨텍스트를 초기화하지 못했습니다.', true);
        return;
      }

      stageState.context = context;
      resizeStageCanvas();
      drawStageFallback(context);
      seedStageSnapshots();
      const image = new Image();
      stageState.image = image;
      image.onload = () => {
        stageState.imageLoaded = true;
        renderStageFrame();
        const originCanvas = worldToCanvas({ x: 0, y: 0 });
        setStageMessage(
          '테이블 렌더 준비 완료 (DPR ' + stageState.dpr.toFixed(2) + ', origin=' + originCanvas.x.toFixed(1) + ',' + originCanvas.y.toFixed(1) + ')',
          false,
        );
      };
      image.onerror = () => {
        stageState.imageLoaded = false;
        drawStageFallback(context);
        setStageMessage('테이블 이미지 로드에 실패했습니다. 기본 스테이지를 표시합니다.', true);
      };
      image.src = '/assets/table/table-top.png';
      window.addEventListener('resize', () => {
        resizeStageCanvas();
        renderStageFrame();
      });
      roomStage.addEventListener('pointerdown', (event) => {
        if (!canStartAiming()) {
          setAimMode('idle');
          setStageMessage('현재는 조준할 수 없습니다. 내 턴에만 조준이 가능합니다.', true);
          return;
        }
        const bounds = roomStage.getBoundingClientRect();
        setAimMode('aiming');
        aimInputState.pointerId = event.pointerId;
        aimInputState.startX = (event.clientX - bounds.left) * stageState.dpr;
        aimInputState.startY = (event.clientY - bounds.top) * stageState.dpr;
        dragInputState.active = true;
        dragInputState.pointerId = event.pointerId;
        dragInputState.startX = aimInputState.startX;
        dragInputState.startY = aimInputState.startY;
        updateShotInputsFromPointer(dragInputState.startX, dragInputState.startY);
        roomStage.setPointerCapture(event.pointerId);
      });
      roomStage.addEventListener('pointermove', (event) => {
        const bounds = roomStage.getBoundingClientRect();
        const localX = (event.clientX - bounds.left) * stageState.dpr;
        const localY = (event.clientY - bounds.top) * stageState.dpr;
        updateShotInputsFromPointer(localX, localY);
        if (!dragInputState.active || dragInputState.pointerId !== event.pointerId) {
          return;
        }
        const dragDistancePx = Math.hypot(localX - dragInputState.startX, localY - dragInputState.startY) / stageState.dpr;
        const normalizedDrag = normalizeStrokeDragPx(dragDistancePx);
        shotDrag.value = String(normalizedDrag);
        setStageMessage('캔버스 입력: 방향 ' + shotDirection.value + '도, drag ' + normalizedDrag + 'px', false);
      });
      roomStage.addEventListener('mousemove', (event) => {
        if (dragInputState.active) {
          return;
        }
        const delta = Number(event.movementY) || 0;
        if (delta === 0) {
          return;
        }
        const nextElevation = clampNumber(
          Number(shotElevation.value) - delta * 0.08,
          Number(shotElevation.min || 0),
          Number(shotElevation.max || 89),
        );
        shotElevation.value = nextElevation.toFixed(2);
      });
      roomStage.addEventListener('pointerup', async (event) => {
        if (!dragInputState.active || dragInputState.pointerId !== event.pointerId) {
          return;
        }
        dragInputState.active = false;
        setAimMode('shotPending');
        roomStage.releasePointerCapture(event.pointerId);
        const submitted = await submitShotInput('canvas-drag');
        if (!submitted) {
          setAimMode('idle');
        }
      });
      roomStage.addEventListener('pointercancel', (event) => {
        if (!dragInputState.active || dragInputState.pointerId !== event.pointerId) {
          return;
        }
        dragInputState.active = false;
        setAimMode('idle');
        roomStage.releasePointerCapture(event.pointerId);
        setStageMessage('캔버스 입력이 취소되었습니다.', true);
      });
      window.__bhcRoomStage = {
        worldToCanvas,
        canvasToWorld,
        pushSnapshot: pushStageSnapshot,
      };
      if (!stageState.animationFrameId) {
        stageState.animationFrameId = window.requestAnimationFrame(runStageRenderLoop);
      }
      shotDrag.min = String(MIN_STROKE_PX);
      shotDrag.max = String(MAX_STROKE_PX);
      shotDrag.value = String(normalizeStrokeDragPx(Number(shotDrag.value)));
      shotDrag.addEventListener('input', () => {
        shotDrag.value = String(normalizeStrokeDragPx(Number(shotDrag.value)));
      });
      updateImpactIndicator();
    }

    function getRoomErrorMessage(errorCode) {
      return ROOM_ERROR_MESSAGES[errorCode] || ROOM_ERROR_MESSAGES.UNKNOWN_ERROR;
    }

    function getChatErrorMessage(errorCode, retryAfterMs) {
      if (errorCode === 'CHAT_RATE_LIMITED' && Number.isFinite(retryAfterMs) && retryAfterMs > 0) {
        const seconds = Math.ceil(retryAfterMs / 1000);
        return seconds + '초 후에 다시 메시지를 보낼 수 있습니다.';
      }
      return getRoomErrorMessage(errorCode);
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

    function connectRoomStream(memberId) {
      if (!memberId) {
        return;
      }
      if (roomStream && streamMemberId === memberId) {
        return;
      }
      if (roomStream) {
        roomStream.close();
      }
      streamMemberId = memberId;
      const streamUrl = '/api/room-stream/${roomId}?memberId=' + encodeURIComponent(memberId);
      roomStream = new EventSource(streamUrl);
      roomStream.addEventListener('room_snapshot', (event) => {
        try {
          const snapshot = JSON.parse(event.data);
          if (window.__bhcRoomStage && typeof window.__bhcRoomStage.pushSnapshot === 'function') {
            window.__bhcRoomStage.pushSnapshot(snapshot);
          }
        } catch {
          setStageMessage('snapshot 파싱에 실패했습니다.', true);
        }
      });
      roomStream.addEventListener('shot_started', () => {
        setAimMode('shotPending');
        shotInputLocked = true;
        updateShotInputLockUi();
        setShotMessage('샷 진행 중입니다. 다음 입력은 턴 전환 후 가능합니다.', '');
      });
      roomStream.addEventListener('shot_resolved', () => {
        setShotMessage('샷이 종료되었습니다. 턴 전환을 기다리는 중입니다.', '');
      });
      roomStream.addEventListener('turn_changed', () => {
        setAimMode('idle');
        shotInputLocked = false;
        updateShotInputLockUi();
        setShotMessage('턴이 전환되었습니다. 샷 입력 잠금이 해제되었습니다.', '');
        loadRoom();
      });
      roomStream.addEventListener('game_finished', () => {
        setAimMode('idle');
        shotInputLocked = true;
        updateShotInputLockUi();
        setFlowBanner('경기가 종료되었습니다. 결과를 반영합니다.', 'warn');
        loadRoom();
      });
      roomStream.addEventListener('host_delegated', () => {
        setRoomMessage('방장이 변경되었습니다. 권한 상태를 갱신합니다.', '');
        loadRoom();
      });
      roomStream.onerror = () => {
        setStageMessage('스트림 연결이 일시 중단되었습니다. 재연결을 시도합니다.', true);
      };
      roomStream.onopen = () => {
        setStageMessage('실시간 snapshot 스트림 연결됨', false);
      };
    }

    async function runRoomAction(path, payload, successMessage) {
      const result = await requestJson(path, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!result.ok) {
        const errorCode = result.data.errorCode || 'UNKNOWN_ERROR';
        setRoomMessage('요청 실패: ' + getRoomErrorMessage(errorCode), 'error');
        return false;
      }
      setRoomMessage(successMessage, '');
      return true;
    }

    function renderChat(items) {
      if (!Array.isArray(items) || items.length === 0) {
        chatList.innerHTML = '<p>채팅 메시지가 없습니다.</p>';
        return;
      }
      chatList.innerHTML = items.map((item) => (
        '<article class="member">' +
        '<div><strong>' + item.senderMemberId + '</strong><div>' + item.message + '</div></div>' +
        '<div>' + (item.sentAt || '') + '</div>' +
        '</article>'
      )).join('');
    }

    function renderHud(room) {
      const members = Array.isArray(room.members) ? room.members : [];
      const scoreBoard = room && typeof room.scoreBoard === 'object' && room.scoreBoard ? room.scoreBoard : {};
      const currentTurnIndex = Number.isInteger(room.currentTurnIndex) ? room.currentTurnIndex : 0;
      const currentTurnMember = members[currentTurnIndex] || null;
      currentTurnMemberId = currentTurnMember ? String(currentTurnMember.memberId) : null;
      hudTurn.textContent = currentTurnMember ? currentTurnMember.displayName : '-';
      currentTurnDeadlineMs = Number.isFinite(room.turnDeadlineMs) ? Number(room.turnDeadlineMs) : null;
      hudTimer.textContent = String(getRemainingTurnSeconds(currentTurnDeadlineMs));
      if (members.length === 0) {
        hudScoreboard.innerHTML = '<p>점수판 데이터가 없습니다.</p>';
        return;
      }
      hudScoreboard.innerHTML = members.map((member) => (
        '<article class="member"><div><strong>' + member.displayName + '</strong></div><div>' +
          String(Number(scoreBoard[member.memberId] ?? 0)) +
          '점</div></article>'
      )).join('');
    }

    async function loadChat() {
      const result = await requestJson('/api/lobby/rooms/${roomId}/chat', { method: 'GET' });
      if (!result.ok) {
        return;
      }
      renderChat(result.data.items);
    }

    function renderMembers(room, meId, isHost) {
      const members = Array.isArray(room.members) ? room.members : [];
      const membersRoot = document.getElementById('members');
      if (members.length === 0) {
        membersRoot.innerHTML = '<p>참가자가 없습니다.</p>';
        return;
      }

      membersRoot.innerHTML = members.map((member) => {
        const hostBadge = member.memberId === room.hostMemberId ? '<span class="pill">HOST</span>' : '';
        const meBadge = member.memberId === meId ? '<span class="pill">ME</span>' : '';
        const canKick = isHost && member.memberId !== meId;
        const kickButton = canKick
          ? '<button type="button" class="kick-btn secondary" data-member-id="' + member.memberId + '">강퇴</button>'
          : '';
        return (
          '<article class="member">' +
          '<div><strong>' + member.displayName + '</strong><div>' + member.memberId + '</div></div>' +
          '<div class="member-actions">' + hostBadge + meBadge + kickButton + '</div>' +
          '</article>'
        );
      }).join('');
    }

    async function loadRoom() {
      const result = await requestJson('/api/lobby/rooms/${roomId}', { method: 'GET' });
      if (!result.ok) {
        setRoomMessage('방 정보 조회 실패: ' + (result.data.errorCode || 'UNKNOWN_ERROR'), 'error');
        return;
      }

      const room = result.data.room;
      let me = null;
      try {
        me = sessionRaw ? JSON.parse(sessionRaw) : null;
      } catch {
        me = null;
      }
      myMemberId = me?.userId ? String(me.userId) : (me?.guestId || null);
      const isHost = myMemberId && room.hostMemberId && String(room.hostMemberId) === String(myMemberId);
      const canStart = Boolean(isHost) && room.state === 'WAITING' && room.playerCount >= 2;
      const canRematch = Boolean(isHost) && room.state !== 'WAITING' && room.playerCount >= 2;
      const amIMember = room.members.some((member) => String(member.memberId) === String(myMemberId));
      if (amIMember && myMemberId) {
        connectRoomStream(String(myMemberId));
      }

      document.getElementById('room-title').textContent = room.title;
      document.getElementById('room-state').textContent = room.state;
      document.getElementById('room-player-count').textContent = String(room.playerCount);
      document.getElementById('room-host').textContent = room.hostMemberId || '-';
      document.getElementById('room-created-at').textContent = room.createdAt;
      document.getElementById('start-btn').disabled = !canStart;
      document.getElementById('rematch-btn').disabled = !canRematch;
      renderMembers(room, myMemberId, Boolean(isHost));
      renderHud(room);
      currentRoomState = room.state;
      shotInputLocked = room.state !== 'IN_GAME'
        || !amIMember
        || !currentTurnMemberId
        || String(currentTurnMemberId) !== String(myMemberId);
      updateShotInputLockUi();
      if (shotInputLocked && aimInputState.mode !== 'shotPending') {
        setAimMode('idle');
      }

      if (!amIMember && myMemberId) {
        setFlowBanner('방에서 제외되었습니다. 로비로 이동합니다.', 'warn');
        setTimeout(() => {
          window.location.href = '/lobby';
        }, 1200);
        return;
      }

      if (room.state === 'IN_GAME') {
        setFlowBanner('경기 진행 중입니다.', '');
      } else if (room.state === 'FINISHED') {
        setFlowBanner('경기가 종료되었습니다.', 'warn');
      } else if (room.playerCount <= 1) {
        setFlowBanner('대기 중: 2명 이상 입장하면 시작할 수 있습니다.', '');
      } else {
        setFlowBanner('게임 시작 가능 상태입니다.', '');
      }

      setRoomMessage('방 상태를 갱신했습니다.', '');
    }

    refreshBtn.addEventListener('click', async () => {
      await loadRoom();
    });

    startBtn.addEventListener('click', async () => {
      if (!myMemberId) {
        setRoomMessage('세션 정보가 없습니다. 다시 로그인해 주세요.', 'error');
        return;
      }
      const ok = await runRoomAction('/api/lobby/rooms/${roomId}/start', { actorMemberId: myMemberId }, '게임을 시작했습니다.');
      if (ok) {
        await loadRoom();
      }
    });

    rematchBtn.addEventListener('click', async () => {
      if (!myMemberId) {
        setRoomMessage('세션 정보가 없습니다. 다시 로그인해 주세요.', 'error');
        return;
      }
      const ok = await runRoomAction(
        '/api/lobby/rooms/${roomId}/rematch',
        { actorMemberId: myMemberId },
        '재경기를 시작했습니다.',
      );
      if (ok) {
        await loadRoom();
      }
    });

    document.getElementById('members').addEventListener('click', async (event) => {
      const target = event.target;
      if (!(target instanceof HTMLButtonElement)) {
        return;
      }
      if (!target.classList.contains('kick-btn')) {
        return;
      }
      if (!myMemberId) {
        setRoomMessage('세션 정보가 없습니다. 다시 로그인해 주세요.', 'error');
        return;
      }
      const targetMemberId = target.dataset.memberId;
      if (!targetMemberId) {
        return;
      }
      const ok = await runRoomAction(
        '/api/lobby/rooms/${roomId}/kick',
        { actorMemberId: myMemberId, targetMemberId },
        '참가자를 강퇴했습니다.',
      );
      if (ok) {
        await loadRoom();
      }
    });

    leaveBtn.addEventListener('click', async () => {
      if (!myMemberId) {
        window.location.href = '/lobby';
        return;
      }
      const result = await requestJson('/api/lobby/rooms/${roomId}/leave', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ actorMemberId: myMemberId }),
      });
      if (!result.ok) {
        const errorCode = result.data.errorCode || 'UNKNOWN_ERROR';
        setRoomMessage('나가기 실패: ' + getRoomErrorMessage(errorCode), 'error');
        return;
      }
      window.location.href = '/lobby';
    });

    async function submitShotInput(source) {
      if (!myMemberId) {
        setRoomMessage('세션 정보가 없습니다. 다시 로그인해 주세요.', 'error');
        return false;
      }
      if (currentRoomState !== 'IN_GAME') {
        setShotMessage('현재 상태에서는 샷을 입력할 수 없습니다.', 'error');
        return false;
      }
      if (shotSubmitInFlight || shotInputLocked) {
        setShotMessage('이미 샷 요청이 진행 중입니다. 잠시 후 다시 시도해 주세요.', 'error');
        setShotValidationDetails('SHOT_STATE_CONFLICT', []);
        return false;
      }

      const payload = {
        schemaName: 'shot_input',
        schemaVersion: '1.0.0',
        roomId: '${roomId}',
        matchId: 'match-1',
        turnId: 'turn-1',
        playerId: String(myMemberId),
        clientTsMs: Date.now(),
        shotDirectionDeg: Number(shotDirection.value),
        cueElevationDeg: Number(shotElevation.value),
        dragPx: normalizeStrokeDragPx(Number(shotDrag.value)),
        impactOffsetX: Number(impactOffsetState.x.toFixed(4)),
        impactOffsetY: Number(impactOffsetState.y.toFixed(4)),
      };
      shotSubmitInFlight = true;
      updateShotInputLockUi();
      try {
        const result = await requestJson('/api/lobby/rooms/${roomId}/shot', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ actorMemberId: myMemberId, payload }),
        });
        if (!result.ok) {
          const errorCode = result.data.errorCode || 'UNKNOWN_ERROR';
          setShotMessage('샷 제출 실패: ' + getRoomErrorMessage(errorCode), 'error');
          const details = Array.isArray(result.data.errors) ? result.data.errors : [];
          setShotValidationDetails(errorCode, details);
          return false;
        }
        shotInputLocked = true;
        setAimMode('shotPending');
        updateShotInputLockUi();
        setShotMessage('샷 입력이 서버에 접수되었습니다. (' + source + ')', '');
        return true;
      } finally {
        shotSubmitInFlight = false;
        updateShotInputLockUi();
      }
    }

    shotForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      await submitShotInput('form');
    });

    window.addEventListener('keydown', (event) => {
      if (event.repeat) {
        return;
      }
      const key = event.key.toLowerCase();
      let nextX = impactOffsetState.x;
      let nextY = impactOffsetState.y;
      if (key === 'w') {
        nextY -= impactOffsetStepR;
      } else if (key === 's') {
        nextY += impactOffsetStepR;
      } else if (key === 'a') {
        nextX -= impactOffsetStepR;
      } else if (key === 'd') {
        nextX += impactOffsetStepR;
      } else {
        return;
      }
      event.preventDefault();
      updateImpactOffset(nextX, nextY);
    });

    chatForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (!myMemberId) {
        setRoomMessage('세션 정보가 없습니다. 다시 로그인해 주세요.', 'error');
        return;
      }
      const message = chatInput.value;
      const result = await requestJson('/api/lobby/rooms/${roomId}/chat', {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ senderMemberId: myMemberId, message }),
      });
      if (!result.ok) {
        const errorCode = result.data.errorCode || 'UNKNOWN_ERROR';
        const retryAfterMs = Number(result.data.retryAfterMs);
        setRoomMessage('채팅 전송 실패: ' + getChatErrorMessage(errorCode, retryAfterMs), 'error');
        return;
      }
      chatInput.value = '';
      await loadChat();
    });

    initRoomStage();
    updateShotInputLockUi();
    loadRoom();
    loadChat();
    setInterval(loadRoom, 3000);
    setInterval(loadChat, 3000);
    setInterval(() => {
      hudTimer.textContent = String(getRemainingTurnSeconds(currentTurnDeadlineMs));
    }, 1000);
    window.addEventListener('beforeunload', () => {
      if (roomStream) {
        roomStream.close();
      }
    });
  </script>
</body>
</html>`;
}

const webPort = parsePort('WEB_PORT', DEFAULT_WEB_PORT);
const authServerUrl = process.env.AUTH_SERVER_URL || DEFAULT_AUTH_SERVER_URL;
const lobbyServerUrl = process.env.LOBBY_SERVER_URL || DEFAULT_LOBBY_SERVER_URL;

const server = createServer(async (req, res) => {
  if (await tryServePublicAsset(req, res)) {
    return;
  }

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
    const target = `${lobbyServerUrl}${req.url.replace('/api', '')}`;
    await proxyJsonRequest(req, res, target, 'GET', 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/room-stream/')) {
    const url = new URL(req.url, 'http://localhost');
    const match = url.pathname.match(/^\/api\/room-stream\/([^/?#]+)$/);
    const roomId = match?.[1];
    if (!roomId) {
      writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
      return;
    }
    const target = new URL(`/lobby/rooms/${roomId}/stream`, lobbyServerUrl);
    for (const [key, value] of url.searchParams.entries()) {
      target.searchParams.set(key, value);
    }
    await proxyEventStreamRequest(res, target.toString(), 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'POST' && req.url === '/api/lobby/rooms') {
    await proxyJsonRequest(req, res, `${lobbyServerUrl}/lobby/rooms`, 'POST', 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'POST' && req.url?.startsWith('/api/lobby/rooms/') && req.url.endsWith('/join')) {
    await proxyJsonRequest(req, res, `${lobbyServerUrl}${req.url.replace('/api', '')}`, 'POST', 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'POST' && req.url?.startsWith('/api/lobby/rooms/') && req.url.endsWith('/start')) {
    await proxyJsonRequest(req, res, `${lobbyServerUrl}${req.url.replace('/api', '')}`, 'POST', 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'POST' && req.url?.startsWith('/api/lobby/rooms/') && req.url.endsWith('/rematch')) {
    await proxyJsonRequest(req, res, `${lobbyServerUrl}${req.url.replace('/api', '')}`, 'POST', 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'POST' && req.url?.startsWith('/api/lobby/rooms/') && req.url.endsWith('/kick')) {
    await proxyJsonRequest(req, res, `${lobbyServerUrl}${req.url.replace('/api', '')}`, 'POST', 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'POST' && req.url?.startsWith('/api/lobby/rooms/') && req.url.endsWith('/leave')) {
    await proxyJsonRequest(req, res, `${lobbyServerUrl}${req.url.replace('/api', '')}`, 'POST', 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'GET' && req.url?.startsWith('/api/lobby/rooms/') && req.url.endsWith('/chat')) {
    await proxyJsonRequest(req, res, `${lobbyServerUrl}${req.url.replace('/api', '')}`, 'GET', 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'POST' && req.url?.startsWith('/api/lobby/rooms/') && req.url.endsWith('/chat')) {
    await proxyJsonRequest(req, res, `${lobbyServerUrl}${req.url.replace('/api', '')}`, 'POST', 'LOBBY_SERVER_UNAVAILABLE');
    return;
  }

  if (req.method === 'POST' && req.url?.startsWith('/api/lobby/rooms/') && req.url.endsWith('/shot')) {
    await proxyJsonRequest(req, res, `${lobbyServerUrl}${req.url.replace('/api', '')}`, 'POST', 'LOBBY_SERVER_UNAVAILABLE');
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

  const roomMatch = req.url?.match(/^\/room\/([^/?#]+)$/);
  if (roomMatch) {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(renderRoomPage(roomMatch[1]));
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
