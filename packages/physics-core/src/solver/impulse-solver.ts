export type ImpulseBody2D = {
  vx: number;
  vy: number;
};

export type BallBallImpulseInput = {
  normalX: number;
  normalY: number;
  restitution: number;
  mass1Kg?: number;
  mass2Kg?: number;
};

export type BallBallImpulseResult = {
  collided: boolean;
  impulseN: number;
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
    return { collided: false, impulseN: 0 };
  }
  const normalLen = Math.hypot(input.normalX, input.normalY);
  if (normalLen <= 1e-9) {
    return { collided: false, impulseN: 0 };
  }
  const nx = input.normalX / normalLen;
  const ny = input.normalY / normalLen;
  const mass1 = input.mass1Kg ?? 1;
  const mass2 = input.mass2Kg ?? 1;
  const invMass1 = mass1 > 0 ? 1 / mass1 : 0;
  const invMass2 = mass2 > 0 ? 1 / mass2 : 0;
  const invMassSum = invMass1 + invMass2;
  if (invMassSum <= 0) {
    return { collided: false, impulseN: 0 };
  }

  const relativeVx = second.vx - first.vx;
  const relativeVy = second.vy - first.vy;
  const velocityAlongNormal = relativeVx * nx + relativeVy * ny;
  if (velocityAlongNormal >= 0) {
    return { collided: false, impulseN: 0 };
  }
  const approachSpeedMps = -velocityAlongNormal;
  const effectiveRestitution = computeLowSpeedBallBallRestitution(input.restitution, approachSpeedMps);
  const impulseN = -((1 + effectiveRestitution) * velocityAlongNormal) / invMassSum;
  const impulseX = impulseN * nx;
  const impulseY = impulseN * ny;

  first.vx -= impulseX * invMass1;
  first.vy -= impulseY * invMass1;
  second.vx += impulseX * invMass2;
  second.vy += impulseY * invMass2;

  return { collided: true, impulseN };
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
  const effectiveRestitution = clampNumber(input.restitution * (1 + restitutionBoost), 0.05, 0.98);

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
