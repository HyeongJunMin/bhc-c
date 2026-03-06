import { computeInitialAngularVelocity } from './initial-angular-velocity.ts';
import { computeInitialBallSpeed, solveCueSpeedForTargetBallSpeed } from './initial-velocity.ts';
import { BALL_RADIUS_M, MAX_BALL_SPEED_MPS as MAX_SPEED_MPS } from './constants.ts';

export const MIN_DRAG_PX = 10;
export const MAX_DRAG_PX = 400;
export const MIN_BALL_SPEED_MPS = 1;
export const MAX_BALL_SPEED_MPS = MAX_SPEED_MPS;
// Limit to 70% of ball radius to avoid miscue territory (>70% is physically unrealistic)
export const MAX_IMPACT_OFFSET_M = BALL_RADIUS_M * 0.7;

export type ShotInitInput = {
  dragPx: number;
  impactOffsetX: number;
  impactOffsetY: number;
};

export type ShotInitResult = {
  initialBallSpeedMps: number;
  omegaX: number;
  omegaY: number;
};

function clamp(value: number, min: number, max: number): number {
  if (value < min) {
    return min;
  }

  if (value > max) {
    return max;
  }

  return value;
}

function mapDragPxToTargetBallSpeed(dragPx: number): number {
  const clampedDragPx = clamp(dragPx, MIN_DRAG_PX, MAX_DRAG_PX);
  const ratio = (clampedDragPx - MIN_DRAG_PX) / (MAX_DRAG_PX - MIN_DRAG_PX);

  return MIN_BALL_SPEED_MPS + ratio * (MAX_BALL_SPEED_MPS - MIN_BALL_SPEED_MPS);
}

export function computeShotInitialization(input: ShotInitInput): ShotInitResult {
  const targetBallSpeed = mapDragPxToTargetBallSpeed(input.dragPx);
  const cueSpeed = solveCueSpeedForTargetBallSpeed(targetBallSpeed);
  const initialBallSpeedMps = clamp(
    computeInitialBallSpeed(cueSpeed),
    MIN_BALL_SPEED_MPS,
    MAX_BALL_SPEED_MPS,
  );

  const impactOffsetX = clamp(input.impactOffsetX, -MAX_IMPACT_OFFSET_M, MAX_IMPACT_OFFSET_M);
  const impactOffsetY = clamp(input.impactOffsetY, -MAX_IMPACT_OFFSET_M, MAX_IMPACT_OFFSET_M);
  const angularVelocity = computeInitialAngularVelocity(initialBallSpeedMps, impactOffsetX, impactOffsetY);

  return {
    initialBallSpeedMps,
    omegaX: angularVelocity.omegaX,
    omegaY: angularVelocity.omegaY,
  };
}
