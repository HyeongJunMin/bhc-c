function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type CushionAxis = 'x' | 'y';

export type CushionContactThrowInput = {
  axis: CushionAxis;
  vx: number;
  vy: number;
  spinX?: number;
  spinY?: number;
  spinZ: number;
  restitution: number;
  contactFriction: number;
  referenceNormalSpeedMps: number;
  contactTimeExponent: number;
  maxSpinMagnitude: number;
  maxThrowAngleDeg: number;
  ballMassKg?: number;
  ballRadiusM?: number;
  cushionHeightM?: number;
  minNormalSpeedForThrowMps?: number;
};

export type CushionContactThrowResult = {
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  throwTan: number;
  throwAngleDeg: number;
};

export function applyCushionContactThrow(input: CushionContactThrowInput): CushionContactThrowResult {
  const minNormalSpeed = input.minNormalSpeedForThrowMps ?? 0.05;
  const preVn = input.axis === 'x' ? input.vx : input.vy;
  const preVt = input.axis === 'x' ? input.vy : input.vx;
  let spinX = input.spinX ?? 0;
  let spinY = input.spinY ?? 0;
  const spinZ = input.spinZ;

  const postVn = -preVn * input.restitution;
  const absPostVn = Math.abs(postVn);

  const safeRestitution = Math.max(0.01, input.restitution);
  const safeReferenceSpeed = Math.max(minNormalSpeed, input.referenceNormalSpeedMps);
  const baseTan = (input.contactFriction * (1 + safeRestitution)) / safeRestitution;
  const speedScale = Math.pow(safeReferenceSpeed / Math.max(absPostVn, minNormalSpeed), input.contactTimeExponent);
  const spinScale = clampNumber(Math.abs(spinZ) / Math.max(1e-6, input.maxSpinMagnitude), 0, 1);
  const rawThrowTan = baseTan * speedScale * spinScale;
  const maxThrowTan = Math.tan((input.maxThrowAngleDeg * Math.PI) / 180);
  const throwTan = clampNumber(rawThrowTan, 0, maxThrowTan);

  const throwDirection = Math.sign(spinZ);
  const dampedVt = preVt * (1 - input.contactFriction);
  const throwVt = throwDirection === 0 ? 0 : throwDirection * throwTan * absPostVn;
  const postVt = dampedVt + throwVt;

  const vx = input.axis === 'x' ? postVn : postVt;
  const vy = input.axis === 'x' ? postVt : postVn;
  const throwAngleDeg = Math.atan(throwTan) * (180 / Math.PI);

  // Approximate torque from cushion contact height above ball center.
  const ballMassKg = input.ballMassKg ?? 0.21;
  const ballRadiusM = input.ballRadiusM ?? 0.03075;
  const cushionHeightM = input.cushionHeightM ?? 0.037;
  const inertia = (2 / 5) * ballMassKg * ballRadiusM * ballRadiusM;
  const normalImpulse = ballMassKg * (1 + input.restitution) * Math.abs(preVn);
  const contactHeightOffsetM = cushionHeightM - ballRadiusM;
  const contactTorqueSpinDelta = (contactHeightOffsetM * normalImpulse) / Math.max(1e-6, inertia);
  const normalDirection = Math.sign(preVn) === 0 ? 1 : Math.sign(preVn);
  spinX += contactTorqueSpinDelta * normalDirection;

  // Partial conversion between side-axis spin and rolling-axis spin near cushion contact.
  const conversion = input.contactFriction * 0.08 * spinY;
  spinX += conversion;
  spinY -= conversion;

  return {
    vx,
    vy,
    spinX,
    spinY,
    spinZ,
    throwTan,
    throwAngleDeg,
  };
}
