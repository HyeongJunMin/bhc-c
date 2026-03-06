import { applyCushionContactThrow } from './cushion-contact-throw.ts';
import { applyBallBallCollisionWithSpin } from './ball-ball-collision.ts';
import { applyBallSurfaceFriction } from './ball-surface-friction.ts';
import {
  BALL_MASS_KG,
  BALL_RADIUS_M,
  CUSHION_RESTITUTION,
  CUSHION_RESTITUTION_LOW,
  CUSHION_RESTITUTION_HIGH,
  CUSHION_RESTITUTION_MID_SPEED_MPS,
  CUSHION_RESTITUTION_SIGMOID_K,
  CUSHION_CONTACT_FRICTION_COEFFICIENT,
  CUSHION_CONTACT_REFERENCE_SPEED_MPS,
  CUSHION_CONTACT_TIME_EXPONENT,
  CUSHION_MAX_SPIN_MAGNITUDE,
  CUSHION_MAX_THROW_ANGLE_DEG,
  CUSHION_MAX_SPEED_SCALE,
  CUSHION_ROLLING_SPIN_HEIGHT_FACTOR,
  CUSHION_TORQUE_DAMPING,
  CUSHION_FRICTION_SPIN_DAMPING,
  CUSHION_HEIGHT_M,
  BALL_BALL_RESTITUTION,
  SLIDING_FRICTION_COEFFICIENT,
  ROLLING_FRICTION_COEFFICIENT,
} from './constants.ts';

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

export type StepRoomPhysicsConfig = {
  dtSec: number;
  substeps: number;
  tableWidthM: number;
  tableHeightM: number;
  ballRadiusM: number;
  shotEndLinearSpeedThresholdMps: number;
  maxBallSpeedMps: number;
  ballBallRestitution: number;
  cushionRestitution: number;
  cushionContactFriction: number;
  cushionReferenceSpeedMps: number;
  cushionContactTimeExponent: number;
  cushionMaxSpinMagnitude: number;
  cushionMaxThrowAngleDeg: number;
  recoveryFallbackEnabled: boolean;
  ballMassKg: number;
  maxSubstepEnergyGainJ: number;
  // Optional overrides (defaults from constants.ts)
  cushionRestitutionLow?: number;
  cushionRestitutionHigh?: number;
  cushionRestitutionMidSpeedMps?: number;
  cushionRestitutionSigmoidK?: number;
  cushionHeightM?: number;
  cushionRollingSpinHeightFactor?: number;
  cushionTorqueDamping?: number;
  cushionFrictionSpinDamping?: number;
  cushionMaxSpeedScale?: number;
  slidingFrictionCoefficient?: number;
  rollingFrictionCoefficient?: number;
  ballBallContactFriction?: number;
};

export type StepRoomPhysicsHooks = {
  applyCushionContactThrow?: (input: {
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
  }) => { vx: number; vy: number; spinX?: number; spinY?: number; spinZ?: number };
  onCushionCollision?: (ball: PhysicsBallState, cushionId: CushionId) => void;
  onBallCollision?: (first: PhysicsBallState, second: PhysicsBallState) => void;
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
  config: StepRoomPhysicsConfig,
  onBallCollision?: (first: PhysicsBallState, second: PhysicsBallState) => void,
): void {
  const minDistance = config.ballRadiusM * 2;
  const minDistanceSq = minDistance * minDistance;
  const epsilon = 1e-8;
  const positionalCorrectionSlopM = 1e-4;
  const positionalCorrectionPercent = 0.9;
  const maxCorrectionPerBallM = config.ballRadiusM * 0.45;

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

  function applyImpulse(
    first: PhysicsBallState,
    second: PhysicsBallState,
    normalX: number,
    normalY: number,
  ): boolean {
    // Bridge: applyBallBallCollisionWithSpin uses spinY for english (vertical axis spin).
    // In PhysicsBallState, spinY = english spin (angular velocity around vertical axis).
    const firstProxy = { vx: first.vx, vy: first.vy, spinY: first.spinY };
    const secondProxy = { vx: second.vx, vy: second.vy, spinY: second.spinY };

    const result = applyBallBallCollisionWithSpin({
      first: firstProxy,
      second: secondProxy,
      normalX,
      normalY,
      restitution: config.ballBallRestitution,
      contactFriction: config.ballBallContactFriction,
      ballMassKg: config.ballMassKg,
      ballRadiusM: config.ballRadiusM,
    });

    if (result.collided) {
      first.vx = firstProxy.vx;
      first.vy = firstProxy.vy;
      first.spinY = firstProxy.spinY;
      second.vx = secondProxy.vx;
      second.vy = secondProxy.vy;
      second.spinY = secondProxy.spinY;
    }

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
      const overlapping = Number.isFinite(distanceSq) && distanceSq <= minDistanceSq;

      if (firstPrev && secondPrev) {
        const hitTime = sweepHitTime(firstPrev, first, secondPrev, second);
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
          if (collided) {
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
          } else {
            // Balls are overlapping but not approaching (static or separating).
            // Apply positional correction to push them apart.
            applyPositionalCorrection(first, second, normalX, normalY, hitDistance);
          }
          continue;
        }
      }

      if (overlapping) {
        const distance = Math.sqrt(Math.max(distanceSq, epsilon));
        const normalX = distance > epsilon ? deltaX / distance : 1;
        const normalY = distance > epsilon ? deltaY / distance : 0;
        const collided = applyImpulse(first, second, normalX, normalY);
        if (collided) {
          onBallCollision?.(first, second);
        }
        applyPositionalCorrection(first, second, normalX, normalY, distance);
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

  // Resolve cushion collision and return updated vx/vy/spinX/spinY/spinZ.
  function handleCushionCollision(
    ball: PhysicsBallState,
    axis: 'x' | 'y',
  ): void {
    const throwInput = {
      axis,
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

    const hookResult = hooks.applyCushionContactThrow?.(throwInput);
    if (hookResult) {
      ball.vx = hookResult.vx;
      ball.vy = hookResult.vy;
      if (hookResult.spinX !== undefined) ball.spinX = hookResult.spinX;
      if (hookResult.spinY !== undefined) ball.spinY = hookResult.spinY;
      if (hookResult.spinZ !== undefined) ball.spinZ = hookResult.spinZ;
      return;
    }

    // Default: use applyCushionContactThrow from physics-core
    const result = applyCushionContactThrow({
      axis,
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
      ballMassKg: config.ballMassKg,
      ballRadiusM: config.ballRadiusM,
      cushionHeightM: config.cushionHeightM ?? CUSHION_HEIGHT_M,
      rollingSpinHeightFactor: config.cushionRollingSpinHeightFactor ?? CUSHION_ROLLING_SPIN_HEIGHT_FACTOR,
      cushionTorqueDamping: config.cushionTorqueDamping ?? CUSHION_TORQUE_DAMPING,
      maxSpeedScale: config.cushionMaxSpeedScale ?? CUSHION_MAX_SPEED_SCALE,
      restitutionLow: config.cushionRestitutionLow ?? CUSHION_RESTITUTION_LOW,
      restitutionHigh: config.cushionRestitutionHigh ?? CUSHION_RESTITUTION_HIGH,
      restitutionMidSpeedMps: config.cushionRestitutionMidSpeedMps ?? CUSHION_RESTITUTION_MID_SPEED_MPS,
      restitutionSigmoidK: config.cushionRestitutionSigmoidK ?? CUSHION_RESTITUTION_SIGMOID_K,
      frictionSpinDamping: config.cushionFrictionSpinDamping ?? CUSHION_FRICTION_SPIN_DAMPING,
    });

    ball.vx = result.vx;
    ball.vy = result.vy;
    ball.spinX = result.spinX;
    ball.spinY = result.spinY;
    ball.spinZ = result.spinZ;
  }

  for (let step = 0; step < config.substeps; step += 1) {
    const energyBeforeStep = computeKineticEnergyJ(balls, config.ballMassKg);
    const prevPositions = balls.map((ball) => ({ x: ball.x, y: ball.y }));

    for (const ball of balls) {
      if (ball.isPocketed) {
        continue;
      }

      // NaN guard (pre-step)
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

      // Integrate position
      ball.x += ball.vx * substepDtSec;
      ball.y += ball.vy * substepDtSec;

      let collidedLeft = false;
      let collidedRight = false;
      let collidedTop = false;
      let collidedBottom = false;

      // X-axis cushion collision (left/right walls)
      if (ball.x <= config.ballRadiusM || ball.x >= config.tableWidthM - config.ballRadiusM) {
        reasonCounts.BOUNDARY_X += 1;
        const isLeftCushion = ball.x <= config.ballRadiusM;
        const cushionId: CushionId = isLeftCushion ? 'left' : 'right';
        collidedLeft = isLeftCushion;
        collidedRight = !isLeftCushion;

        ball.x = clampNumber(ball.x, config.ballRadiusM, config.tableWidthM - config.ballRadiusM);

        handleCushionCollision(ball, 'x');

        // Enforce minimum release normal speed
        const releaseSign = isLeftCushion ? 1 : -1;
        if (releaseSign * ball.vx < minCushionReleaseNormalSpeedMps) {
          ball.vx = releaseSign * minCushionReleaseNormalSpeedMps;
        }

        // Cushion separation epsilon
        if (isLeftCushion) {
          ball.x = Math.max(ball.x, config.ballRadiusM + cushionSeparationEpsilonM);
        } else {
          ball.x = Math.min(ball.x, config.tableWidthM - config.ballRadiusM - cushionSeparationEpsilonM);
        }

        hooks.onCushionCollision?.(ball, cushionId);
      }

      // Y-axis cushion collision (top/bottom walls)
      if (ball.y <= config.ballRadiusM || ball.y >= config.tableHeightM - config.ballRadiusM) {
        reasonCounts.BOUNDARY_Y += 1;
        const isTopCushion = ball.y <= config.ballRadiusM;
        const cushionId: CushionId = isTopCushion ? 'top' : 'bottom';
        collidedTop = isTopCushion;
        collidedBottom = !isTopCushion;

        ball.y = clampNumber(ball.y, config.ballRadiusM, config.tableHeightM - config.ballRadiusM);

        handleCushionCollision(ball, 'y');

        // Enforce minimum release normal speed
        const releaseSign = isTopCushion ? 1 : -1;
        if (releaseSign * ball.vy < minCushionReleaseNormalSpeedMps) {
          ball.vy = releaseSign * minCushionReleaseNormalSpeedMps;
        }

        // Cushion separation epsilon
        if (isTopCushion) {
          ball.y = Math.max(ball.y, config.ballRadiusM + cushionSeparationEpsilonM);
        } else {
          ball.y = Math.min(ball.y, config.tableHeightM - config.ballRadiusM - cushionSeparationEpsilonM);
        }

        hooks.onCushionCollision?.(ball, cushionId);
      }

      // Corner: both axes collided
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

    // Ball-ball collisions
    resolveBallBallCollisions(
      balls,
      prevPositions,
      substepDtSec,
      config,
      hooks.onBallCollision,
    );

    // Surface friction
    for (const ball of balls) {
      if (ball.isPocketed) {
        continue;
      }

      const frictionResult = applyBallSurfaceFriction({
        vx: ball.vx,
        vy: ball.vy,
        spinX: ball.spinX,
        spinY: ball.spinY,
        spinZ: ball.spinZ,
        radiusM: config.ballRadiusM,
        dtSec: substepDtSec,
        slidingFriction: config.slidingFrictionCoefficient ?? SLIDING_FRICTION_COEFFICIENT,
        rollingFriction: config.rollingFrictionCoefficient ?? ROLLING_FRICTION_COEFFICIENT,
      });

      ball.vx = frictionResult.vx;
      ball.vy = frictionResult.vy;
      ball.spinX = frictionResult.spinX;
      ball.spinY = frictionResult.spinY;
      ball.spinZ = frictionResult.spinZ;

      // Speed cap
      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > config.maxBallSpeedMps) {
        reasonCounts.SPEED_CAP += 1;
        if (config.recoveryFallbackEnabled) {
          const ratio = config.maxBallSpeedMps / speed;
          ball.vx *= ratio;
          ball.vy *= ratio;
        }
      }

      maxObservedSpeedMps = Math.max(maxObservedSpeedMps, Math.hypot(ball.vx, ball.vy));

      // Position clamp
      const clampedX = clampNumber(ball.x, config.ballRadiusM, config.tableWidthM - config.ballRadiusM);
      const clampedY = clampNumber(ball.y, config.ballRadiusM, config.tableHeightM - config.ballRadiusM);
      if (clampedX !== ball.x || clampedY !== ball.y) {
        reasonCounts.POSITION_RECLAMP += 1;
      }
      if (config.recoveryFallbackEnabled) {
        ball.x = clampedX;
        ball.y = clampedY;
      }

      // NaN guard (post-step)
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
    }

    // Energy cap
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
