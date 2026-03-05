function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type CushionAxis = 'x' | 'y';

export type CushionContactThrowInput = {
  axis: CushionAxis;
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  restitution: number;
  contactFriction: number;
  referenceNormalSpeedMps: number;
  contactTimeExponent: number;
  maxSpinMagnitude: number;
  maxThrowAngleDeg: number;
  minNormalSpeedForThrowMps?: number;
  maxPostCollisionSpeedScale?: number;
  maxThrowVtRatioToDampedVt?: number;
  highSpeedThrowBoostRatio?: number;
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
  const longitudinalSpin = input.axis === 'y' ? input.spinX : input.spinY;

  const safeRestitution = Math.max(0.01, input.restitution);
  const safeReferenceSpeed = Math.max(minNormalSpeed, input.referenceNormalSpeedMps);
  // Top/back spin effect: adjust rebound strength along cushion normal (not side throw).
  const longitudinalSpinRatio = clampNumber(longitudinalSpin / Math.max(1e-6, input.maxSpinMagnitude), -1, 1);
  const normalSpinBoost = clampNumber((-Math.sign(preVn) * longitudinalSpinRatio) * 0.08, -0.08, 0.08);
  postVn *= 1 + normalSpinBoost;
  const baseTan = (input.contactFriction * (1 + safeRestitution)) / safeRestitution;
  const highSpeedRatio = absPostVn / safeReferenceSpeed;
  const highSpeedThrowBoostRatio = input.highSpeedThrowBoostRatio ?? 0.12;
  const speedResponse = highSpeedRatio >= 1
    ? 1 + Math.min(1.5, highSpeedRatio - 1) * highSpeedThrowBoostRatio
    : Math.pow(Math.max(0, highSpeedRatio), 0.55);
  const spinScale = clampNumber(Math.abs(input.spinZ) / Math.max(1e-6, input.maxSpinMagnitude), 0, 1);
  const lowSpeedFade = clampNumber(
    (absPostVn - minNormalSpeed) / Math.max(1e-6, safeReferenceSpeed - minNormalSpeed),
    0,
    1,
  );
  const lowSpeedFadeFloor = 0.15;
  const effectiveLowSpeedFade = lowSpeedFadeFloor + (1 - lowSpeedFadeFloor) * lowSpeedFade;
  // Real-world tuning: stronger normal impact should yield stronger effective cushion throw,
  // while near-stop contacts should still fade out.
  const rawThrowTan = baseTan * spinScale * speedResponse * effectiveLowSpeedFade;
  const maxThrowTan = Math.tan((input.maxThrowAngleDeg * Math.PI) / 180);
  const throwTan = clampNumber(rawThrowTan, 0, maxThrowTan);

  const throwDirection = Math.sign(input.spinZ);
  const dampedVt = preVt * (1 - input.contactFriction);
  const throwVtRaw = throwDirection === 0 ? 0 : throwDirection * throwTan * absPostVn;
  const baseThrowVtRatioToDampedVt = input.maxThrowVtRatioToDampedVt ?? 0.9;
  const highSpeedThrowVtScale = highSpeedRatio > 1
    ? Math.max(0.6, 1 - Math.min(1.2, highSpeedRatio - 1) * 0.35)
    : 1;
  const maxThrowVtRatioToDampedVt = baseThrowVtRatioToDampedVt * highSpeedThrowVtScale;
  const throwVtLimit = Math.max(minNormalSpeed, Math.abs(dampedVt)) * maxThrowVtRatioToDampedVt;
  let throwVt = clampNumber(throwVtRaw, -throwVtLimit, throwVtLimit);
  // Prevent abrupt tangential direction flip at cushion contact.
  // If throw and damped tangential velocity have opposite signs, cap throw so postVt keeps its sign.
  if (dampedVt !== 0 && Math.sign(throwVt) !== 0 && Math.sign(dampedVt) !== Math.sign(throwVt)) {
    const antiFlipLimit = Math.abs(dampedVt) * 0.95;
    throwVt = clampNumber(throwVt, -antiFlipLimit, antiFlipLimit);
  }
  let postVt = dampedVt + throwVt;

  // Cap spin-induced heading delta at high speed to avoid first-cushion over-bend.
  // This preserves speed-dependent throw but prevents extreme spin-only deviation.
  if (highSpeedRatio > 1) {
    const maxSpinDeltaDeg = 10;
    const baseHeading = Math.atan2(dampedVt, absPostVn);
    const postHeading = Math.atan2(postVt, absPostVn);
    let spinDeltaDeg = ((postHeading - baseHeading) * 180) / Math.PI;
    while (spinDeltaDeg > 180) spinDeltaDeg -= 360;
    while (spinDeltaDeg <= -180) spinDeltaDeg += 360;
    if (Math.abs(spinDeltaDeg) > maxSpinDeltaDeg) {
      const targetHeading = baseHeading + (Math.sign(spinDeltaDeg) * maxSpinDeltaDeg * Math.PI) / 180;
      postVt = Math.tan(targetHeading) * absPostVn;
    }
  }

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
