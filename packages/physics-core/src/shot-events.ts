export type ShotEvent =
  | {
      type: 'SHOT_VALID';
      applyCueImpulse: true;
      endTurnImmediately: false;
    }
  | {
      type: 'SHOT_MISCUE';
      applyCueImpulse: false;
      endTurnImmediately: true;
    };

export function mapShotEventFromMiscue(isMiscue: boolean): ShotEvent {
  if (isMiscue) {
    return {
      type: 'SHOT_MISCUE',
      applyCueImpulse: false,
      endTurnImmediately: true,
    };
  }

  return {
    type: 'SHOT_VALID',
    applyCueImpulse: true,
    endTurnImmediately: false,
  };
}
