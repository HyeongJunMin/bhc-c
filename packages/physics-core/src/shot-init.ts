import { computeInitialAngularVelocity } from './initial-angular-velocity.ts';
import { computeInitialBallSpeed, solveCueSpeedForTargetBallSpeed } from './initial-velocity.ts';
import { computeSquirtAngleRad } from './squirt.ts';

export const MIN_DRAG_PX = 10;
export const MAX_DRAG_PX = 400;
export const MIN_BALL_SPEED_MPS = 1;
export const MAX_BALL_SPEED_MPS = 13.89;
const BALL_RADIUS_M = 0.03075;
export const MAX_IMPACT_OFFSET_M = BALL_RADIUS_M * 0.7;
const CUE_ELEVATION_RAD = (3 * Math.PI) / 180;

export type ShotInitInput = {
  dragPx: number;
  impactOffsetX: number;
  impactOffsetY: number;
};

export type ShotInitResult = {
  initialBallSpeedMps: number;
  omegaX: number;
  omegaY: number;
  omegaZ: number;
  squirtAngleRad: number;
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

  // Swerve from cue elevation: side english (omegaZ) creates a small X-rolling component (omegaY).
  const omegaY = angularVelocity.omegaZ * Math.sin(CUE_ELEVATION_RAD);

  return {
    initialBallSpeedMps,
    omegaX: angularVelocity.omegaX,
    omegaY,
    omegaZ: angularVelocity.omegaZ,
    squirtAngleRad: computeSquirtAngleRad({ impactOffsetX, ballRadiusM: BALL_RADIUS_M }),
  };
}
