import test from 'node:test';
import assert from 'node:assert/strict';

import { CUE_BALL_RADIUS_M, isMiscue } from './miscue.ts';

test('임계 반경 안쪽 타격은 미스큐가 아니다', () => {
  const inside = 0.5 * CUE_BALL_RADIUS_M;

  assert.equal(isMiscue(inside, 0), false);
});

test('임계 반경 바깥 타격은 미스큐다', () => {
  const outside = 0.95 * CUE_BALL_RADIUS_M;

  assert.equal(isMiscue(outside, 0), true);
});

test('임계치 근방(0.89R/0.9R/0.91R)에서 판정 경계가 정확하다', () => {
  const offset089 = 0.89 * CUE_BALL_RADIUS_M;
  const offset090 = 0.9 * CUE_BALL_RADIUS_M;
  const offset091 = 0.91 * CUE_BALL_RADIUS_M;

  assert.equal(isMiscue(offset089, 0), false);
  assert.equal(isMiscue(offset090, 0), false);
  assert.equal(isMiscue(offset091, 0), true);
});
