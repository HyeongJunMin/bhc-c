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
};

export type StepRoomPhysicsConfig = {
  dtSec: number;
  substeps: number;
  linearDampingPerTick: number;
  spinDampingPerTick: number;
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
  cushionPostCollisionSpeedScale: number;
  recoveryFallbackEnabled: boolean;
  ballMassKg: number;
  maxSubstepEnergyGainJ: number;
};

export type StepRoomPhysicsHooks = {
  applyCushionContactThrow: (input: CushionContactThrowInput) => CushionContactThrowResult;
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
  ballBallRestitution: number,
  ballRadiusM: number,
  onBallCollision?: (first: PhysicsBallState, second: PhysicsBallState) => void,
): void {
  const minDistance = ballRadiusM * 2;
  const minDistanceSq = minDistance * minDistance;
  const epsilon = 1e-8;

  function applyImpulse(first: PhysicsBallState, second: PhysicsBallState, normalX: number, normalY: number): boolean {
    const relativeVx = second.vx - first.vx;
    const relativeVy = second.vy - first.vy;
    const velocityAlongNormal = relativeVx * normalX + relativeVy * normalY;
    if (velocityAlongNormal >= 0) {
      return false;
    }
    const impulse = -((1 + ballBallRestitution) * velocityAlongNormal) / 2;
    first.vx -= impulse * normalX;
    first.vy -= impulse * normalY;
    second.vx += impulse * normalX;
    second.vy += impulse * normalY;
    return true;
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
    const moveLenSq = moveX * moveX + moveY * moveY;
    let t = 0;
    if (moveLenSq > epsilon) {
      t = -((startX * moveX) + (startY * moveY)) / moveLenSq;
      t = clampNumber(t, 0, 1);
    }
    const closestX = startX + moveX * t;
    const closestY = startY + moveY * t;
    const closestDistSq = closestX * closestX + closestY * closestY;
    if (!Number.isFinite(closestDistSq) || closestDistSq > minDistanceSq) {
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
      if (Number.isFinite(distanceSq) && distanceSq <= minDistanceSq) {
        const distance = Math.sqrt(Math.max(distanceSq, epsilon));
        const normalX = distance > epsilon ? deltaX / distance : 1;
        const normalY = distance > epsilon ? deltaY / distance : 0;
        const collided = applyImpulse(first, second, normalX, normalY);
        if (collided) {
          onBallCollision?.(first, second);
        }
        const penetration = minDistance - distance;
        if (penetration > 0) {
          const correction = ((penetration - 1e-4 > 0 ? penetration - 1e-4 : 0) / 2) * 0.8;
          first.x -= normalX * correction;
          first.y -= normalY * correction;
          second.x += normalX * correction;
          second.y += normalY * correction;
        }
        continue;
      }

      if (!firstPrev || !secondPrev) {
        continue;
      }
      const hitTime = sweepHitTime(firstPrev, first, secondPrev, second);
      if (hitTime === null) {
        continue;
      }
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
    }
  }
}

export function stepRoomPhysicsWorld(
  balls: PhysicsBallState[],
  config: StepRoomPhysicsConfig,
  hooks: StepRoomPhysicsHooks,
): StepRoomPhysicsStats {
  const substepDtSec = config.dtSec / config.substeps;
  const linearDamping = Math.pow(config.linearDampingPerTick, 1 / config.substeps);
  const spinDamping = Math.pow(config.spinDampingPerTick, 1 / config.substeps);
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

  for (let step = 0; step < config.substeps; step += 1) {
    const energyBeforeStep = computeKineticEnergyJ(balls, config.ballMassKg);
    const prevPositions = balls.map((ball) => ({ x: ball.x, y: ball.y }));
    for (const ball of balls) {
      if (ball.isPocketed) {
        continue;
      }
      ball.x += ball.vx * substepDtSec;
      ball.y += ball.vy * substepDtSec;

      if (ball.x <= config.ballRadiusM || ball.x >= config.tableWidthM - config.ballRadiusM) {
        reasonCounts.BOUNDARY_X += 1;
        const cushionId: CushionId = ball.x <= config.ballRadiusM ? 'left' : 'right';
        ball.x = clampNumber(ball.x, config.ballRadiusM, config.tableWidthM - config.ballRadiusM);
        const collision = hooks.applyCushionContactThrow({
          axis: 'x',
          vx: ball.vx,
          vy: ball.vy,
          spinZ: ball.spinZ,
          restitution: config.cushionRestitution,
          contactFriction: config.cushionContactFriction,
          referenceNormalSpeedMps: config.cushionReferenceSpeedMps,
          contactTimeExponent: config.cushionContactTimeExponent,
          maxSpinMagnitude: config.cushionMaxSpinMagnitude,
          maxThrowAngleDeg: config.cushionMaxThrowAngleDeg,
        });
        ball.vx = collision.vx * config.cushionPostCollisionSpeedScale;
        ball.vy = collision.vy * config.cushionPostCollisionSpeedScale;
        hooks.onCushionCollision?.(ball, cushionId);
      }
      if (ball.y <= config.ballRadiusM || ball.y >= config.tableHeightM - config.ballRadiusM) {
        reasonCounts.BOUNDARY_Y += 1;
        const cushionId: CushionId = ball.y <= config.ballRadiusM ? 'top' : 'bottom';
        ball.y = clampNumber(ball.y, config.ballRadiusM, config.tableHeightM - config.ballRadiusM);
        const collision = hooks.applyCushionContactThrow({
          axis: 'y',
          vx: ball.vx,
          vy: ball.vy,
          spinZ: ball.spinZ,
          restitution: config.cushionRestitution,
          contactFriction: config.cushionContactFriction,
          referenceNormalSpeedMps: config.cushionReferenceSpeedMps,
          contactTimeExponent: config.cushionContactTimeExponent,
          maxSpinMagnitude: config.cushionMaxSpinMagnitude,
          maxThrowAngleDeg: config.cushionMaxThrowAngleDeg,
        });
        ball.vx = collision.vx * config.cushionPostCollisionSpeedScale;
        ball.vy = collision.vy * config.cushionPostCollisionSpeedScale;
        hooks.onCushionCollision?.(ball, cushionId);
      }
    }

    resolveBallBallCollisions(
      balls,
      prevPositions,
      substepDtSec,
      config.ballBallRestitution,
      config.ballRadiusM,
      hooks.onBallCollision,
    );

    for (const ball of balls) {
      if (ball.isPocketed) {
        continue;
      }
      ball.vx *= linearDamping;
      ball.vy *= linearDamping;
      ball.spinX *= spinDamping;
      ball.spinY *= spinDamping;
      ball.spinZ *= spinDamping;
      maxObservedSpeedMps = Math.max(maxObservedSpeedMps, Math.hypot(ball.vx, ball.vy));
      if (Math.hypot(ball.vx, ball.vy) < config.shotEndLinearSpeedThresholdMps) {
        ball.vx = 0;
        ball.vy = 0;
      }
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
