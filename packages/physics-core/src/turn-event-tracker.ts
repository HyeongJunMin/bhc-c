import type { TurnCollisionEvent } from './three-cushion-model.ts';

export type TurnEventTracker = {
  turnId: string;
  events: TurnCollisionEvent[];
};

export type TurnEventSnapshot = {
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

export function finalizeTurnEventTracker(tracker: TurnEventTracker): TurnEventSnapshot {
  return {
    turnId: tracker.turnId,
    events: [...tracker.events],
  };
}

export function resetTurnEventHistory(tracker: TurnEventTracker, nextTurnId: string): TurnEventTracker {
  tracker.turnId = nextTurnId;
  tracker.events = [];
  return tracker;
}
