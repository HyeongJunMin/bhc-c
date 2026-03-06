export const CUE_BALL_RADIUS_M = 0.03075;

export type AngularVelocity = {
  omegaX: number;
  omegaY: number;
};

export function computeInitialAngularVelocity(
  initialBallSpeedMps: number,
  impactOffsetX: number,
  impactOffsetY: number,
  cueBallRadiusM: number = CUE_BALL_RADIUS_M,
): AngularVelocity {
  const denominator = 2 * cueBallRadiusM * cueBallRadiusM;

  return {
    omegaX: (5 * initialBallSpeedMps * impactOffsetY) / denominator,
    omegaY: (5 * initialBallSpeedMps * impactOffsetX) / denominator,
  };
}
