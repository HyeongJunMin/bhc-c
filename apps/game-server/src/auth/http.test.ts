import test from 'node:test';
import assert from 'node:assert/strict';

import { createAuthHttpServer, guestLogin, login, signup } from './http.ts';

test('signup -> login 통합 흐름', async () => {
  const { state } = createAuthHttpServer();

  const signupResult = await signup(state, { username: 'user01', password: 'pw01' });
  assert.equal(signupResult.ok, true);

  const loginResult = await login(state, { username: 'user01', password: 'pw01' });
  assert.equal(loginResult.ok, true);
  if (loginResult.ok) {
    assert.equal(typeof loginResult.accessToken, 'string');
    assert.equal(typeof loginResult.refreshToken, 'string');
  }
});

test('guestLogin 통합 흐름', () => {
  const { state } = createAuthHttpServer();

  const guestResult = guestLogin(state, { nickname: 'guestA' });
  assert.equal(guestResult.ok, true);

  if (guestResult.ok) {
    assert.equal(guestResult.guestId, 'guest-1');
    assert.equal(guestResult.nickname, 'guestA');
    assert.equal(typeof guestResult.accessToken, 'string');
    assert.equal(typeof guestResult.refreshToken, 'string');
  }
});
