import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBallBallCollisionWithSpin } from './ball-ball-collision.ts';

test('approaching balls collide and exchange normal momentum', () => {
  const first = { vx: 1, vy: 0, spinY: 0 };
  const second = { vx: -1, vy: 0, spinY: 0 };
  const result = applyBallBallCollisionWithSpin({
    first,
    second,
    normalX: 1,
    normalY: 0,
  });

  assert.equal(result.collided, true);
  assert.equal(first.vx < 1, true);
  assert.equal(second.vx > -1, true);
});

test('separating balls do not collide', () => {
  const first = { vx: -1, vy: 0, spinY: 0 };
  const second = { vx: 1, vy: 0, spinY: 0 };
  const result = applyBallBallCollisionWithSpin({
    first,
    second,
    normalX: 1,
    normalY: 0,
  });

  assert.equal(result.collided, false);
});
