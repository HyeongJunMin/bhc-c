import test from 'node:test';
import assert from 'node:assert/strict';

import { computeInitialAngularVelocity } from './initial-angular-velocity.ts';

const FLOAT_EPSILON = 0.000001;

function assertAlmostEqual(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < FLOAT_EPSILON, `expected ${expected}, got ${actual}`);
}

test('초기 각속도는 명세 식 omega_x/omega_z를 따른다', () => {
  const low = computeInitialAngularVelocity(2, 0.01, 0.02);
  const high = computeInitialAngularVelocity(12, 0.01, 0.02);

  assert.equal(Math.abs(high.omegaX) > Math.abs(low.omegaX), true);
  assert.equal(Math.abs(high.omegaZ) > Math.abs(low.omegaZ), true);
  assert.equal(Math.sign(high.omegaX), Math.sign(low.omegaX));
  assert.equal(Math.sign(high.omegaZ), Math.sign(low.omegaZ));
});

test('중심 타격(x=0,y=0)에서는 초기 각속도가 0이다', () => {
  const result = computeInitialAngularVelocity(13.89, 0, 0);

  assert.equal(result.omegaX, 0);
  assert.equal(result.omegaZ, 0);
});
