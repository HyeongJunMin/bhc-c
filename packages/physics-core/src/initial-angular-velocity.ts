export const CUE_BALL_RADIUS_M = 0.03075;
const REFERENCE_MAX_BALL_SPEED_MPS = 13.89;

export type AngularVelocity = {
  omegaX: number;
  omegaZ: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeInitialAngularVelocity(
  initialBallSpeedMps: number,
  impactOffsetX: number,
  impactOffsetY: number,
  cueBallRadiusM: number = CUE_BALL_RADIUS_M,
): AngularVelocity {
  const denominator = 2 * cueBallRadiusM * cueBallRadiusM;
  // Tune: reduce initial top/back spin energy so cushion outcome stays natural.
  const initialSpinScale = 3.2;
  const normalizedSpeed = clamp(initialBallSpeedMps / REFERENCE_MAX_BALL_SPEED_MPS, 0, 1);
  // Weak strokes should not create disproportionately strong spin.
  // Keep strong strokes near current behavior.
  const speedSpinFactor = clamp(Math.pow(normalizedSpeed, 0.75), 0.18, 1);
  const effectiveSpinScale = initialSpinScale * speedSpinFactor;

  return {
    omegaX: (effectiveSpinScale * initialBallSpeedMps * impactOffsetY) / denominator,
    omegaZ: (effectiveSpinScale * initialBallSpeedMps * impactOffsetX) / denominator,
  };
}
