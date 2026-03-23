export const CUE_BALL_RADIUS_M = 0.03075;

// Theoretical spin scale from rigid body impulse (perfect contact)
const THEORETICAL_SPIN_SCALE = 5.0;
// Cue tip-ball contact transfer efficiency (elastic deformation + slip losses)
export const SPIN_TRANSFER_EFFICIENCY = 0.7;

export type AngularVelocity = {
  omegaX: number;
  omegaZ: number;
};

export function computeInitialAngularVelocity(
  initialBallSpeedMps: number,
  impactOffsetX: number,
  impactOffsetY: number,
  cueBallRadiusM: number = CUE_BALL_RADIUS_M,
): AngularVelocity {
  const denominator = 2 * cueBallRadiusM * cueBallRadiusM;
  const initialSpinScale = THEORETICAL_SPIN_SCALE * SPIN_TRANSFER_EFFICIENCY;

  return {
    omegaX: (initialSpinScale * initialBallSpeedMps * impactOffsetY) / denominator,
    omegaZ: (initialSpinScale * initialBallSpeedMps * impactOffsetX) / denominator,
  };
}
