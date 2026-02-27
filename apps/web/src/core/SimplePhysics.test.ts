import { describe, expect, it } from 'vitest';
import { Vector3 } from 'three';
import { SimplePhysics } from './SimplePhysics';
import { PHYSICS } from '../lib/constants';

describe('SimplePhysics collision response', () => {
  it('applies impulse when balls are approaching along normal', () => {
    const physics = new SimplePhysics();
    const d = PHYSICS.BALL_RADIUS * 2 - 0.001;

    physics.createBall('a', new Vector3(0, 0, 0));
    physics.createBall('b', new Vector3(d, 0, 0));
    physics.applyVelocity('a', { x: 1, y: 0, z: 0 });
    physics.applyVelocity('b', { x: 0, y: 0, z: 0 });

    physics.step(0.016);

    const a = physics.getBallState('a');
    const b = physics.getBallState('b');
    expect(a).not.toBeNull();
    expect(b).not.toBeNull();
    if (!a || !b) {
      return;
    }

    expect(a.velocity.x).toBeLessThan(0.05);
    expect(b.velocity.x).toBeGreaterThan(0.8);
  });
});
