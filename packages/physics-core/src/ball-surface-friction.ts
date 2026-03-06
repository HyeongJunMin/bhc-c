import {
  GRAVITY_ACCELERATION_MPS2,
  ROLLING_FRICTION_COEFFICIENT,
  SLIDING_FRICTION_COEFFICIENT,
  SLIP_SPEED_THRESHOLD_MPS,
  STATIONARY_ANGULAR_SPEED_THRESHOLD_RADPS,
  STATIONARY_LINEAR_SPEED_THRESHOLD_MPS,
} from './constants.ts';

export type BallMotionState = 'SLIDING' | 'ROLLING' | 'SPINNING' | 'STATIONARY';

export type BallSurfaceFrictionInput = {
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  radiusM: number;
  dtSec: number;
  slidingFriction?: number;
  rollingFriction?: number;
  gravityMps2?: number;
  slipThresholdMps?: number;
  stationaryLinearThresholdMps?: number;
  stationaryAngularThresholdRadps?: number;
  spinYDampingPerSec?: number;
};

export type BallSurfaceFrictionResult = {
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  motionState: BallMotionState;
};

function clamp01(value: number): number {
  if (value <= 0) {
    return 0;
  }
  if (value >= 1) {
    return 1;
  }
  return value;
}

export function applyBallSurfaceFriction(input: BallSurfaceFrictionInput): BallSurfaceFrictionResult {
  const muS = input.slidingFriction ?? SLIDING_FRICTION_COEFFICIENT;
  const muR = input.rollingFriction ?? ROLLING_FRICTION_COEFFICIENT;
  const g = input.gravityMps2 ?? GRAVITY_ACCELERATION_MPS2;
  const slipThreshold = input.slipThresholdMps ?? SLIP_SPEED_THRESHOLD_MPS;
  const linearThreshold = input.stationaryLinearThresholdMps ?? STATIONARY_LINEAR_SPEED_THRESHOLD_MPS;
  const angularThreshold = input.stationaryAngularThresholdRadps ?? STATIONARY_ANGULAR_SPEED_THRESHOLD_RADPS;
  const dt = Math.max(0, input.dtSec);
  const radius = Math.max(1e-6, input.radiusM);

  let vx = input.vx;
  let vy = input.vy;
  let spinX = input.spinX;
  let spinY = input.spinY;
  let spinZ = input.spinZ;

  const vSlipX = vx + radius * spinZ;
  const vSlipY = vy - radius * spinX;
  const vSlip = Math.hypot(vSlipX, vSlipY);

  if (vSlip > slipThreshold) {
    const slipDirX = vSlipX / vSlip;
    const slipDirY = vSlipY / vSlip;
    const linearDelta = muS * g * dt;
    const angularDelta = ((5 * muS * g) / (2 * radius)) * dt;

    vx -= linearDelta * slipDirX;
    vy -= linearDelta * slipDirY;
    spinZ -= angularDelta * slipDirX;
    spinX += angularDelta * slipDirY;

    const nextSlipX = vx + radius * spinZ;
    const nextSlipY = vy - radius * spinX;
    const nextDot = nextSlipX * vSlipX + nextSlipY * vSlipY;
    if (nextDot < 0) {
      const vxRoll = (5 * vx - 2 * radius * spinZ) / 7;
      const vyRoll = (5 * vy + 2 * radius * spinX) / 7;
      vx = vxRoll;
      vy = vyRoll;
      spinZ = -vx / radius;
      spinX = vy / radius;
    }
  } else {
    const speed = Math.hypot(vx, vy);
    if (speed > 0) {
      const speedAfter = Math.max(0, speed - muR * g * dt);
      const ratio = speed > 0 ? speedAfter / speed : 0;
      vx *= ratio;
      vy *= ratio;
    }
    spinZ = -vx / radius;
    spinX = vy / radius;
  }

  const spinYDampingPerSec = input.spinYDampingPerSec ?? 0.15;
  const spinYDampingFactor = clamp01(1 - spinYDampingPerSec * dt);
  spinY *= spinYDampingFactor;

  const linearSpeed = Math.hypot(vx, vy);
  const angularSpeed = Math.hypot(spinX, spinY, spinZ);

  let motionState: BallMotionState;
  if (linearSpeed <= linearThreshold && angularSpeed <= angularThreshold) {
    motionState = 'STATIONARY';
    vx = 0;
    vy = 0;
    spinX = 0;
    spinY = 0;
    spinZ = 0;
  } else if (linearSpeed <= linearThreshold) {
    motionState = 'SPINNING';
  } else if (vSlip > slipThreshold) {
    motionState = 'SLIDING';
  } else {
    motionState = 'ROLLING';
  }

  return {
    vx,
    vy,
    spinX,
    spinY,
    spinZ,
    motionState,
  };
}
