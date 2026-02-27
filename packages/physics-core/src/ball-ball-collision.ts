import { BALL_BALL_CONTACT_FRICTION, BALL_BALL_RESTITUTION, BALL_MASS_KG, BALL_RADIUS_M } from './constants.ts';

export type BallCollisionFrame = {
  vx: number;
  vy: number;
  spinY: number;
};

export type BallBallCollisionInput = {
  first: BallCollisionFrame;
  second: BallCollisionFrame;
  normalX: number;
  normalY: number;
  restitution?: number;
  contactFriction?: number;
  ballMassKg?: number;
  ballRadiusM?: number;
};

export type BallBallCollisionResult = {
  collided: boolean;
  normalImpulse: number;
  tangentialImpulse: number;
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function applyBallBallCollisionWithSpin(input: BallBallCollisionInput): BallBallCollisionResult {
  const restitution = input.restitution ?? BALL_BALL_RESTITUTION;
  const mu = input.contactFriction ?? BALL_BALL_CONTACT_FRICTION;
  const mass = input.ballMassKg ?? BALL_MASS_KG;
  const radius = input.ballRadiusM ?? BALL_RADIUS_M;

  const relativeVx = input.second.vx - input.first.vx;
  const relativeVy = input.second.vy - input.first.vy;
  const velocityAlongNormal = relativeVx * input.normalX + relativeVy * input.normalY;
  if (velocityAlongNormal >= 0) {
    return {
      collided: false,
      normalImpulse: 0,
      tangentialImpulse: 0,
    };
  }

  const inverseMassPair = 2 / mass;
  const normalImpulse = -((1 + restitution) * velocityAlongNormal) / inverseMassPair;
  const tangentX = -input.normalY;
  const tangentY = input.normalX;
  const tangentRelativeVelocity =
    relativeVx * tangentX + relativeVy * tangentY + radius * (input.first.spinY + input.second.spinY);

  const inertia = (2 / 5) * mass * radius * radius;
  const tangentEffectiveMass = inverseMassPair + (2 * radius * radius) / inertia;
  const uncappedTangentialImpulse = -tangentRelativeVelocity / Math.max(1e-6, tangentEffectiveMass);
  const maxTangentialImpulse = mu * Math.abs(normalImpulse);
  const tangentialImpulse = clampNumber(uncappedTangentialImpulse, -maxTangentialImpulse, maxTangentialImpulse);

  const impulseX = normalImpulse * input.normalX + tangentialImpulse * tangentX;
  const impulseY = normalImpulse * input.normalY + tangentialImpulse * tangentY;

  input.first.vx -= impulseX / mass;
  input.first.vy -= impulseY / mass;
  input.second.vx += impulseX / mass;
  input.second.vy += impulseY / mass;

  const spinDelta = (-5 * tangentialImpulse) / (2 * mass * radius);
  input.first.spinY += spinDelta;
  input.second.spinY += spinDelta;

  return {
    collided: true,
    normalImpulse,
    tangentialImpulse,
  };
}
