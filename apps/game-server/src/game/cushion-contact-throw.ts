function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type CushionAxis = 'x' | 'y';

export type CushionContactThrowInput = {
  axis: CushionAxis;
  vx: number;
  vy: number;
  spinZ: number;
  restitution: number;
  contactFriction: number;
  referenceNormalSpeedMps: number;
  contactTimeExponent: number;
  maxSpinMagnitude: number;
  maxThrowAngleDeg: number;
  minNormalSpeedForThrowMps?: number;
  maxPostCollisionSpeedScale?: number;
};

export type CushionContactThrowResult = {
  vx: number;
  vy: number;
  throwTan: number;
  throwAngleDeg: number;
};

export function applyCushionContactThrow(input: CushionContactThrowInput): CushionContactThrowResult {
  const minNormalSpeed = input.minNormalSpeedForThrowMps ?? 0.05;
  const preVn = input.axis === 'x' ? input.vx : input.vy;
  const preVt = input.axis === 'x' ? input.vy : input.vx;

  let postVn = -preVn * input.restitution;
  const absPostVn = Math.abs(postVn);

  const safeRestitution = Math.max(0.01, input.restitution);
  const safeReferenceSpeed = Math.max(minNormalSpeed, input.referenceNormalSpeedMps);
  const baseTan = (input.contactFriction * (1 + safeRestitution)) / safeRestitution;
  const speedScale = Math.pow(safeReferenceSpeed / Math.max(absPostVn, minNormalSpeed), input.contactTimeExponent);
  const spinScale = clampNumber(Math.abs(input.spinZ) / Math.max(1e-6, input.maxSpinMagnitude), 0, 1);
  const rawThrowTan = baseTan * speedScale * spinScale;
  const maxThrowTan = Math.tan((input.maxThrowAngleDeg * Math.PI) / 180);
  const throwTan = clampNumber(rawThrowTan, 0, maxThrowTan);

  const throwDirection = Math.sign(input.spinZ);
  const dampedVt = preVt * (1 - input.contactFriction);
  const throwVt = throwDirection === 0 ? 0 : throwDirection * throwTan * absPostVn;
  let postVt = dampedVt + throwVt;

  // Protect against non-physical energy spikes from throw amplification.
  // Spin transfer can increase tangential speed, but cap the total post-collision speed
  // to a bounded multiple of pre-collision speed.
  const preSpeed = Math.hypot(preVn, preVt);
  const postSpeed = Math.hypot(postVn, postVt);
  const maxPostCollisionSpeedScale = input.maxPostCollisionSpeedScale ?? 1.02;
  if (preSpeed > 0 && postSpeed > preSpeed * maxPostCollisionSpeedScale) {
    const cappedPostSpeed = preSpeed * maxPostCollisionSpeedScale;
    const ratio = cappedPostSpeed / postSpeed;
    postVn *= ratio;
    postVt *= ratio;
  }

  const vx = input.axis === 'x' ? postVn : postVt;
  const vy = input.axis === 'x' ? postVt : postVn;
  const throwAngleDeg = Math.atan(throwTan) * (180 / Math.PI);

  return {
    vx,
    vy,
    throwTan,
    throwAngleDeg,
  };
}
