import test from 'node:test';
import assert from 'node:assert/strict';

import { serializeRoomSnapshot } from './snapshot-serializer.ts';

test('snapshot serializer는 room 메타와 ball 필드를 JSON-safe 구조로 직렬화한다', () => {
  const snapshot = serializeRoomSnapshot({
    roomId: 'room-1',
    seq: 12,
    serverTimeMs: 1000,
    state: 'IN_GAME',
    currentMemberId: 'u1',
    turnDeadlineMs: 11000,
    scoreBoard: { u1: 1, u2: 0 },
    balls: [
      {
        id: 'cueBall',
        x: 0.7,
        y: 0.71,
        vx: 0.1,
        vy: -0.2,
        spinX: 1.25,
        spinY: 0,
        spinZ: -0.5,
        motionState: 'ROLLING',
        isPocketed: false,
      },
    ],
  });

  assert.equal(snapshot.roomId, 'room-1');
  assert.equal(snapshot.seq, 12);
  assert.equal(snapshot.turn.currentMemberId, 'u1');
  assert.equal(snapshot.turn.turnDeadlineMs, 11000);
  assert.equal(snapshot.scoreBoard.u1, 1);
  assert.equal(snapshot.balls.length, 1);
  assert.equal(snapshot.balls[0].id, 'cueBall');
  assert.equal(snapshot.balls[0].isPocketed, false);
});

test('snapshot serializer는 NaN/Infinity를 0으로 정규화한다', () => {
  const snapshot = serializeRoomSnapshot({
    roomId: 'room-1',
    seq: 1,
    serverTimeMs: 1,
    state: 'WAITING',
    currentMemberId: null,
    turnDeadlineMs: null,
    scoreBoard: { u1: Number.POSITIVE_INFINITY },
    balls: [
      {
        id: 'objectBall1',
        x: Number.NaN,
        y: Number.POSITIVE_INFINITY,
        vx: Number.NEGATIVE_INFINITY,
        vy: 0,
        spinX: Number.NaN,
        spinY: 3,
        spinZ: Number.POSITIVE_INFINITY,
        motionState: 'STATIONARY',
        isPocketed: true,
      },
    ],
  });

  assert.equal(snapshot.balls[0].x, 0);
  assert.equal(snapshot.balls[0].y, 0);
  assert.equal(snapshot.balls[0].vx, 0);
  assert.equal(snapshot.balls[0].spinX, 0);
  assert.equal(snapshot.balls[0].spinZ, 0);
  assert.equal(snapshot.scoreBoard.u1, 0);
});
