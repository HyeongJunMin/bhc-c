export const CUE_MASS_KG = 0.5;
export const BALL_MASS_KG = 0.21;
export const TIP_RESTITUTION = 0.7;

export function computeInitialBallSpeed(
  cueSpeedMps: number,
  cueMassKg: number = CUE_MASS_KG,
  ballMassKg: number = BALL_MASS_KG,
  tipRestitution: number = TIP_RESTITUTION,
): number {
  return (cueMassKg * (1 + tipRestitution) / (cueMassKg + ballMassKg)) * cueSpeedMps;
}

export function solveCueSpeedForTargetBallSpeed(
  targetBallSpeedMps: number,
  cueMassKg: number = CUE_MASS_KG,
  ballMassKg: number = BALL_MASS_KG,
  tipRestitution: number = TIP_RESTITUTION,
): number {
  return targetBallSpeedMps * (cueMassKg + ballMassKg) / (cueMassKg * (1 + tipRestitution));
}
