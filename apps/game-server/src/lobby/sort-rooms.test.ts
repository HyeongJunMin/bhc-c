import test from 'node:test';
import assert from 'node:assert/strict';

import { compareRoomsForLobby } from './sort-rooms.ts';

test('대기중 우선 -> 인원 적은 순 -> 최신 생성 순으로 정렬된다', () => {
  const rooms = [
    { state: 'IN_GAME', playerCount: 0, createdAt: '2026-02-22T00:00:00.000Z' },
    { state: 'WAITING', playerCount: 2, createdAt: '2026-02-22T00:00:00.000Z' },
    { state: 'WAITING', playerCount: 1, createdAt: '2026-02-21T00:00:00.000Z' },
    { state: 'WAITING', playerCount: 1, createdAt: '2026-02-22T12:00:00.000Z' },
  ] as const;

  const sorted = [...rooms].sort(compareRoomsForLobby);

  assert.equal(sorted[0].state, 'WAITING');
  assert.equal(sorted[0].playerCount, 1);
  assert.equal(sorted[0].createdAt, '2026-02-22T12:00:00.000Z');

  assert.equal(sorted[1].state, 'WAITING');
  assert.equal(sorted[1].playerCount, 1);

  assert.equal(sorted[2].state, 'WAITING');
  assert.equal(sorted[2].playerCount, 2);

  assert.equal(sorted[3].state, 'IN_GAME');
});
