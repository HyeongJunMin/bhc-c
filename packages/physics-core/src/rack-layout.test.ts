import test from 'node:test';
import assert from 'node:assert/strict';

import { START_RACK_LAYOUT } from './rack-layout.ts';

test('경기 시작 배치 좌표 상수가 정의되어 있다', () => {
  assert.equal(typeof START_RACK_LAYOUT.cueBall.x, 'number');
  assert.equal(typeof START_RACK_LAYOUT.cueBall.y, 'number');
  assert.equal(typeof START_RACK_LAYOUT.objectBall1.x, 'number');
  assert.equal(typeof START_RACK_LAYOUT.objectBall2.x, 'number');
});

test('두 목적구는 같은 x축, 서로 다른 y축에 배치된다', () => {
  assert.equal(START_RACK_LAYOUT.objectBall1.x, START_RACK_LAYOUT.objectBall2.x);
  assert.notEqual(START_RACK_LAYOUT.objectBall1.y, START_RACK_LAYOUT.objectBall2.y);
});
