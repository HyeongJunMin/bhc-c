// bhc2 spin axis convention:
//   spinX = Y-direction rolling (couples to vy)
//   spinY = X-direction rolling (couples to vx)
//   spinZ = vertical-axis spin  (side english, no linear coupling)
//
// This is ported from bhc cushion-contact-throw with spinY↔spinZ swapped.

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type CushionAxis = 'x' | 'y';

export type CushionContactThrowInput = {
  axis: CushionAxis;
  vx: number;
  vy: number;
  spinX?: number;   // Y-direction rolling
  spinY?: number;   // X-direction rolling
  spinZ?: number;   // Side Spin (English) - vertical axis
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
  frictionSpinDamping?: number;
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

  // bhc2 convention: spinX=Y-rolling, spinY=X-rolling, spinZ=side english
  let spinX = input.spinX ?? 0; // Y-direction rolling
  let spinY = input.spinY ?? 0; // X-direction rolling
  let spinZ = input.spinZ ?? 0; // Side Spin (English)

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

  const ballMassKg = input.ballMassKg ?? 0.21;
  const ballRadiusM = input.ballRadiusM ?? 0.03075;
  const cushionHeightM = input.cushionHeightM ?? 0.037;
  const h = cushionHeightM - ballRadiusM;
  const d = Math.sqrt(Math.max(0, ballRadiusM * ballRadiusM - h * h));

  const normalDirection = Math.sign(preVn) === 0 ? 1 : Math.sign(preVn);

  // Effective spin at cushion contact point.
  // bhc2 axes: spinZ=side english, spinY=X-rolling, spinX=Y-rolling
  // (bhc had: spinY=side, spinZ=X-rolling — swapped here)
  //
  // For x-axis cushion: r_contact = (normalDir·d, h, 0)
  //   (ω × r)_tangential = spinX·h·rollingFactor − normalDir·spinZ·d
  //
  // For y-axis cushion: r_contact = (0, h, normalDir·d)
  //   (ω × r)_tangential = normalDir·spinZ·d − spinY·h·rollingFactor
  const rollingFactor = input.rollingSpinHeightFactor ?? 1.0;
  const effectiveSpin =
    input.axis === 'x'
      ? spinX * h * rollingFactor - normalDirection * spinZ * d
      : normalDirection * spinZ * d - spinY * h * rollingFactor;

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
  const inertia = (2 / 5) * ballMassKg * ballRadiusM * ballRadiusM;
  const normalImpulse = ballMassKg * (1 + effectiveRestitution) * Math.abs(preVn);
  const torqueDamping = input.cushionTorqueDamping ?? 1.0;
  const contactTorqueSpinDelta = ((h * normalImpulse) / Math.max(1e-6, inertia)) * torqueDamping;

  if (input.axis === 'x') {
    // X-axis cushion affects X-rolling spin (spinY in bhc2)
    spinY += contactTorqueSpinDelta * normalDirection;
  } else {
    // Y-axis cushion affects Y-rolling spin (spinX in bhc2)
    spinX += contactTorqueSpinDelta * normalDirection;
  }

  // Spin depletion from throw: angular momentum reaction to the tangential friction impulse.
  // throwVt adds linear KE from spin energy; without depleting spin here, total KE increases.
  // r_contact × J_tangential gives the angular impulse that reduces the causative spin.
  //
  // x-axis cushion: r = (normalDir·d, 0, h), J_tang in y
  //   ΔspinX = -(h/I)·J_t    (rotation about table-x)
  //   ΔspinZ = (normalDir·d/I)·J_t  (rotation about vertical z, side english)
  //
  // y-axis cushion: r = (0, normalDir·d, h), J_tang in x
  //   ΔspinY =  (h/I)·J_t    (rotation about table-y)
  //   ΔspinZ = -(normalDir·d/I)·J_t  (rotation about vertical z, side english)
  const throwAngularImpulse = ballMassKg * throwVt;
  if (input.axis === 'x') {
    spinX -= (h * throwAngularImpulse) / inertia;
    spinZ += (normalDirection * d * throwAngularImpulse) / inertia;
  } else {
    spinY += (h * throwAngularImpulse) / inertia;
    spinZ -= (normalDirection * d * throwAngularImpulse) / inertia;
  }

  // Partial conversion between side english and rolling spin.
  // (bhc had: 0.08 * spinY; bhc2 side english is spinZ)
  const conversion = input.contactFriction * 0.08 * spinZ;
  if (input.axis === 'x') {
    spinX += conversion;
  } else {
    spinY += conversion;
  }
  spinZ -= conversion;

  // Blend rolling spin toward rolling condition after velocity reversal.
  const rollingBlend = input.frictionSpinDamping ?? 0;
  if (rollingBlend > 0) {
    if (input.axis === 'x') {
      // x-axis cushion: vx reverses. Rolling condition: spinY = -vx/R
      const targetSpinY = -postVn / ballRadiusM;
      spinY = spinY + (targetSpinY - spinY) * rollingBlend;
    } else {
      // y-axis cushion: vy reverses. Rolling condition: spinX = vy/R
      const targetSpinX = postVn / ballRadiusM;
      spinX = spinX + (targetSpinX - spinX) * rollingBlend;
    }
  }

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
