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

const DEFAULT_SLIDING_FRICTION = 0.2;
const DEFAULT_ROLLING_FRICTION = 0.012;
const DEFAULT_GRAVITY_MPS2 = 9.81;
const DEFAULT_SLIP_THRESHOLD_MPS = 0.01;
const DEFAULT_STATIONARY_LINEAR_THRESHOLD_MPS = 0.01;
const DEFAULT_STATIONARY_ANGULAR_THRESHOLD_RADPS = 0.2;

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
  const muS = input.slidingFriction ?? DEFAULT_SLIDING_FRICTION;
  const muR = input.rollingFriction ?? DEFAULT_ROLLING_FRICTION;
  const g = input.gravityMps2 ?? DEFAULT_GRAVITY_MPS2;
  const slipThreshold = input.slipThresholdMps ?? DEFAULT_SLIP_THRESHOLD_MPS;
  const linearThreshold = input.stationaryLinearThresholdMps ?? DEFAULT_STATIONARY_LINEAR_THRESHOLD_MPS;
  const angularThreshold = input.stationaryAngularThresholdRadps ?? DEFAULT_STATIONARY_ANGULAR_THRESHOLD_RADPS;
  const dt = Math.max(0, input.dtSec);
  const radius = Math.max(1e-6, input.radiusM);

  let vx = input.vx;
  let vy = input.vy;
  let spinX = input.spinX;
  let spinY = input.spinY;
  let spinZ = input.spinZ;

  // bhc2 convention: spinY = X-direction rolling, spinZ = vertical-axis spin (side english)
  const vSlipX = vx + radius * spinY;
  const vSlipY = vy - radius * spinX;
  const vSlip = Math.hypot(vSlipX, vSlipY);

  if (vSlip > slipThreshold) {
    const slipDirX = vSlipX / vSlip;
    const slipDirY = vSlipY / vSlip;
    const linearDelta = muS * g * dt;
    const angularDelta = ((5 * muS * g) / (2 * radius)) * dt;

    const totalSlipDecrease = linearDelta + radius * angularDelta;

    if (vSlip <= totalSlipDecrease) {
      // 이번 서브스텝 내에 슬립이 소멸됨 → t*에서 정확히 전환
      const tStar = vSlip / totalSlipDecrease;

      // t*까지만 슬라이딩 마찰 적용
      vx -= linearDelta * tStar * slipDirX;
      vy -= linearDelta * tStar * slipDirY;
      spinY -= angularDelta * tStar * slipDirX;
      spinX += angularDelta * tStar * slipDirY;

      // 롤링 조건으로 스냅
      const vxRoll = (5 * vx - 2 * radius * spinY) / 7;
      const vyRoll = (5 * vy + 2 * radius * spinX) / 7;
      vx = vxRoll;
      vy = vyRoll;
      spinY = -vx / radius;
      spinX = vy / radius;

      // 나머지 (1 - tStar) 구간은 롤링 마찰 적용
      const dtRemain = dt * (1 - tStar);
      const speedRemain = Math.hypot(vx, vy);
      if (speedRemain > 0 && dtRemain > 0) {
        const decel = muR * g * dtRemain;
        const factor = Math.max(0, speedRemain - decel) / speedRemain;
        vx *= factor;
        vy *= factor;
        spinY = -vx / radius;
        spinX = vy / radius;
      }
    } else {
      // 슬립이 이번 스텝에서 소멸하지 않음 → 전체 dt만큼 슬라이딩 마찰 적용
      vx -= linearDelta * slipDirX;
      vy -= linearDelta * slipDirY;
      spinY -= angularDelta * slipDirX;
      spinX += angularDelta * slipDirY;
    }
  } else {
    const speed = Math.hypot(vx, vy);
    if (speed > 0) {
      const speedAfter = Math.max(0, speed - muR * g * dt);
      const ratio = speedAfter / speed;
      vx *= ratio;
      vy *= ratio;
    }
    spinY = -vx / radius;
    spinX = vy / radius;
  }

  const spinZDampingPerSec = input.spinYDampingPerSec ?? 0.15;
  const spinZDampingFactor = clamp01(1 - spinZDampingPerSec * dt);
  spinZ *= spinZDampingFactor;

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
