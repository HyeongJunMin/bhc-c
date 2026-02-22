import test from 'node:test';
import assert from 'node:assert/strict';

import { resolveTurnAfterShot } from './turn-resolution.ts';

test('득점 성공이면 같은 플레이어가 다음 샷을 진행한다', () => {
  const result = resolveTurnAfterShot(true);

  assert.deepEqual(result, {
    scored: true,
    shouldSwitchTurn: false,
  });
});

test('득점 실패면 턴을 다음 플레이어로 전환한다', () => {
  const result = resolveTurnAfterShot(false);

  assert.deepEqual(result, {
    scored: false,
    shouldSwitchTurn: true,
  });
});
