import type { PhysicsEvent } from './physics-events.ts';
import { isValidThreeCushionScore } from './three-cushion-model.ts';

export type ScoreAdapterInput = {
  cueBallId: string;
  objectBallIds: [string, string];
  events: PhysicsEvent[];
};

export type ScoreAdapterResult = {
  scored: boolean;
};

export function adaptPhysicsEventsToScore(input: ScoreAdapterInput): ScoreAdapterResult {
  const scored = isValidThreeCushionScore({
    cueBallId: input.cueBallId,
    objectBallIds: input.objectBallIds,
    events: input.events.filter((event) => event.type !== 'SHOT_END'),
  });

  return { scored };
}
