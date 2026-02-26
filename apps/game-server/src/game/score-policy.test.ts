import test from 'node:test';
import assert from 'node:assert/strict';

import { createScoreBoard, increasePlayerScore, increaseScoreAndCheckGameEnd } from './score-policy.ts';

test('선수 목록으로 점수판을 0점으로 초기화한다', () => {
  const scoreBoard = createScoreBoard(['p1', 'p2']);

  assert.deepEqual(scoreBoard, {
    p1: 0,
    p2: 0,
  });
});

test('점수 증가 요청 시 해당 선수 점수를 올린다', () => {
  const scoreBoard = createScoreBoard(['p1', 'p2']);

  const result = increasePlayerScore(scoreBoard, 'p1');

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.nextScore, 1);
    assert.equal(result.scoreBoard.p1, 1);
  }
});

test('없는 선수 점수 증가 요청은 GAME_PLAYER_NOT_FOUND를 반환한다', () => {
  const scoreBoard = createScoreBoard(['p1']);

  const result = increasePlayerScore(scoreBoard, 'p2');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'GAME_PLAYER_NOT_FOUND');
  }
});

test('10점 도달 즉시 경기 종료 분기를 반환한다', () => {
  const scoreBoard = createScoreBoard(['p1', 'p2']);
  scoreBoard.p1 = 9;

  const result = increaseScoreAndCheckGameEnd(scoreBoard, 'p1');

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.nextScore, 10);
    assert.equal(result.gameEnded, true);
    assert.equal(result.winnerPlayerId, 'p1');
  }
});

test('목표 점수 미도달이면 경기 진행 상태를 반환한다', () => {
  const scoreBoard = createScoreBoard(['p1', 'p2']);

  const result = increaseScoreAndCheckGameEnd(scoreBoard, 'p1');

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.nextScore, 1);
    assert.equal(result.gameEnded, false);
    assert.equal(result.winnerPlayerId, null);
  }
});
