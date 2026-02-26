import { createHmac } from 'node:crypto';
import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { hashPassword, verifyPassword } from './password.ts';

type UserRecord = {
  id: number;
  username: string;
  passwordHash: string;
};

type AuthState = {
  nextUserId: number;
  nextGuestId: number;
  usersByUsername: Map<string, UserRecord>;
};

type SignupResult =
  | { ok: true; user: UserRecord }
  | { ok: false; statusCode: 400 | 409; errorCode: 'AUTH_INVALID_INPUT' | 'AUTH_DUPLICATE_USERNAME' };
type LoginResult =
  | { ok: true; user: UserRecord; accessToken: string; refreshToken: string }
  | { ok: false; statusCode: 400 | 401; errorCode: 'AUTH_INVALID_INPUT' | 'AUTH_INVALID_CREDENTIALS' };
type GuestLoginResult =
  | { ok: true; guestId: string; nickname: string; accessToken: string; refreshToken: string }
  | { ok: false; statusCode: 400; errorCode: 'AUTH_INVALID_INPUT' };

const JWT_SECRET = process.env.AUTH_JWT_SECRET || 'bhc-dev-secret';
const ACCESS_TOKEN_EXPIRES_SEC = 60 * 15;
const REFRESH_TOKEN_EXPIRES_SEC = 60 * 60 * 24 * 7;

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

function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '*';
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type,Accept');
}

function getStringField(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null;
  }

  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toBase64Url(value: string | Buffer): string {
  const raw = Buffer.isBuffer(value) ? value : Buffer.from(value);
  return raw.toString('base64url');
}

function signJwt(payload: Record<string, unknown>, expiresInSeconds: number): string {
  const header = {
    alg: 'HS256',
    typ: 'JWT',
  };
  const now = Math.floor(Date.now() / 1000);
  const payloadWithExp = {
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
  };

  const encodedHeader = toBase64Url(JSON.stringify(header));
  const encodedPayload = toBase64Url(JSON.stringify(payloadWithExp));
  const signature = createHmac('sha256', JWT_SECRET)
    .update(`${encodedHeader}.${encodedPayload}`)
    .digest('base64url');

  return `${encodedHeader}.${encodedPayload}.${signature}`;
}

async function handleSignup(req: IncomingMessage, res: ServerResponse, state: AuthState): Promise<void> {
  const rawBody = await readBody(req);
  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(rawBody || '{}');
  } catch {
    writeJson(res, 400, { errorCode: 'AUTH_INVALID_JSON' });
    return;
  }

  const username = getStringField((parsedBody as Record<string, unknown>).username);
  const password = getStringField((parsedBody as Record<string, unknown>).password);

  const result = await signup(state, { username, password });
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }

  writeJson(res, 201, { userId: result.user.id, username: result.user.username });
}

export async function signup(
  state: AuthState,
  input: { username: string | null; password: string | null },
): Promise<SignupResult> {
  if (!input.username || !input.password) {
    return { ok: false, statusCode: 400, errorCode: 'AUTH_INVALID_INPUT' };
  }

  if (state.usersByUsername.has(input.username)) {
    return { ok: false, statusCode: 409, errorCode: 'AUTH_DUPLICATE_USERNAME' };
  }

  const passwordHash = await hashPassword(input.password);
  const user: UserRecord = {
    id: state.nextUserId,
    username: input.username,
    passwordHash,
  };
  state.nextUserId += 1;
  state.usersByUsername.set(input.username, user);

  return { ok: true, user };
}

export async function login(
  state: AuthState,
  input: { username: string | null; password: string | null },
): Promise<LoginResult> {
  if (!input.username || !input.password) {
    return { ok: false, statusCode: 400, errorCode: 'AUTH_INVALID_INPUT' };
  }

  const user = state.usersByUsername.get(input.username);
  if (!user) {
    return { ok: false, statusCode: 401, errorCode: 'AUTH_INVALID_CREDENTIALS' };
  }

  const isMatch = await verifyPassword(input.password, user.passwordHash);
  if (!isMatch) {
    return { ok: false, statusCode: 401, errorCode: 'AUTH_INVALID_CREDENTIALS' };
  }

  return {
    ok: true,
    user,
    accessToken: signJwt({ sub: user.id, username: user.username, tokenType: 'access' }, ACCESS_TOKEN_EXPIRES_SEC),
    refreshToken: signJwt({ sub: user.id, username: user.username, tokenType: 'refresh' }, REFRESH_TOKEN_EXPIRES_SEC),
  };
}

async function handleLogin(req: IncomingMessage, res: ServerResponse, state: AuthState): Promise<void> {
  const rawBody = await readBody(req);
  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(rawBody || '{}');
  } catch {
    writeJson(res, 400, { errorCode: 'AUTH_INVALID_JSON' });
    return;
  }

  const username = getStringField((parsedBody as Record<string, unknown>).username);
  const password = getStringField((parsedBody as Record<string, unknown>).password);
  const result = await login(state, { username, password });

  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }

  writeJson(res, 200, {
    userId: result.user.id,
    username: result.user.username,
    tokenType: 'Bearer',
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accessTokenExpiresInSec: ACCESS_TOKEN_EXPIRES_SEC,
    refreshTokenExpiresInSec: REFRESH_TOKEN_EXPIRES_SEC,
  });
}

export function guestLogin(state: AuthState, input: { nickname: string | null }): GuestLoginResult {
  if (!input.nickname) {
    return { ok: false, statusCode: 400, errorCode: 'AUTH_INVALID_INPUT' };
  }

  const guestId = `guest-${state.nextGuestId}`;
  state.nextGuestId += 1;

  return {
    ok: true,
    guestId,
    nickname: input.nickname,
    accessToken: signJwt({ sub: guestId, nickname: input.nickname, tokenType: 'access', isGuest: true }, ACCESS_TOKEN_EXPIRES_SEC),
    refreshToken: signJwt(
      { sub: guestId, nickname: input.nickname, tokenType: 'refresh', isGuest: true },
      REFRESH_TOKEN_EXPIRES_SEC,
    ),
  };
}

async function handleGuestLogin(req: IncomingMessage, res: ServerResponse, state: AuthState): Promise<void> {
  const rawBody = await readBody(req);
  let parsedBody: unknown;

  try {
    parsedBody = JSON.parse(rawBody || '{}');
  } catch {
    writeJson(res, 400, { errorCode: 'AUTH_INVALID_JSON' });
    return;
  }

  const nickname = getStringField((parsedBody as Record<string, unknown>).nickname);
  const result = guestLogin(state, { nickname });

  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }

  writeJson(res, 200, {
    guestId: result.guestId,
    nickname: result.nickname,
    tokenType: 'Bearer',
    accessToken: result.accessToken,
    refreshToken: result.refreshToken,
    accessTokenExpiresInSec: ACCESS_TOKEN_EXPIRES_SEC,
    refreshTokenExpiresInSec: REFRESH_TOKEN_EXPIRES_SEC,
  });
}

export function createAuthRequestHandler(state: AuthState) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    applyCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/auth/signup') {
      await handleSignup(req, res, state);
      return;
    }
    if (req.method === 'POST' && req.url === '/auth/login') {
      await handleLogin(req, res, state);
      return;
    }
    if (req.method === 'POST' && req.url === '/auth/guest') {
      await handleGuestLogin(req, res, state);
      return;
    }

    writeJson(res, 404, { errorCode: 'NOT_FOUND' });
  };
}

export function createAuthHttpServer() {
  const state: AuthState = {
    nextUserId: 1,
    nextGuestId: 1,
    usersByUsername: new Map(),
  };

  const requestHandler = createAuthRequestHandler(state);
  const server = createServer((req, res) => {
    void requestHandler(req, res);
  });

  return {
    server,
    state,
  };
}
