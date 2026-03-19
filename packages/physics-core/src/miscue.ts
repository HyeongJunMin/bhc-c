export const CUE_BALL_RADIUS_M = 0.03075;
export const MISCUE_SAFE_RATIO = 0.5;
export const MISCUE_CERTAIN_RATIO = 0.85;

export function isMiscue(
  impactOffsetX: number,
  impactOffsetY: number,
  cueBallRadiusM: number = CUE_BALL_RADIUS_M,
): boolean {
  const ratio = Math.hypot(impactOffsetX, impactOffsetY) / cueBallRadiusM;
  if (ratio <= MISCUE_SAFE_RATIO) return false;
  if (ratio >= MISCUE_CERTAIN_RATIO) return true;
  const t = (ratio - MISCUE_SAFE_RATIO) / (MISCUE_CERTAIN_RATIO - MISCUE_SAFE_RATIO);
  return Math.random() < t * t;
}
