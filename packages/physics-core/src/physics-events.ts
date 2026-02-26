export type PhysicsBallCollisionEvent = {
  type: 'BALL_COLLISION';
  atMs: number;
  sourceBallId: string;
  targetBallId: string;
};

export type PhysicsCushionCollisionEvent = {
  type: 'CUSHION_COLLISION';
  atMs: number;
  sourceBallId: string;
  cushionId: string;
};

export type PhysicsShotEndEvent = {
  type: 'SHOT_END';
  atMs: number;
};

export type PhysicsEvent = PhysicsBallCollisionEvent | PhysicsCushionCollisionEvent | PhysicsShotEndEvent;

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isPhysicsEvent(value: unknown): value is PhysicsEvent {
  if (!isRecord(value) || typeof value.type !== 'string' || typeof value.atMs !== 'number') {
    return false;
  }

  if (value.type === 'BALL_COLLISION') {
    return typeof value.sourceBallId === 'string' && typeof value.targetBallId === 'string';
  }

  if (value.type === 'CUSHION_COLLISION') {
    return typeof value.sourceBallId === 'string' && typeof value.cushionId === 'string';
  }

  if (value.type === 'SHOT_END') {
    return true;
  }

  return false;
}
