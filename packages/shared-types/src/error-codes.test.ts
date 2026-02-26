import test from 'node:test';
import assert from 'node:assert/strict';

import { ErrorCodes } from './error-codes.ts';

test('공통 에러 코드 enum이 주요 도메인 코드를 포함한다', () => {
  assert.equal(typeof ErrorCodes.AUTH_INVALID_INPUT, 'string');
  assert.equal(typeof ErrorCodes.ROOM_FULL, 'string');
  assert.equal(typeof ErrorCodes.GAME_NOT_ENOUGH_PLAYERS, 'string');
  assert.equal(typeof ErrorCodes.SHOT_INPUT_SCHEMA_INVALID, 'string');
  assert.equal(typeof ErrorCodes.CHAT_RATE_LIMITED, 'string');
});
