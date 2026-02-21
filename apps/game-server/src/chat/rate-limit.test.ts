import test from 'node:test';
import assert from 'node:assert/strict';

import { getLastChatSentAt, recordLastChatSentAt } from './rate-limit.ts';

test('사용자별 마지막 채팅 전송 시각을 저장한다', () => {
  const userLastSentAtStore = new Map();

  recordLastChatSentAt(userLastSentAtStore, 'u1', 1000);
  recordLastChatSentAt(userLastSentAtStore, 'u2', 2000);

  assert.equal(getLastChatSentAt(userLastSentAtStore, 'u1'), 1000);
  assert.equal(getLastChatSentAt(userLastSentAtStore, 'u2'), 2000);
});

test('기록이 없으면 null을 반환한다', () => {
  const userLastSentAtStore = new Map();

  assert.equal(getLastChatSentAt(userLastSentAtStore, 'missing'), null);
});
