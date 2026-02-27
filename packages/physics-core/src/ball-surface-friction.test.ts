import assert from 'node:assert/strict';
import test from 'node:test';

import { applyBallSurfaceFriction } from './ball-surface-friction.ts';

test('sliding state applies coupled linear/angular damping', () => {
  const result = applyBallSurfaceFriction({
    vx: 2,
    vy: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    radiusM: 0.03075,
    dtSec: 0.01,
  });

  assert.equal(result.motionState === 'SLIDING' || result.motionState === 'ROLLING', true);
  assert.equal(Math.abs(result.vx) < 2, true);
});

test('very low motion converges to stationary', () => {
  const result = applyBallSurfaceFriction({
    vx: 0.001,
    vy: 0.001,
    spinX: 0.01,
    spinY: 0.01,
    spinZ: 0.01,
    radiusM: 0.03075,
    dtSec: 0.01,
  });

  assert.equal(result.motionState, 'STATIONARY');
  assert.equal(result.vx, 0);
  assert.equal(result.vy, 0);
});
