import test from 'node:test';
import assert from 'node:assert/strict';

import { createInfiniteScrollState, paginateRooms, shouldStopInfiniteScroll } from './pagination.ts';

test('페이지네이션 결과에 hasMore/nextOffset 계약을 포함한다', () => {
  const rooms = ['r1', 'r2', 'r3', 'r4'];

  const page = paginateRooms(rooms, 0, 2);

  assert.deepEqual(page.items, ['r1', 'r2']);
  assert.equal(page.hasMore, true);
  assert.equal(page.nextOffset, 2);
});

test('마지막 페이지에서는 hasMore=false를 반환한다', () => {
  const rooms = ['r1', 'r2', 'r3'];

  const page = paginateRooms(rooms, 2, 2);

  assert.deepEqual(page.items, ['r3']);
  assert.equal(page.hasMore, false);
  assert.equal(page.nextOffset, 3);
});

test('hasMore=false이면 infinite scroll을 중단한다', () => {
  const state = createInfiniteScrollState();

  const shouldStop = shouldStopInfiniteScroll(state, 4, false);

  assert.equal(shouldStop, true);
});

test('같은 offset 중복 요청이면 infinite scroll을 중단한다', () => {
  const state = createInfiniteScrollState();

  assert.equal(shouldStopInfiniteScroll(state, 2, true), false);
  assert.equal(shouldStopInfiniteScroll(state, 2, true), true);
});

test('마지막 페이지 이후 offset 요청은 빈 목록/hasMore=false를 반환한다', () => {
  const rooms = ['r1', 'r2'];

  const page = paginateRooms(rooms, 10, 5);

  assert.deepEqual(page.items, []);
  assert.equal(page.hasMore, false);
  assert.equal(page.nextOffset, 10);
});
