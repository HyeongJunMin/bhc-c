import test from 'node:test';
import assert from 'node:assert/strict';

import type { PhysicsBallState } from '../room-physics-step.ts';
import {
  applyRigidBallState,
  cloneRigidBallState,
  fromRigidBallState,
  mapPhysicsBallsToRigidStates,
  mapRigidStatesToPhysicsBalls,
  toRigidBallState,
} from './rigid-ball.ts';

test('PhysicsBallState <-> RigidBallState 변환은 값 손실 없이 왕복된다', () => {
  const physicsBall: PhysicsBallState = {
    id: 'cueBall',
    x: 1.23,
    y: 0.45,
    vx: -2.1,
    vy: 3.4,
    spinX: 12.3,
    spinY: -4.5,
    spinZ: 67.8,
    isPocketed: false,
  };

  const rigid = toRigidBallState(physicsBall);
  const restored = fromRigidBallState(rigid);

  assert.deepEqual(restored, physicsBall);
});

test('applyRigidBallState는 기존 PhysicsBallState를 제자리 갱신한다', () => {
  const target: PhysicsBallState = {
    id: 'cueBall',
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    isPocketed: false,
  };
  const source = {
    id: 'objectBall1',
    p: { x: 2, y: 3 },
    v: { x: 4, y: 5 },
    w: { x: 6, y: 7, z: 8 },
    isPocketed: true,
  };

  applyRigidBallState(target, source);

  assert.deepEqual(target, {
    id: 'objectBall1',
    x: 2,
    y: 3,
    vx: 4,
    vy: 5,
    spinX: 6,
    spinY: 7,
    spinZ: 8,
    isPocketed: true,
  });
});

test('배열 매핑 유틸은 순서를 보존하고 원소 수를 유지한다', () => {
  const balls: PhysicsBallState[] = [
    { id: 'a', x: 0.1, y: 0.2, vx: 1, vy: 2, spinX: 3, spinY: 4, spinZ: 5, isPocketed: false },
    { id: 'b', x: 0.3, y: 0.4, vx: 6, vy: 7, spinX: 8, spinY: 9, spinZ: 10, isPocketed: true },
  ];

  const rigid = mapPhysicsBallsToRigidStates(balls);
  const restored = mapRigidStatesToPhysicsBalls(rigid);

  assert.equal(rigid.length, 2);
  assert.deepEqual(restored, balls);
});

test('cloneRigidBallState는 깊은 복사본을 만든다', () => {
  const original = {
    id: 'cue',
    p: { x: 1, y: 2 },
    v: { x: 3, y: 4 },
    w: { x: 5, y: 6, z: 7 },
    isPocketed: false,
  };

  const cloned = cloneRigidBallState(original);
  cloned.p.x = 99;
  cloned.v.y = 88;
  cloned.w.z = 77;

  assert.equal(original.p.x, 1);
  assert.equal(original.v.y, 4);
  assert.equal(original.w.z, 7);
});
