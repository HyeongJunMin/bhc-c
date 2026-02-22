import type { TurnCollisionEvent } from './three-cushion-model.ts';

export type TurnEventTracker = {
  turnId: string;
  events: TurnCollisionEvent[];
};

export function initTurnEventTracker(turnId: string): TurnEventTracker {
  return {
    turnId,
    events: [],
  };
}

export function appendTurnEvent(tracker: TurnEventTracker, event: TurnCollisionEvent): TurnEventTracker {
  tracker.events.push(event);
  return tracker;
}
