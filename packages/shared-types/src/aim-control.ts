export type AimControlMode = 'AUTO_SYNC' | 'MANUAL_AIM';

export const AIM_CONTROL_CONTRACT = {
  defaultMode: 'AUTO_SYNC' as AimControlMode,
  manualArrowStepDeg: 5,
  cameraSyncEpsilonDeg: 0.2,
} as const;

