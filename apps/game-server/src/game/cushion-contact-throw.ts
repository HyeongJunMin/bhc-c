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
  rollingSpinHeightFactor?: number;
  cushionTorqueDamping?: number;
  maxSpeedScale?: number;
  restitutionLow?: number;
  restitutionHigh?: number;
  restitutionMidSpeedMps?: number;
  restitutionSigmoidK?: number;
};

export type CushionContactThrowResult = {
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  throwTan: number;
  throwAngleDeg: number;
  effectiveSpin: number;
  throwDirection: -1 | 0 | 1;
};

// Speed-dependent restitution: real cushion rubber absorbs more energy at higher impact speeds.
// Uses a sigmoid curve between restitutionLow (slow) and restitutionHigh (fast).
function computeSpeedDependentRestitution(
  absNormalSpeed: number,
  baseRestitution: number,
  restitutionLow?: number,
  restitutionHigh?: number,
  midSpeedMps?: number,
  sigmoidK?: number,
): number {
  if (restitutionLow === undefined || restitutionHigh === undefined) {
    return baseRestitution;
  }
  const mid = midSpeedMps ?? 2.0;
  const k = sigmoidK ?? 1.5;
  const t = 1 / (1 + Math.exp(-k * (absNormalSpeed - mid)));
  return restitutionLow + (restitutionHigh - restitutionLow) * t;
}

export function applyCushionContactThrow(input: CushionContactThrowInput): CushionContactThrowResult {
  const minNormalSpeed = input.minNormalSpeedForThrowMps ?? 0.05;
  const preVn = input.axis === 'x' ? input.vx : input.vy;
  const preVt = input.axis === 'x' ? input.vy : input.vx;
  let spinX = input.spinX ?? 0; // Y-direction rolling (vz)
  let spinY = input.spinY ?? 0; // Side Spin (English)
  let spinZ = input.spinZ ?? 0; // X-direction rolling (vx)

  const effectiveRestitution = computeSpeedDependentRestitution(
    Math.abs(preVn),
    input.restitution,
    input.restitutionLow,
    input.restitutionHigh,
    input.restitutionMidSpeedMps,
    input.restitutionSigmoidK,
  );
  const postVn = -preVn * effectiveRestitution;
  const absPostVn = Math.abs(postVn);

  // Contact point geometry: cushion contacts ball at height h above ball center.
  // d = horizontal distance from ball center to contact point on ball surface.
  const ballMassKg = input.ballMassKg ?? 0.21;
  const ballRadiusM = input.ballRadiusM ?? 0.03075;
  const cushionHeightM = input.cushionHeightM ?? 0.037;
  const h = cushionHeightM - ballRadiusM;
  const d = Math.sqrt(Math.max(0, ballRadiusM * ballRadiusM - h * h));

  // normalDirection: +1 if ball approaches from positive side, -1 from negative side.
  const normalDirection = Math.sign(preVn) === 0 ? 1 : Math.sign(preVn);

  // Effective spin: tangential surface velocity at the contact point due to spin (ω × r_contact).
  // Standardized axes: spinY=side, spinX=Z-roll, spinZ=X-roll.
  //
  // For z-axis cushion (axis='y', world z-normal): r_contact = (0, h, normalDir·d)
  //   (ω × r)_x = spinY·d·normalDir − spinZ·h·rollingFactor
  //
  // For x-axis cushion (axis='x', world x-normal): r_contact = (normalDir·d, h, 0)
  //   (ω × r)_z = spinX·h·rollingFactor − spinY·d·normalDir
  const rollingFactor = input.rollingSpinHeightFactor ?? 1.0;
  const effectiveSpin =
    input.axis === 'x'
      ? spinX * h * rollingFactor - normalDirection * spinY * d
      : normalDirection * spinY * d - spinZ * h * rollingFactor;

  const safeRestitution = Math.max(0.01, effectiveRestitution);
  const safeReferenceSpeed = Math.max(minNormalSpeed, input.referenceNormalSpeedMps);
  const baseTan = (input.contactFriction * (1 + safeRestitution)) / safeRestitution;
  const rawSpeedScale = Math.pow(safeReferenceSpeed / Math.max(absPostVn, minNormalSpeed), input.contactTimeExponent);
  const speedScale = input.maxSpeedScale !== undefined
    ? Math.min(rawSpeedScale, input.maxSpeedScale)
    : rawSpeedScale;
  const spinScale = clampNumber(Math.abs(effectiveSpin) / Math.max(1e-6, input.maxSpinMagnitude), 0, 1);
  const rawThrowTan = baseTan * speedScale * spinScale;
  const maxThrowTan = Math.tan((input.maxThrowAngleDeg * Math.PI) / 180);
  const throwTan = clampNumber(rawThrowTan, 0, maxThrowTan);

  const throwDirection = Math.sign(effectiveSpin) as -1 | 0 | 1;
  const dampedVt = preVt * (1 - input.contactFriction);
  const throwVt = throwDirection === 0 ? 0 : throwDirection * throwTan * absPostVn;
  const postVt = dampedVt + throwVt;

  const vx = input.axis === 'x' ? postVn : postVt;
  const vy = input.axis === 'x' ? postVt : postVn;
  const throwAngleDeg = Math.atan(throwTan) * (180 / Math.PI);

  // Torque from cushion contact height above ball center.
  // cushionTorqueDamping < 1.0 accounts for energy absorbed by cushion rubber deformation,
  // preventing unrealistic spin spikes that arise from treating the cushion as a rigid body.
  const inertia = (2 / 5) * ballMassKg * ballRadiusM * ballRadiusM;
  const normalImpulse = ballMassKg * (1 + effectiveRestitution) * Math.abs(preVn);
  const torqueDamping = input.cushionTorqueDamping ?? 1.0;
  const contactTorqueSpinDelta = ((h * normalImpulse) / Math.max(1e-6, inertia)) * torqueDamping;

  if (input.axis === 'x') {
    // X-axis cushion affects rolling spin along X (spinZ)
    spinZ += contactTorqueSpinDelta * normalDirection;
  } else {
    // Y(Z)-axis cushion affects rolling spin along Z (spinX)
    spinX += contactTorqueSpinDelta * normalDirection;
  }

  // Partial conversion between side-axis spin and rolling-axis spin near cushion contact.
  const conversion = input.contactFriction * 0.08 * spinY;
  if (input.axis === 'x') {
    // Side spin to rolling along the cushion (Y/Z direction -> spinX)
    spinX += conversion;
  } else {
    // Side spin to rolling along the cushion (X direction -> spinZ)
    spinZ += conversion;
  }
  spinY -= conversion;

  return {
    vx,
    vy,
    spinX,
    spinY,
    spinZ,
    throwTan,
    throwAngleDeg,
    effectiveSpin,
    throwDirection,
  };
}
