export type BallCollisionEvent = {
  type: 'BALL_COLLISION';
  atMs: number;
  sourceBallId: string;
  targetBallId: string;
};

export type CushionCollisionEvent = {
  type: 'CUSHION_COLLISION';
  atMs: number;
  sourceBallId: string;
  cushionId: string;
};

export type TurnCollisionEvent = BallCollisionEvent | CushionCollisionEvent;

export type ThreeCushionScoreInput = {
  cueBallId: string;
  objectBallIds: [string, string];
  events: TurnCollisionEvent[];
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export function isTurnCollisionEventList(events: unknown): events is TurnCollisionEvent[] {
  if (!Array.isArray(events)) {
    return false;
  }

  return events.every((event) => {
    if (!isRecord(event) || typeof event.type !== 'string' || typeof event.atMs !== 'number') {
      return false;
    }

    if (event.type === 'BALL_COLLISION') {
      return typeof event.sourceBallId === 'string' && typeof event.targetBallId === 'string';
    }

    if (event.type === 'CUSHION_COLLISION') {
      return typeof event.sourceBallId === 'string' && typeof event.cushionId === 'string';
    }

    return false;
  });
}

export function hasBothObjectBallContacts(input: ThreeCushionScoreInput): boolean {
  const contactedObjectBallIds = new Set(
    input.events.flatMap((event) => {
      if (event.type !== 'BALL_COLLISION') {
        return [];
      }

      if (event.sourceBallId !== input.cueBallId) {
        return [];
      }

      return [event.targetBallId];
    }),
  );

  return input.objectBallIds.every((objectBallId) => contactedObjectBallIds.has(objectBallId));
}

export function hasAtLeastThreeCushionContacts(input: ThreeCushionScoreInput): boolean {
  let firstObjectBallId: string | null = null;
  let secondObjectBallHit = false;
  let cushionCountBeforeSecondObject = 0;

  for (const event of input.events) {
    if (event.sourceBallId !== input.cueBallId) {
      continue;
    }

    if (event.type === 'CUSHION_COLLISION' && !secondObjectBallHit) {
      cushionCountBeforeSecondObject += 1;
      continue;
    }

    if (event.type === 'BALL_COLLISION') {
      if (!input.objectBallIds.includes(event.targetBallId as (typeof input.objectBallIds)[number])) {
        continue;
      }

      if (firstObjectBallId === null) {
        firstObjectBallId = event.targetBallId;
        continue;
      }

      if (event.targetBallId !== firstObjectBallId) {
        secondObjectBallHit = true;
        break;
      }
    }
  }

  return secondObjectBallHit && cushionCountBeforeSecondObject >= 3;
}

export function isValidThreeCushionScore(input: ThreeCushionScoreInput): boolean {
  return hasBothObjectBallContacts(input) && hasAtLeastThreeCushionContacts(input);
}
