export const CUE_BALL_RADIUS_M = 0.03075;
export const MISCUE_THRESHOLD_RATIO = 0.9;

export function isMiscue(
  impactOffsetX: number,
  impactOffsetY: number,
  cueBallRadiusM: number = CUE_BALL_RADIUS_M,
): boolean {
  const offsetDistance = Math.hypot(impactOffsetX, impactOffsetY);
  return offsetDistance > MISCUE_THRESHOLD_RATIO * cueBallRadiusM;
}
