import test from 'node:test';
import assert from 'node:assert/strict';

import { hashPassword, verifyPassword } from './password.ts';

test('verifyPassword: 정상 비밀번호는 true를 반환한다', async () => {
  const password = 'P@ssw0rd!';
  const encodedHash = await hashPassword(password);

  const result = await verifyPassword(password, encodedHash);
  assert.equal(result, true);
});

test('verifyPassword: 다른 비밀번호는 false를 반환한다', async () => {
  const encodedHash = await hashPassword('correct-password');

  const result = await verifyPassword('wrong-password', encodedHash);
  assert.equal(result, false);
});

test('verifyPassword: 잘못된 포맷은 예외 없이 false를 반환한다', async () => {
  await assert.doesNotReject(async () => {
    const result = await verifyPassword('any-password', 'invalid-format-hash');
    assert.equal(result, false);
  });
});
