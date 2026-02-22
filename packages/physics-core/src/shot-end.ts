export const SHOT_END_LINEAR_SPEED_THRESHOLD_MPS = 0.02;
export const SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS = 0.2;
export const SHOT_END_STABLE_FRAME_COUNT = 5;

export type ShotMotionSample = {
  linearSpeedMps: number;
  angularSpeedRadps: number;
};

export function isBelowShotEndThreshold(sample: ShotMotionSample): boolean {
  return (
    sample.linearSpeedMps <= SHOT_END_LINEAR_SPEED_THRESHOLD_MPS &&
    sample.angularSpeedRadps <= SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS
  );
}
