import test from 'node:test';
import assert from 'node:assert/strict';

import {
  createChatRateLimitFeedback,
  evaluateChatRateLimit,
  getLastChatSentAt,
  recordLastChatSentAt,
} from './rate-limit.ts';

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

test('마지막 전송 후 3초 이내 요청은 CHAT_RATE_LIMITED로 거부한다', () => {
  const userLastSentAtStore = new Map();
  recordLastChatSentAt(userLastSentAtStore, 'u1', 1000);

  const result = evaluateChatRateLimit(userLastSentAtStore, 'u1', 3500);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'CHAT_RATE_LIMITED');
    assert.equal(result.retryAfterMs, 500);
  }
});

test('마지막 전송 후 3초 이상 경과하면 전송을 허용한다', () => {
  const userLastSentAtStore = new Map();
  recordLastChatSentAt(userLastSentAtStore, 'u1', 1000);

  const result = evaluateChatRateLimit(userLastSentAtStore, 'u1', 4000);

  assert.deepEqual(result, { ok: true });
});

test('레이트리밋 위반 피드백 메시지를 생성한다', () => {
  const feedback = createChatRateLimitFeedback(1200);

  assert.deepEqual(feedback, {
    type: 'CHAT_RATE_LIMIT_NOTICE',
    message: '2초 후에 다시 메시지를 보낼 수 있습니다.',
    retryAfterMs: 1200,
  });
});
