export const SHOT_END_LINEAR_SPEED_THRESHOLD_MPS = 0.01;
export const SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS = 0.2;
export const SHOT_END_STABLE_FRAME_COUNT = 5;

export type ShotMotionSample = {
  linearSpeedMps: number;
  angularSpeedRadps: number;
};

export function isBelowShotEndThreshold(sample: ShotMotionSample): boolean {
  return sample.linearSpeedMps <= SHOT_END_LINEAR_SPEED_THRESHOLD_MPS
      && sample.angularSpeedRadps <= SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS;
}

export type ShotEndTracker = {
  stableFrameCount: number;
};

export type ShotEndEvaluation = {
  tracker: ShotEndTracker;
  isShotEnded: boolean;
};

export function initShotEndTracker(): ShotEndTracker {
  return {
    stableFrameCount: 0,
  };
}

export function evaluateShotEndWithFrames(
  tracker: ShotEndTracker,
  sample: ShotMotionSample,
  requiredStableFrames: number = SHOT_END_STABLE_FRAME_COUNT,
): ShotEndEvaluation {
  if (isBelowShotEndThreshold(sample)) {
    tracker.stableFrameCount += 1;
  } else {
    tracker.stableFrameCount = 0;
  }

  return {
    tracker,
    isShotEnded: tracker.stableFrameCount >= requiredStableFrames,
  };
}
