export type ImpulseBody2D = {
  vx: number;
  vy: number;
  spinX?: number;  // top/backspin (Y-axis rolling)
  spinY?: number;  // X-axis rolling
  // bhc2 convention: spinZ = vertical-axis spin (side english), used for tangential contact velocity
  spinZ?: number;
};

export type BallBallImpulseInput = {
  normalX: number;
  normalY: number;
  restitution: number;
  mass1Kg?: number;
  mass2Kg?: number;
  contactFriction?: number;
  ballRadiusM?: number;
};

export type BallBallImpulseResult = {
  collided: boolean;
  impulseN: number;
  tangentialImpulse: number;
  spinXDelta: number;
  spinYDelta: number;
};

export type CushionAxis = 'x' | 'y';

export type BallCushionImpulseInput = {
  axis: CushionAxis;
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  restitution: number;
  friction: number;
  maxSpinMagnitude: number;
  maxThrowAngleDeg: number;
  ballMassKg: number;
  ballRadiusM: number;
  ballInertiaKgM2: number;
  restitutionLow?: number;
  restitutionHigh?: number;
  restitutionMidSpeedMps?: number;
  restitutionSigmoidK?: number;
};

export type BallCushionImpulseResult = {
  vx: number;
  vy: number;
  spinZ: number;
  throwTan: number;
  throwAngleDeg: number;
  impulseN: number;
  impulseT: number;
};

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Speed-dependent cushion restitution: real cushion rubber absorbs more energy at higher impact speeds.
// Sigmoid curve between restitutionLow (slow, elastic) and restitutionHigh (fast, absorbing).
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

function computeLowSpeedBallBallRestitution(baseRestitution: number, approachSpeedMps: number): number {
  if (baseRestitution >= 0.999) {
    return baseRestitution;
  }
  const lowSpeedBandMps = 0.9;
  const lowSpeedFactor = clampNumber((lowSpeedBandMps - approachSpeedMps) / lowSpeedBandMps, 0, 1);
  // Slightly deaden weak contacts so near-stop impacts don't feel bouncy.
  return clampNumber(baseRestitution * (1 - (0.2 * lowSpeedFactor)), 0.05, 0.999);
}

export function solveBallBallImpulse(
  first: ImpulseBody2D,
  second: ImpulseBody2D,
  input: BallBallImpulseInput,
): BallBallImpulseResult {
  if (!Number.isFinite(input.normalX) || !Number.isFinite(input.normalY)) {
    return { collided: false, impulseN: 0, tangentialImpulse: 0, spinXDelta: 0, spinYDelta: 0 };
  }
  const normalLen = Math.hypot(input.normalX, input.normalY);
  if (normalLen <= 1e-9) {
    return { collided: false, impulseN: 0, tangentialImpulse: 0, spinXDelta: 0, spinYDelta: 0 };
  }
  const nx = input.normalX / normalLen;
  const ny = input.normalY / normalLen;
  const mass1 = input.mass1Kg ?? 1;
  const mass2 = input.mass2Kg ?? 1;
  const invMass1 = mass1 > 0 ? 1 / mass1 : 0;
  const invMass2 = mass2 > 0 ? 1 / mass2 : 0;
  const invMassSum = invMass1 + invMass2;
  if (invMassSum <= 0) {
    return { collided: false, impulseN: 0, tangentialImpulse: 0, spinXDelta: 0, spinYDelta: 0 };
  }

  const relativeVx = second.vx - first.vx;
  const relativeVy = second.vy - first.vy;
  const velocityAlongNormal = relativeVx * nx + relativeVy * ny;
  if (velocityAlongNormal >= 0) {
    return { collided: false, impulseN: 0, tangentialImpulse: 0, spinXDelta: 0, spinYDelta: 0 };
  }
  const impulseN = -((1 + input.restitution) * velocityAlongNormal) / invMassSum;

  // Tangential (spin transfer) impulse via Coulomb friction
  const tx = -ny;
  const ty = nx;
  const mu = input.contactFriction ?? 0;
  const radius = input.ballRadiusM ?? 0;
  let tangentialImpulse = 0;
  let spinXDelta = 0;
  let spinYDelta = 0;
  if (mu > 0 && radius > 0 && impulseN > 0) {
    const mass = invMass1 > 0 ? 1 / invMass1 : 1;
    const firstSpinZ = first.spinZ ?? 0;
    const secondSpinZ = second.spinZ ?? 0;
    const firstSpinX = first.spinX ?? 0;
    const firstSpinY = first.spinY ?? 0;
    const secondSpinX = second.spinX ?? 0;
    const secondSpinY = second.spinY ?? 0;

    // --- XY plane tangential impulse (existing, spinZ contribution) ---
    const tangentRelVel = (relativeVx * tx + relativeVy * ty) + radius * (firstSpinZ + secondSpinZ);
    const inertia = (2 / 5) * mass * radius * radius;
    const tangentEffMass = invMassSum + (2 * radius * radius) / inertia;
    const uncapped = -tangentRelVel / Math.max(1e-9, tangentEffMass);
    tangentialImpulse = clampNumber(uncapped, -mu * impulseN, mu * impulseN);
    const spinDelta = (-5 * tangentialImpulse) / (2 * mass * radius);
    if (first.spinZ !== undefined) {
      first.spinZ += spinDelta;
    }
    if (second.spinZ !== undefined) {
      second.spinZ += spinDelta;
    }

    // --- Z-axis (vertical) slip impulse from spinX/spinY ---
    const zRelVel = radius * ((firstSpinX * ny - firstSpinY * nx) - (secondSpinX * ny - secondSpinY * nx));
    const zEffCompliance = 2 * (5 / mass);
    const zUncapped = -zRelVel / Math.max(1e-9, zEffCompliance);
    const zImpulse = clampNumber(zUncapped, -mu * impulseN, mu * impulseN);

    spinXDelta = (5 * ny * zImpulse) / (2 * mass * radius);
    spinYDelta = (-5 * nx * zImpulse) / (2 * mass * radius);

    if (first.spinX !== undefined) {
      first.spinX += spinXDelta;
    }
    if (first.spinY !== undefined) {
      first.spinY += spinYDelta;
    }
    if (second.spinX !== undefined) {
      second.spinX -= spinXDelta;
    }
    if (second.spinY !== undefined) {
      second.spinY -= spinYDelta;
    }
  }

  const impulseX = impulseN * nx + tangentialImpulse * tx;
  const impulseY = impulseN * ny + tangentialImpulse * ty;

  first.vx -= impulseX * invMass1;
  first.vy -= impulseY * invMass1;
  second.vx += impulseX * invMass2;
  second.vy += impulseY * invMass2;

  return { collided: true, impulseN, tangentialImpulse, spinXDelta, spinYDelta };
}

export function solveBallCushionImpulse(input: BallCushionImpulseInput): BallCushionImpulseResult {
  const m = Math.max(1e-6, input.ballMassKg);
  const r = Math.max(1e-6, input.ballRadiusM);
  const inertia = Math.max(1e-9, input.ballInertiaKgM2);

  const rawVn = input.axis === 'x' ? input.vx : input.vy;
  if (rawVn === 0) {
    return {
      vx: input.vx,
      vy: input.vy,
      spinZ: input.spinZ,
      throwTan: 0,
      throwAngleDeg: 0,
      impulseN: 0,
      impulseT: 0,
    };
  }
  const normalSign = rawVn > 0 ? -1 : 1;
  const normalX = input.axis === 'x' ? normalSign : 0;
  const normalY = input.axis === 'y' ? normalSign : 0;
  const tangentX = -normalY;
  const tangentY = normalX;

  const vn = input.vx * normalX + input.vy * normalY;
  if (vn >= 0) {
    return {
      vx: input.vx,
      vy: input.vy,
      spinZ: input.spinZ,
      throwTan: 0,
      throwAngleDeg: 0,
      impulseN: 0,
      impulseT: 0,
    };
  }
  const vt = input.vx * tangentX + input.vy * tangentY;

  const longitudinalSpin = input.axis === 'y' ? input.spinX : input.spinY;
  const longitudinalRatio = clampNumber(
    longitudinalSpin / Math.max(1e-6, input.maxSpinMagnitude),
    -1,
    1,
  );
  const restitutionBoost = clampNumber((-Math.sign(rawVn) * longitudinalRatio) * 0.06, -0.06, 0.06);
  const baseRestitution = computeSpeedDependentRestitution(
    Math.abs(rawVn),
    input.restitution,
    input.restitutionLow,
    input.restitutionHigh,
    input.restitutionMidSpeedMps,
    input.restitutionSigmoidK,
  );
  const effectiveRestitution = clampNumber(baseRestitution * (1 + restitutionBoost), 0.05, 0.98);

  const kn = 1 / m;
  const kt = (1 / m) + (r * r) / inertia;
  const vtRel = vt - input.spinZ * r;

  const impulseN = Math.max(0, -((1 + effectiveRestitution) * vn) / kn);
  const impulseTRaw = -vtRel / kt;
  const frictionLimit = Math.abs(input.friction * impulseN);
  let impulseT = clampNumber(impulseTRaw, -frictionLimit, frictionLimit);

  let nextVx = input.vx + (impulseN * normalX + impulseT * tangentX) / m;
  let nextVy = input.vy + (impulseN * normalY + impulseT * tangentY) / m;
  let nextSpinZ = input.spinZ - (r * impulseT) / inertia;

  const postVn = Math.abs(nextVx * normalX + nextVy * normalY);
  const postVt = nextVx * tangentX + nextVy * tangentY;
  const maxThrowTan = Math.tan((Math.max(0, input.maxThrowAngleDeg) * Math.PI) / 180);
  if (postVn > 1e-6 && maxThrowTan > 0) {
    const targetVtAbs = Math.min(Math.abs(postVt), maxThrowTan * postVn);
    const targetVt = Math.sign(postVt) * targetVtAbs;
    const deltaVt = targetVt - postVt;
    if (Math.abs(deltaVt) > 1e-9) {
      const deltaImpulseT = deltaVt / ((1 / m));
      impulseT += deltaImpulseT;
      nextVx += (deltaImpulseT * tangentX) / m;
      nextVy += (deltaImpulseT * tangentY) / m;
      nextSpinZ -= (r * deltaImpulseT) / inertia;
    }
  }

  const finalVnAbs = Math.abs(nextVx * normalX + nextVy * normalY);
  const finalVtAbs = Math.abs(nextVx * tangentX + nextVy * tangentY);
  const throwTan = finalVnAbs > 1e-9 ? finalVtAbs / finalVnAbs : 0;

  return {
    vx: nextVx,
    vy: nextVy,
    spinZ: nextSpinZ,
    throwTan,
    throwAngleDeg: Math.atan(throwTan) * (180 / Math.PI),
    impulseN,
    impulseT,
  };
}
