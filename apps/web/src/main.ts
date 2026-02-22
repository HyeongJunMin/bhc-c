import { createServer } from 'node:http';

const PORT_MIN = 9211;
const PORT_MAX = 9220;
const DEFAULT_WEB_PORT = 9213;

function parsePort(name: string, fallback: number): number {
  const raw = process.env[name];
  const value = raw ? Number(raw) : fallback;

  if (!Number.isInteger(value) || value < PORT_MIN || value > PORT_MAX) {
    throw new Error(`${name} must be an integer in range ${PORT_MIN}-${PORT_MAX}. received: ${raw ?? fallback}`);
  }

  return value;
}

const webPort = parsePort('WEB_PORT', DEFAULT_WEB_PORT);

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
      width: min(720px, 100%);
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
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
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
      min-height: 22px;
      font-size: 14px;
      color: var(--muted);
    }
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
    <p id="auth-message">API 연동 전 단계: UI 구성 완료</p>
  </main>
</body>
</html>`;
}

const server = createServer((req, res) => {
  if (req.url === '/health') {
    res.statusCode = 200;
    res.setHeader('content-type', 'application/json; charset=utf-8');
    res.end(JSON.stringify({ ok: true }));
    return;
  }

  if (req.url === '/login') {
    res.statusCode = 200;
    res.setHeader('content-type', 'text/html; charset=utf-8');
    res.end(renderLoginPage());
    return;
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'text/html; charset=utf-8');
  res.end('<!doctype html><html><head><meta charset="utf-8"><title>BHC Web</title></head><body><h1>BHC Web</h1><p>Server is running.</p><a href="/login">/login</a></body></html>');
});

server.listen(webPort, () => {
  console.log(`[web] listening on http://localhost:${webPort}`);
});

function shutdown(): void {
  server.close();
}

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);
