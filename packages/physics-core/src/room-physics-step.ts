import { solveBallBallImpulse } from './solver/impulse-solver.ts';
import { applyBallSurfaceFriction } from './ball-surface-friction.ts';
import { applyCushionContactThrow } from './cushion-contact-throw.ts';

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export type PhysicsBallState = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  isPocketed: boolean;
};

export type CushionId = 'left' | 'right' | 'top' | 'bottom';

export type CushionContactThrowInput = {
  axis: 'x' | 'y';
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
};

export type CushionContactThrowResult = {
  vx: number;
  vy: number;
  spinX?: number;
  spinY?: number;
  spinZ?: number;
  throwTan?: number;
  throwAngleDeg?: number;
};

export type StepRoomPhysicsConfig = {
  dtSec: number;
  substeps: number;
  tableWidthM: number;
  tableHeightM: number;
  ballRadiusM: number;
  shotEndLinearSpeedThresholdMps: number;
  maxBallSpeedMps: number;
  ballBallRestitution: number;
  ballMassKg: number;
  cushionRestitution: number;
  cushionContactFriction: number;
  cushionReferenceSpeedMps: number;
  cushionContactTimeExponent: number;
  cushionMaxSpinMagnitude: number;
  cushionMaxThrowAngleDeg: number;
  recoveryFallbackEnabled: boolean;
  maxSubstepEnergyGainJ: number;
  slidingFriction: number;
  rollingFriction: number;
  gravityMps2?: number;
  // Cushion contact throw geometry (optional)
  cushionHeightM?: number;
  cushionRollingSpinHeightFactor?: number;
  cushionTorqueDamping?: number;
  cushionMaxSpeedScale?: number;
  cushionFrictionSpinDamping?: number;
  // Sigmoid restitution (optional)
  cushionRestitutionLow?: number;
  cushionRestitutionHigh?: number;
  cushionRestitutionMidSpeedMps?: number;
  cushionRestitutionSigmoidK?: number;
  // Ball-ball friction (optional)
  ballBallContactFriction?: number;
  // Damping per tick (optional)
  linearDampingPerTick?: number;
  spinDampingPerTick?: number;
  // Cushion post-collision speed scale (optional)
  cushionPostCollisionSpeedScale?: number;
  // Cloth linear-spin coupling (optional)
  clothLinearSpinCouplingPerSec?: number;
  // Cushion spin monotonic mode (optional)
  cushionSpinMonotonicEnabled?: boolean;
  cushionSpinMonotonicRetention?: number;
};

export type StepRoomPhysicsHooks = {
  applyCushionContactThrow?: (input: CushionContactThrowInput) => CushionContactThrowResult;
  onCushionCollision?: (ball: PhysicsBallState, cushionId: CushionId) => void;
  onBallCollision?: (first: PhysicsBallState, second: PhysicsBallState) => void;
  onSubstepEnd?: (balls: readonly PhysicsBallState[]) => void;
};

export type StepRoomPhysicsStats = {
  maxObservedSpeedMps: number;
  nanGuardTriggered: boolean;
  reasonCounts: Record<'BOUNDARY_X' | 'BOUNDARY_Y' | 'POSITION_RECLAMP' | 'SPEED_CAP' | 'NAN_GUARD', number>;
  kineticEnergyStartJ: number;
  kineticEnergyEndJ: number;
  kineticEnergyDeltaJ: number;
  kineticEnergyDeltaRatioPct: number;
  maxPositiveEnergyDeltaJ: number;
  maxPositiveEnergyDeltaRatioPct: number;
};

function computeKineticEnergyJ(balls: PhysicsBallState[], ballMassKg: number): number {
  let total = 0;
  for (const ball of balls) {
    if (ball.isPocketed) {
      continue;
    }
    const speedSq = (ball.vx * ball.vx) + (ball.vy * ball.vy);
    total += 0.5 * ballMassKg * speedSq;
  }
  return total;
}

function applyEnergyCapForStep(
  balls: PhysicsBallState[],
  ballMassKg: number,
  allowedEnergyJ: number,
): number {
  const currentEnergyJ = computeKineticEnergyJ(balls, ballMassKg);
  if (currentEnergyJ <= allowedEnergyJ || currentEnergyJ <= 0) {
    return 1;
  }
  const scale = Math.sqrt(allowedEnergyJ / currentEnergyJ);
  for (const ball of balls) {
    if (ball.isPocketed) {
      continue;
    }
    ball.vx *= scale;
    ball.vy *= scale;
  }
  return scale;
}

function resolveBallBallCollisions(
  balls: PhysicsBallState[],
  prevPositions: Array<{ x: number; y: number }>,
  substepDtSec: number,
  ballBallRestitution: number,
  ballRadiusM: number,
  ballBallContactFriction: number,
  ballMassKg: number,
  onBallCollision?: (first: PhysicsBallState, second: PhysicsBallState) => void,
): void {
  const minDistance = ballRadiusM * 2;
  const minDistanceSq = minDistance * minDistance;
  const epsilon = 1e-8;
  const positionalCorrectionSlopM = 1e-4;
  const positionalCorrectionPercent = 0.9;
  const maxCorrectionPerBallM = ballRadiusM * 0.45;

  function applyPositionalCorrection(
    first: PhysicsBallState,
    second: PhysicsBallState,
    normalX: number,
    normalY: number,
    distance: number,
  ): void {
    const penetration = minDistance - distance;
    if (penetration <= 0) {
      return;
    }
    const correction = Math.min(
      (Math.max(0, penetration - positionalCorrectionSlopM) / 2) * positionalCorrectionPercent,
      maxCorrectionPerBallM,
    );
    first.x -= normalX * correction;
    first.y -= normalY * correction;
    second.x += normalX * correction;
    second.y += normalY * correction;
  }

  function applyImpulse(first: PhysicsBallState, second: PhysicsBallState, normalX: number, normalY: number): boolean {
    const result = solveBallBallImpulse(first, second, {
      normalX,
      normalY,
      restitution: ballBallRestitution,
      mass1Kg: ballMassKg,
      mass2Kg: ballMassKg,
      contactFriction: ballBallContactFriction,
      ballRadiusM: ballRadiusM,
    });
    return result.collided;
  }

  function sweepHitTime(
    firstPrev: { x: number; y: number },
    firstCurr: PhysicsBallState,
    secondPrev: { x: number; y: number },
    secondCurr: PhysicsBallState,
  ): number | null {
    const startX = secondPrev.x - firstPrev.x;
    const startY = secondPrev.y - firstPrev.y;
    const endX = secondCurr.x - firstCurr.x;
    const endY = secondCurr.y - firstCurr.y;
    const moveX = endX - startX;
    const moveY = endY - startY;
    const a = moveX * moveX + moveY * moveY;
    const b = 2 * (startX * moveX + startY * moveY);
    const c = startX * startX + startY * startY - minDistanceSq;
    if (a < epsilon) {
      return c <= 0 ? 0 : null;
    }
    const discriminant = b * b - 4 * a * c;
    if (!Number.isFinite(discriminant) || discriminant < 0) {
      return null;
    }
    const t = (-b - Math.sqrt(discriminant)) / (2 * a);
    if (!Number.isFinite(t) || t < 0 || t > 1) {
      return null;
    }
    return t;
  }

  for (let i = 0; i < balls.length; i += 1) {
    const first = balls[i];
    const firstPrev = prevPositions[i];
    if (!first || first.isPocketed) {
      continue;
    }
    for (let j = i + 1; j < balls.length; j += 1) {
      const second = balls[j];
      const secondPrev = prevPositions[j];
      if (!second || second.isPocketed) {
        continue;
      }
      const deltaX = second.x - first.x;
      const deltaY = second.y - first.y;
      const distanceSq = deltaX * deltaX + deltaY * deltaY;
      const hitTime = firstPrev && secondPrev
        ? sweepHitTime(firstPrev, first, secondPrev, second)
        : null;

      if (hitTime !== null) {
        const firstHitX = firstPrev.x + (first.x - firstPrev.x) * hitTime;
        const firstHitY = firstPrev.y + (first.y - firstPrev.y) * hitTime;
        const secondHitX = secondPrev.x + (second.x - secondPrev.x) * hitTime;
        const secondHitY = secondPrev.y + (second.y - secondPrev.y) * hitTime;
        const hitDeltaX = secondHitX - firstHitX;
        const hitDeltaY = secondHitY - firstHitY;
        const hitDistance = Math.hypot(hitDeltaX, hitDeltaY);
        const normalX = hitDistance > epsilon ? hitDeltaX / hitDistance : 1;
        const normalY = hitDistance > epsilon ? hitDeltaY / hitDistance : 0;
        const collided = applyImpulse(first, second, normalX, normalY);
        if (!collided) {
          applyPositionalCorrection(first, second, normalX, normalY, hitDistance);
          continue;
        }
        onBallCollision?.(first, second);
        first.x = firstHitX;
        first.y = firstHitY;
        second.x = secondHitX;
        second.y = secondHitY;
        const remainDtSec = substepDtSec * (1 - hitTime);
        first.x += first.vx * remainDtSec;
        first.y += first.vy * remainDtSec;
        second.x += second.vx * remainDtSec;
        second.y += second.vy * remainDtSec;
        continue;
      }

      if (Number.isFinite(distanceSq) && distanceSq <= minDistanceSq) {
        const distance = Math.sqrt(Math.max(distanceSq, epsilon));
        const normalX = distance > epsilon ? deltaX / distance : 1;
        const normalY = distance > epsilon ? deltaY / distance : 0;
        const collided = applyImpulse(first, second, normalX, normalY);
        if (collided) {
          onBallCollision?.(first, second);
        }
        applyPositionalCorrection(first, second, normalX, normalY, distance);
        continue;
      }
    }
  }
}

export function stepRoomPhysicsWorld(
  balls: PhysicsBallState[],
  config: StepRoomPhysicsConfig,
  hooks: StepRoomPhysicsHooks,
): StepRoomPhysicsStats {
  const substepDtSec = config.dtSec / config.substeps;
  let maxObservedSpeedMps = 0;
  let nanGuardTriggered = false;
  const kineticEnergyStartJ = computeKineticEnergyJ(balls, config.ballMassKg);
  let maxPositiveEnergyDeltaJ = 0;
  const reasonCounts: StepRoomPhysicsStats['reasonCounts'] = {
    BOUNDARY_X: 0,
    BOUNDARY_Y: 0,
    POSITION_RECLAMP: 0,
    SPEED_CAP: 0,
    NAN_GUARD: 0,
  };
  const cushionSeparationEpsilonM = Math.max(1e-4, config.ballRadiusM * 0.005);
  const minCushionReleaseNormalSpeedMps = Math.max(config.shotEndLinearSpeedThresholdMps * 2, 0.06);
  const cornerReleaseMarginM = cushionSeparationEpsilonM * 2;

  for (let step = 0; step < config.substeps; step += 1) {
    const energyBeforeStep = computeKineticEnergyJ(balls, config.ballMassKg);
    const prevPositions = balls.map((ball) => ({ x: ball.x, y: ball.y }));

    for (const ball of balls) {
      if (ball.isPocketed) {
        continue;
      }
      if (!Number.isFinite(ball.x) || !Number.isFinite(ball.y)) {
        nanGuardTriggered = true;
        reasonCounts.NAN_GUARD += 1;
        if (config.recoveryFallbackEnabled) {
          ball.x = clampNumber(
            Number.isFinite(ball.x) ? ball.x : config.tableWidthM * 0.5,
            config.ballRadiusM,
            config.tableWidthM - config.ballRadiusM,
          );
          ball.y = clampNumber(
            Number.isFinite(ball.y) ? ball.y : config.tableHeightM * 0.5,
            config.ballRadiusM,
            config.tableHeightM - config.ballRadiusM,
          );
        }
      }
      if (!Number.isFinite(ball.vx) || !Number.isFinite(ball.vy) || !Number.isFinite(ball.spinX) || !Number.isFinite(ball.spinY) || !Number.isFinite(ball.spinZ)) {
        nanGuardTriggered = true;
        reasonCounts.NAN_GUARD += 1;
        if (config.recoveryFallbackEnabled) {
          ball.vx = Number.isFinite(ball.vx) ? ball.vx : 0;
          ball.vy = Number.isFinite(ball.vy) ? ball.vy : 0;
          ball.spinX = Number.isFinite(ball.spinX) ? ball.spinX : 0;
          ball.spinY = Number.isFinite(ball.spinY) ? ball.spinY : 0;
          ball.spinZ = Number.isFinite(ball.spinZ) ? ball.spinZ : 0;
        }
      }

      let collidedLeft = false;
      let collidedRight = false;
      let collidedTop = false;
      let collidedBottom = false;

      ball.x += ball.vx * substepDtSec;
      ball.y += ball.vy * substepDtSec;

      // X-axis cushion (left/right)
      if (ball.x <= config.ballRadiusM || ball.x >= config.tableWidthM - config.ballRadiusM) {
        reasonCounts.BOUNDARY_X += 1;
        const isLeftCushion = ball.x <= config.ballRadiusM;
        const cushionId: CushionId = isLeftCushion ? 'left' : 'right';
        collidedLeft = isLeftCushion;
        collidedRight = !isLeftCushion;
        ball.x = clampNumber(ball.x, config.ballRadiusM, config.tableWidthM - config.ballRadiusM);

        const hookInput: CushionContactThrowInput = {
          axis: 'x',
          vx: ball.vx,
          vy: ball.vy,
          spinX: ball.spinX,
          spinY: ball.spinY,
          spinZ: ball.spinZ,
          restitution: config.cushionRestitution,
          contactFriction: config.cushionContactFriction,
          referenceNormalSpeedMps: config.cushionReferenceSpeedMps,
          contactTimeExponent: config.cushionContactTimeExponent,
          maxSpinMagnitude: config.cushionMaxSpinMagnitude,
          maxThrowAngleDeg: config.cushionMaxThrowAngleDeg,
        };

        const internalResult = applyCushionContactThrow({
          ...hookInput,
          ballMassKg: config.ballMassKg,
          ballRadiusM: config.ballRadiusM,
          cushionHeightM: config.cushionHeightM,
          rollingSpinHeightFactor: config.cushionRollingSpinHeightFactor,
          cushionTorqueDamping: config.cushionTorqueDamping,
          maxSpeedScale: config.cushionMaxSpeedScale,
          frictionSpinDamping: config.cushionFrictionSpinDamping,
          restitutionLow: config.cushionRestitutionLow,
          restitutionHigh: config.cushionRestitutionHigh,
          restitutionMidSpeedMps: config.cushionRestitutionMidSpeedMps,
          restitutionSigmoidK: config.cushionRestitutionSigmoidK,
        });

        const hookResult = hooks.applyCushionContactThrow?.(hookInput);
        if (hookResult) {
          ball.vx = hookResult.vx;
          ball.vy = hookResult.vy;
          ball.spinX = hookResult.spinX ?? internalResult.spinX;
          ball.spinY = hookResult.spinY ?? internalResult.spinY;
          ball.spinZ = hookResult.spinZ ?? internalResult.spinZ;
        } else {
          ball.vx = internalResult.vx;
          ball.vy = internalResult.vy;
          ball.spinX = internalResult.spinX;
          ball.spinY = internalResult.spinY;
          ball.spinZ = internalResult.spinZ;
        }

        const releaseSign = isLeftCushion ? 1 : -1;
        if (releaseSign * ball.vx < minCushionReleaseNormalSpeedMps) {
          ball.vx = releaseSign * minCushionReleaseNormalSpeedMps;
        }
        if (isLeftCushion) {
          ball.x = Math.max(ball.x, config.ballRadiusM + cushionSeparationEpsilonM);
        } else {
          ball.x = Math.min(ball.x, config.tableWidthM - config.ballRadiusM - cushionSeparationEpsilonM);
        }
        hooks.onCushionCollision?.(ball, cushionId);
      }

      // Y-axis cushion (top/bottom)
      if (ball.y <= config.ballRadiusM || ball.y >= config.tableHeightM - config.ballRadiusM) {
        reasonCounts.BOUNDARY_Y += 1;
        const isTopCushion = ball.y <= config.ballRadiusM;
        const cushionId: CushionId = isTopCushion ? 'top' : 'bottom';
        collidedTop = isTopCushion;
        collidedBottom = !isTopCushion;
        ball.y = clampNumber(ball.y, config.ballRadiusM, config.tableHeightM - config.ballRadiusM);

        const hookInput: CushionContactThrowInput = {
          axis: 'y',
          vx: ball.vx,
          vy: ball.vy,
          spinX: ball.spinX,
          spinY: ball.spinY,
          spinZ: ball.spinZ,
          restitution: config.cushionRestitution,
          contactFriction: config.cushionContactFriction,
          referenceNormalSpeedMps: config.cushionReferenceSpeedMps,
          contactTimeExponent: config.cushionContactTimeExponent,
          maxSpinMagnitude: config.cushionMaxSpinMagnitude,
          maxThrowAngleDeg: config.cushionMaxThrowAngleDeg,
        };

        const internalResult = applyCushionContactThrow({
          ...hookInput,
          ballMassKg: config.ballMassKg,
          ballRadiusM: config.ballRadiusM,
          cushionHeightM: config.cushionHeightM,
          rollingSpinHeightFactor: config.cushionRollingSpinHeightFactor,
          cushionTorqueDamping: config.cushionTorqueDamping,
          maxSpeedScale: config.cushionMaxSpeedScale,
          frictionSpinDamping: config.cushionFrictionSpinDamping,
          restitutionLow: config.cushionRestitutionLow,
          restitutionHigh: config.cushionRestitutionHigh,
          restitutionMidSpeedMps: config.cushionRestitutionMidSpeedMps,
          restitutionSigmoidK: config.cushionRestitutionSigmoidK,
        });

        const hookResult = hooks.applyCushionContactThrow?.(hookInput);
        if (hookResult) {
          ball.vx = hookResult.vx;
          ball.vy = hookResult.vy;
          ball.spinX = hookResult.spinX ?? internalResult.spinX;
          ball.spinY = hookResult.spinY ?? internalResult.spinY;
          ball.spinZ = hookResult.spinZ ?? internalResult.spinZ;
        } else {
          ball.vx = internalResult.vx;
          ball.vy = internalResult.vy;
          ball.spinX = internalResult.spinX;
          ball.spinY = internalResult.spinY;
          ball.spinZ = internalResult.spinZ;
        }

        const releaseSign = isTopCushion ? 1 : -1;
        if (releaseSign * ball.vy < minCushionReleaseNormalSpeedMps) {
          ball.vy = releaseSign * minCushionReleaseNormalSpeedMps;
        }
        if (isTopCushion) {
          ball.y = Math.max(ball.y, config.ballRadiusM + cushionSeparationEpsilonM);
        } else {
          ball.y = Math.min(ball.y, config.tableHeightM - config.ballRadiusM - cushionSeparationEpsilonM);
        }
        hooks.onCushionCollision?.(ball, cushionId);
      }

      // Corner release
      if ((collidedLeft || collidedRight) && (collidedTop || collidedBottom)) {
        const releaseVx = collidedLeft ? minCushionReleaseNormalSpeedMps : -minCushionReleaseNormalSpeedMps;
        const releaseVy = collidedTop ? minCushionReleaseNormalSpeedMps : -minCushionReleaseNormalSpeedMps;
        if (Math.sign(ball.vx) !== Math.sign(releaseVx) || Math.abs(ball.vx) < minCushionReleaseNormalSpeedMps) {
          ball.vx = releaseVx;
        }
        if (Math.sign(ball.vy) !== Math.sign(releaseVy) || Math.abs(ball.vy) < minCushionReleaseNormalSpeedMps) {
          ball.vy = releaseVy;
        }
        if (collidedLeft) {
          ball.x = Math.max(ball.x, config.ballRadiusM + cornerReleaseMarginM);
        } else if (collidedRight) {
          ball.x = Math.min(ball.x, config.tableWidthM - config.ballRadiusM - cornerReleaseMarginM);
        }
        if (collidedTop) {
          ball.y = Math.max(ball.y, config.ballRadiusM + cornerReleaseMarginM);
        } else if (collidedBottom) {
          ball.y = Math.min(ball.y, config.tableHeightM - config.ballRadiusM - cornerReleaseMarginM);
        }
        ball.spinX *= 0.85;
        ball.spinY *= 0.85;
        ball.spinZ *= 0.9;
      }
    }

    resolveBallBallCollisions(
      balls,
      prevPositions,
      substepDtSec,
      config.ballBallRestitution,
      config.ballRadiusM,
      config.ballBallContactFriction ?? 0,
      config.ballMassKg,
      hooks.onBallCollision,
    );

    for (const ball of balls) {
      if (ball.isPocketed) {
        continue;
      }

      // Surface friction (Coulomb sliding/rolling)
      const frResult = applyBallSurfaceFriction({
        vx: ball.vx,
        vy: ball.vy,
        spinX: ball.spinX,
        spinY: ball.spinY,
        spinZ: ball.spinZ,
        radiusM: config.ballRadiusM,
        dtSec: substepDtSec,
        slidingFriction: config.slidingFriction,
        rollingFriction: config.rollingFriction,
        gravityMps2: config.gravityMps2,
      });
      ball.vx = frResult.vx;
      ball.vy = frResult.vy;
      ball.spinX = frResult.spinX;
      ball.spinY = frResult.spinY;
      ball.spinZ = frResult.spinZ;

      maxObservedSpeedMps = Math.max(maxObservedSpeedMps, Math.hypot(ball.vx, ball.vy));

      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > config.maxBallSpeedMps) {
        reasonCounts.SPEED_CAP += 1;
        if (config.recoveryFallbackEnabled) {
          const ratio = config.maxBallSpeedMps / speed;
          ball.vx *= ratio;
          ball.vy *= ratio;
        }
      }

      const clampedX = clampNumber(ball.x, config.ballRadiusM, config.tableWidthM - config.ballRadiusM);
      const clampedY = clampNumber(ball.y, config.ballRadiusM, config.tableHeightM - config.ballRadiusM);
      if (clampedX !== ball.x || clampedY !== ball.y) {
        reasonCounts.POSITION_RECLAMP += 1;
      }
      if (config.recoveryFallbackEnabled) {
        ball.x = clampedX;
        ball.y = clampedY;
      }

      if (!Number.isFinite(ball.vx) || !Number.isFinite(ball.vy) || !Number.isFinite(ball.spinX) || !Number.isFinite(ball.spinY) || !Number.isFinite(ball.spinZ)) {
        nanGuardTriggered = true;
        reasonCounts.NAN_GUARD += 1;
      }
      if (config.recoveryFallbackEnabled) {
        ball.vx = Number.isFinite(ball.vx) ? ball.vx : 0;
        ball.vy = Number.isFinite(ball.vy) ? ball.vy : 0;
        ball.spinX = Number.isFinite(ball.spinX) ? ball.spinX : 0;
        ball.spinY = Number.isFinite(ball.spinY) ? ball.spinY : 0;
        ball.spinZ = Number.isFinite(ball.spinZ) ? ball.spinZ : 0;
      }
    }

    const energyAfterStep = computeKineticEnergyJ(balls, config.ballMassKg);
    const rawPositiveDeltaJ = Math.max(0, energyAfterStep - energyBeforeStep);
    maxPositiveEnergyDeltaJ = Math.max(maxPositiveEnergyDeltaJ, rawPositiveDeltaJ);

    if (config.recoveryFallbackEnabled && rawPositiveDeltaJ > config.maxSubstepEnergyGainJ) {
      const allowedEnergyJ = energyBeforeStep + config.maxSubstepEnergyGainJ;
      const scale = applyEnergyCapForStep(balls, config.ballMassKg, allowedEnergyJ);
      if (scale < 1) {
        reasonCounts.SPEED_CAP += 1;
      }
    }

    hooks.onSubstepEnd?.(balls);
  }

  const kineticEnergyEndJ = computeKineticEnergyJ(balls, config.ballMassKg);
  const kineticEnergyDeltaJ = kineticEnergyEndJ - kineticEnergyStartJ;
  const kineticEnergyDeltaRatioPct = kineticEnergyStartJ > 0 ? (kineticEnergyDeltaJ / kineticEnergyStartJ) * 100 : 0;
  const maxPositiveEnergyDeltaRatioPct = kineticEnergyStartJ > 0
    ? (maxPositiveEnergyDeltaJ / kineticEnergyStartJ) * 100
    : 0;

  return {
    maxObservedSpeedMps,
    nanGuardTriggered,
    reasonCounts,
    kineticEnergyStartJ,
    kineticEnergyEndJ,
    kineticEnergyDeltaJ,
    kineticEnergyDeltaRatioPct,
    maxPositiveEnergyDeltaJ,
    maxPositiveEnergyDeltaRatioPct,
  };
}
