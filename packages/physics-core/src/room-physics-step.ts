import { solveBallBallImpulse, solveBallCushionImpulse } from './solver/impulse-solver.ts';

function clampNumber(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function reorientPlanarSpinToOutgoingDirection(
  spinX: number,
  spinY: number,
  incomingVx: number,
  incomingVy: number,
  outgoingVx: number,
  outgoingVy: number,
): { spinX: number; spinY: number } {
  const inSpeed = Math.hypot(incomingVx, incomingVy);
  const outSpeed = Math.hypot(outgoingVx, outgoingVy);
  if (inSpeed <= 1e-6 || outSpeed <= 1e-6) {
    return { spinX, spinY };
  }
  const inDx = incomingVx / inSpeed;
  const inDy = incomingVy / inSpeed;
  const outDx = outgoingVx / outSpeed;
  const outDy = outgoingVy / outSpeed;

  // Basis in incoming direction:
  // top basis = (dy, -dx), side basis = (dx, dy)
  const topSpinIn = spinX * inDy - spinY * inDx;
  const sideSpinIn = spinX * inDx + spinY * inDy;

  // Rebuild planar spin in outgoing direction basis.
  const nextSpinX = (topSpinIn * outDy) + (sideSpinIn * outDx);
  const nextSpinY = (-topSpinIn * outDx) + (sideSpinIn * outDy);
  return { spinX: nextSpinX, spinY: nextSpinY };
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
  // Internal runtime guard state: keep pre-contact heading until first ball-ball hit.
  preContactLockX?: number;
  preContactLockY?: number;
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
  spinZ?: number;
  throwTan?: number;
  throwAngleDeg?: number;
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
  clothLinearSpinCouplingPerSec: number;
  clothAngularSpinCouplingPerSec: number;
  recoveryFallbackEnabled: boolean;
  ballMassKg: number;
  maxSubstepEnergyGainJ: number;
};

export type StepRoomPhysicsHooks = {
  applyCushionContactThrow?: (input: CushionContactThrowInput) => CushionContactThrowResult;
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

type BallCollisionMeta = {
  firstId: string;
  secondId: string;
  firstNormalImpact: number;
  secondNormalImpact: number;
};

function clampCushionPostSpeed(
  vx: number,
  vy: number,
  preSpeed: number,
  maxGainRatio: number,
): { vx: number; vy: number } {
  const postSpeed = Math.hypot(vx, vy);
  if (preSpeed <= 1e-9 || postSpeed <= 1e-9) {
    return { vx, vy };
  }
  const allowedPostSpeed = preSpeed * maxGainRatio;
  if (postSpeed <= allowedPostSpeed) {
    return { vx, vy };
  }
  const ratio = allowedPostSpeed / postSpeed;
  return {
    vx: vx * ratio,
    vy: vy * ratio,
  };
}

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
  onCollisionMeta?: (meta: BallCollisionMeta) => void,
): void {
  const minDistance = ballRadiusM * 2;
  const minDistanceSq = minDistance * minDistance;
  const epsilon = 1e-8;
  const positionalCorrectionSlopM = 1e-4;
  const positionalCorrectionPercent = 0.9;
  const maxCorrectionPerBallM = ballRadiusM * 0.45;
  const cueDrawBoostSpeedCeilMps = 2.2;

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
    let effectiveRestitution = ballBallRestitution;
    const relativeVx = second.vx - first.vx;
    const relativeVy = second.vy - first.vy;
    const approachSpeedMps = Math.max(0, -((relativeVx * normalX) + (relativeVy * normalY)));

    const cue = first.id === 'cueBall'
      ? first
      : second.id === 'cueBall'
        ? second
        : null;
    const other = cue === first ? second : cue === second ? first : null;
    if (cue) {
      const cueSpeed = Math.hypot(cue.vx, cue.vy);
      const otherSpeed = other ? Math.hypot(other.vx, other.vy) : 0;
      if (cueSpeed > 1e-6 && approachSpeedMps > 1e-6) {
        const rollingTargetVx = -cue.spinY * ballRadiusM;
        const rollingTargetVy = cue.spinX * ballRadiusM;
        const followAssistDot = (rollingTargetVx * cue.vx) + (rollingTargetVy * cue.vy);
        const cueIsPrimaryStriker = cueSpeed > otherSpeed + 0.05;
        if (followAssistDot < 0 && cueIsPrimaryStriker) {
          const drawStrength = clampNumber(
            -followAssistDot / Math.max(1e-6, cueSpeed * Math.hypot(rollingTargetVx, rollingTargetVy)),
            0,
            1,
          );
          const lowSpeedFactor = clampNumber(
            (cueDrawBoostSpeedCeilMps - Math.max(cueSpeed, approachSpeedMps)) / cueDrawBoostSpeedCeilMps,
            0,
            1,
          );
          const restitutionBoost = 0.06 * drawStrength * lowSpeedFactor;
          effectiveRestitution = clampNumber(ballBallRestitution + restitutionBoost, 0.05, 0.99);
        }
      }
    }

    const result = solveBallBallImpulse(first, second, {
      normalX,
      normalY,
      restitution: effectiveRestitution,
      mass1Kg: 1,
      mass2Kg: 1,
    });
    return result.collided;
  }

  function computeNormalImpact(ball: PhysicsBallState, towardsX: number, towardsY: number): number {
    const speed = Math.hypot(ball.vx, ball.vy);
    if (speed <= 1e-9) {
      return 0;
    }
    const toward = Math.max(0, (ball.vx * towardsX) + (ball.vy * towardsY));
    return clampNumber(toward / speed, 0, 1);
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
        const firstNormalImpact = computeNormalImpact(first, normalX, normalY);
        const secondNormalImpact = computeNormalImpact(second, -normalX, -normalY);
        const collided = applyImpulse(first, second, normalX, normalY);
        if (!collided) {
          applyPositionalCorrection(first, second, normalX, normalY, hitDistance);
          continue;
        }
        onCollisionMeta?.({
          firstId: first.id,
          secondId: second.id,
          firstNormalImpact,
          secondNormalImpact,
        });
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
        const firstNormalImpact = computeNormalImpact(first, normalX, normalY);
        const secondNormalImpact = computeNormalImpact(second, -normalX, -normalY);
        const collided = applyImpulse(first, second, normalX, normalY);
        if (collided) {
          onCollisionMeta?.({
            firstId: first.id,
            secondId: second.id,
            firstNormalImpact,
            secondNormalImpact,
          });
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
  const cushionSeparationEpsilonM = Math.max(1e-4, config.ballRadiusM * 0.005);
  const minCushionReleaseNormalSpeedMps = Math.max(config.shotEndLinearSpeedThresholdMps * 2, 0.06);
  const cornerReleaseMarginM = cushionSeparationEpsilonM * 2;
  const drawReverseUnlockSubsteps = Math.max(2, Math.floor(config.substeps * 1.2));
  const drawReverseUnlockByBallId = new Map<string, number>();
  const drawReverseEligibilityByBallId = new Map<string, number>();
  const cushionFollowDampSubsteps = Math.max(3, Math.floor(config.substeps * 0.9));
  const cushionFollowDampByBallId = new Map<string, number>();
  const preContactLockReleaseSpeedMps = Math.max(config.shotEndLinearSpeedThresholdMps * 4, 0.045);
  const preContactLockRearmSpeedMps = 0.35;
  const preContactLockAlignCos = 0.25;

  for (const ball of balls) {
    const speed = Math.hypot(ball.vx, ball.vy);
    const hasLock = Number.isFinite(ball.preContactLockX) && Number.isFinite(ball.preContactLockY);
    if (!hasLock) {
      if (speed > 1e-6) {
        ball.preContactLockX = ball.vx / speed;
        ball.preContactLockY = ball.vy / speed;
      }
      continue;
    }

    if (speed <= preContactLockReleaseSpeedMps) {
      continue;
    }

    const lockX = ball.preContactLockX as number;
    const lockY = ball.preContactLockY as number;
    const currentDx = ball.vx / speed;
    const currentDy = ball.vy / speed;
    const align = (currentDx * lockX) + (currentDy * lockY);
    // New shot or clearly different heading: re-arm lock to current direction.
    if (speed >= preContactLockRearmSpeedMps && align < -preContactLockAlignCos) {
      ball.preContactLockX = currentDx;
      ball.preContactLockY = currentDy;
    }
  }

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

      if (ball.x <= config.ballRadiusM || ball.x >= config.tableWidthM - config.ballRadiusM) {
        reasonCounts.BOUNDARY_X += 1;
        const isLeftCushion = ball.x <= config.ballRadiusM;
        const cushionId: CushionId = isLeftCushion ? 'left' : 'right';
        collidedLeft = isLeftCushion;
        collidedRight = !isLeftCushion;
        const preVx = ball.vx;
        const preVy = ball.vy;
        const preSpinX = ball.spinX;
        const preSpinY = ball.spinY;
        const preNormalVel = ball.vx;
        const preNormalSpeedAbs = Math.abs(ball.vx);
        const preImpactSpeed = Math.hypot(ball.vx, ball.vy);
        ball.x = clampNumber(ball.x, config.ballRadiusM, config.tableWidthM - config.ballRadiusM);
        const cushionInput: CushionContactThrowInput = {
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
        const solved = solveBallCushionImpulse({
          axis: cushionInput.axis,
          vx: cushionInput.vx,
          vy: cushionInput.vy,
          spinX: cushionInput.spinX,
          spinY: cushionInput.spinY,
          spinZ: cushionInput.spinZ,
          restitution: cushionInput.restitution,
          friction: cushionInput.contactFriction,
          maxSpinMagnitude: cushionInput.maxSpinMagnitude,
          maxThrowAngleDeg: cushionInput.maxThrowAngleDeg,
          ballMassKg: config.ballMassKg,
          ballRadiusM: config.ballRadiusM,
          ballInertiaKgM2: (2 / 5) * config.ballMassKg * config.ballRadiusM * config.ballRadiusM,
        });
        const collision = hooks.applyCushionContactThrow?.(cushionInput) ?? solved;
        ball.vx = collision.vx * config.cushionPostCollisionSpeedScale;
        ball.vy = collision.vy * config.cushionPostCollisionSpeedScale;
        const reorientedSpin = reorientPlanarSpinToOutgoingDirection(
          preSpinX,
          preSpinY,
          preVx,
          preVy,
          ball.vx,
          ball.vy,
        );
        ball.spinX = reorientedSpin.spinX;
        ball.spinY = reorientedSpin.spinY;
        const normalSpeedRatio = clampNumber(
          preNormalSpeedAbs / Math.max(1e-6, config.cushionReferenceSpeedMps),
          0,
          1.5,
        );
        const cushionSpinRetention = clampNumber(
          1 - (config.cushionContactFriction * 0.45 * normalSpeedRatio),
          0.5,
          0.98,
        );
        let longitudinalSpinRetention = clampNumber(
          1 - (config.cushionContactFriction * 1.8 * normalSpeedRatio),
          0.15,
          0.85,
        );
        const spinAssistAlongOutgoing = -Math.sign(preNormalVel) * ball.spinY;
        if (spinAssistAlongOutgoing > 0) {
          longitudinalSpinRetention = Math.min(0.86, longitudinalSpinRetention + 0.05);
        } else if (spinAssistAlongOutgoing < 0) {
          // Back-spin against outgoing tangent should bleed faster at cushion contact.
          longitudinalSpinRetention = Math.max(0.08, longitudinalSpinRetention - 0.14);
        }
        const postSpeed = Math.hypot(ball.vx, ball.vy);
        if (preImpactSpeed > 1e-6 && postSpeed > 1e-6) {
          const headingDot = clampNumber(
            ((preVx * ball.vx) + (preVy * ball.vy)) / (preImpactSpeed * postSpeed),
            -1,
            1,
          );
          const turnFactor = (1 - headingDot) * 0.5;
          longitudinalSpinRetention = clampNumber(
            longitudinalSpinRetention * (1 - (0.35 * turnFactor)),
            0.08,
            0.9,
          );
        }
        const transverseSpinRetention = clampNumber(
          1 - (config.cushionContactFriction * 0.9 * normalSpeedRatio),
          0.3,
          0.92,
        );
        // axis=x 충돌에서는 spinY가 쿠션 반응(탑/백 진행성분)에 더 직접 관여한다.
        ball.spinY *= longitudinalSpinRetention;
        ball.spinX *= transverseSpinRetention;
        ball.spinZ = (collision.spinZ ?? solved.spinZ) * cushionSpinRetention;
        if (spinAssistAlongOutgoing > 0) {
          const clamped = clampCushionPostSpeed(ball.vx, ball.vy, preImpactSpeed, 0.96);
          ball.vx = clamped.vx;
          ball.vy = clamped.vy;
        } else if (spinAssistAlongOutgoing < 0) {
          const clamped = clampCushionPostSpeed(ball.vx, ball.vy, preImpactSpeed, 0.97);
          ball.vx = clamped.vx;
          ball.vy = clamped.vy;
        }
        const releaseSign = isLeftCushion ? 1 : -1;
        const currentReleaseNormalSpeed = releaseSign * ball.vx;
        if (currentReleaseNormalSpeed < minCushionReleaseNormalSpeedMps) {
          ball.vx = releaseSign * minCushionReleaseNormalSpeedMps;
        }
        if (isLeftCushion) {
          ball.x = Math.max(ball.x, config.ballRadiusM + cushionSeparationEpsilonM);
        } else {
          ball.x = Math.min(ball.x, config.tableWidthM - config.ballRadiusM - cushionSeparationEpsilonM);
        }
        const speedAfterCushion = Math.hypot(ball.vx, ball.vy);
        if (speedAfterCushion > 1e-6) {
          ball.preContactLockX = ball.vx / speedAfterCushion;
          ball.preContactLockY = ball.vy / speedAfterCushion;
        }
        cushionFollowDampByBallId.set(ball.id, cushionFollowDampSubsteps);
        hooks.onCushionCollision?.(ball, cushionId);
      }
      if (ball.y <= config.ballRadiusM || ball.y >= config.tableHeightM - config.ballRadiusM) {
        reasonCounts.BOUNDARY_Y += 1;
        const isTopCushion = ball.y <= config.ballRadiusM;
        const cushionId: CushionId = isTopCushion ? 'top' : 'bottom';
        collidedTop = isTopCushion;
        collidedBottom = !isTopCushion;
        const preVx = ball.vx;
        const preVy = ball.vy;
        const preSpinX = ball.spinX;
        const preSpinY = ball.spinY;
        const preNormalVel = ball.vy;
        const preNormalSpeedAbs = Math.abs(ball.vy);
        const preImpactSpeed = Math.hypot(ball.vx, ball.vy);
        ball.y = clampNumber(ball.y, config.ballRadiusM, config.tableHeightM - config.ballRadiusM);
        const cushionInput: CushionContactThrowInput = {
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
        const solved = solveBallCushionImpulse({
          axis: cushionInput.axis,
          vx: cushionInput.vx,
          vy: cushionInput.vy,
          spinX: cushionInput.spinX,
          spinY: cushionInput.spinY,
          spinZ: cushionInput.spinZ,
          restitution: cushionInput.restitution,
          friction: cushionInput.contactFriction,
          maxSpinMagnitude: cushionInput.maxSpinMagnitude,
          maxThrowAngleDeg: cushionInput.maxThrowAngleDeg,
          ballMassKg: config.ballMassKg,
          ballRadiusM: config.ballRadiusM,
          ballInertiaKgM2: (2 / 5) * config.ballMassKg * config.ballRadiusM * config.ballRadiusM,
        });
        const collision = hooks.applyCushionContactThrow?.(cushionInput) ?? solved;
        ball.vx = collision.vx * config.cushionPostCollisionSpeedScale;
        ball.vy = collision.vy * config.cushionPostCollisionSpeedScale;
        const reorientedSpin = reorientPlanarSpinToOutgoingDirection(
          preSpinX,
          preSpinY,
          preVx,
          preVy,
          ball.vx,
          ball.vy,
        );
        ball.spinX = reorientedSpin.spinX;
        ball.spinY = reorientedSpin.spinY;
        const normalSpeedRatio = clampNumber(
          preNormalSpeedAbs / Math.max(1e-6, config.cushionReferenceSpeedMps),
          0,
          1.5,
        );
        const cushionSpinRetention = clampNumber(
          1 - (config.cushionContactFriction * 0.45 * normalSpeedRatio),
          0.5,
          0.98,
        );
        let longitudinalSpinRetention = clampNumber(
          1 - (config.cushionContactFriction * 1.8 * normalSpeedRatio),
          0.15,
          0.85,
        );
        const spinAssistAlongOutgoing = -Math.sign(preNormalVel) * ball.spinX;
        if (spinAssistAlongOutgoing > 0) {
          longitudinalSpinRetention = Math.min(0.86, longitudinalSpinRetention + 0.05);
        } else if (spinAssistAlongOutgoing < 0) {
          // Back-spin against outgoing tangent should bleed faster at cushion contact.
          longitudinalSpinRetention = Math.max(0.08, longitudinalSpinRetention - 0.14);
        }
        const postSpeed = Math.hypot(ball.vx, ball.vy);
        if (preImpactSpeed > 1e-6 && postSpeed > 1e-6) {
          const headingDot = clampNumber(
            ((preVx * ball.vx) + (preVy * ball.vy)) / (preImpactSpeed * postSpeed),
            -1,
            1,
          );
          const turnFactor = (1 - headingDot) * 0.5;
          longitudinalSpinRetention = clampNumber(
            longitudinalSpinRetention * (1 - (0.35 * turnFactor)),
            0.08,
            0.9,
          );
        }
        const transverseSpinRetention = clampNumber(
          1 - (config.cushionContactFriction * 0.9 * normalSpeedRatio),
          0.3,
          0.92,
        );
        // axis=y 충돌에서는 spinX가 쿠션 반응(탑/백 진행성분)에 더 직접 관여한다.
        ball.spinX *= longitudinalSpinRetention;
        ball.spinY *= transverseSpinRetention;
        ball.spinZ = (collision.spinZ ?? solved.spinZ) * cushionSpinRetention;
        if (spinAssistAlongOutgoing > 0) {
          const clamped = clampCushionPostSpeed(ball.vx, ball.vy, preImpactSpeed, 0.96);
          ball.vx = clamped.vx;
          ball.vy = clamped.vy;
        } else if (spinAssistAlongOutgoing < 0) {
          const clamped = clampCushionPostSpeed(ball.vx, ball.vy, preImpactSpeed, 0.97);
          ball.vx = clamped.vx;
          ball.vy = clamped.vy;
        }
        const releaseSign = isTopCushion ? 1 : -1;
        const currentReleaseNormalSpeed = releaseSign * ball.vy;
        if (currentReleaseNormalSpeed < minCushionReleaseNormalSpeedMps) {
          ball.vy = releaseSign * minCushionReleaseNormalSpeedMps;
        }
        if (isTopCushion) {
          ball.y = Math.max(ball.y, config.ballRadiusM + cushionSeparationEpsilonM);
        } else {
          ball.y = Math.min(ball.y, config.tableHeightM - config.ballRadiusM - cushionSeparationEpsilonM);
        }
        const speedAfterCushion = Math.hypot(ball.vx, ball.vy);
        if (speedAfterCushion > 1e-6) {
          ball.preContactLockX = ball.vx / speedAfterCushion;
          ball.preContactLockY = ball.vy / speedAfterCushion;
        }
        cushionFollowDampByBallId.set(ball.id, cushionFollowDampSubsteps);
        hooks.onCushionCollision?.(ball, cushionId);
      }
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

    for (const ball of balls) {
      const remain = drawReverseUnlockByBallId.get(ball.id) ?? 0;
      if (remain > 0) {
        const next = remain - 1;
        if (next > 0) {
          drawReverseUnlockByBallId.set(ball.id, next);
        } else {
          drawReverseUnlockByBallId.delete(ball.id);
          drawReverseEligibilityByBallId.delete(ball.id);
        }
      }
      const cushionRemain = cushionFollowDampByBallId.get(ball.id) ?? 0;
      if (cushionRemain > 0) {
        const next = cushionRemain - 1;
        if (next > 0) {
          cushionFollowDampByBallId.set(ball.id, next);
        } else {
          cushionFollowDampByBallId.delete(ball.id);
        }
      }
    }

    resolveBallBallCollisions(
      balls,
      prevPositions,
      substepDtSec,
      config.ballBallRestitution,
      config.ballRadiusM,
      (first, second) => {
        drawReverseUnlockByBallId.set(first.id, drawReverseUnlockSubsteps);
        drawReverseUnlockByBallId.set(second.id, drawReverseUnlockSubsteps);
        const firstReverseEligibility = drawReverseEligibilityByBallId.get(first.id) ?? 1;
        const secondReverseEligibility = drawReverseEligibilityByBallId.get(second.id) ?? 1;
        if (first.id !== 'cueBall' || firstReverseEligibility >= 0.62) {
          first.preContactLockX = undefined;
          first.preContactLockY = undefined;
        }
        if (second.id !== 'cueBall' || secondReverseEligibility >= 0.62) {
          second.preContactLockX = undefined;
          second.preContactLockY = undefined;
        }
        hooks.onBallCollision?.(first, second);
      },
      (meta) => {
        const cueId = 'cueBall';
        const cueImpact = meta.firstId === cueId
          ? meta.firstNormalImpact
          : meta.secondId === cueId
            ? meta.secondNormalImpact
            : undefined;
        if (cueImpact === undefined) {
          return;
        }
        const reverseEligibility = clampNumber((cueImpact - 0.55) / 0.35, 0, 1);
        drawReverseEligibilityByBallId.set(cueId, reverseEligibility);
      },
    );

    for (const ball of balls) {
      if (ball.isPocketed) {
        continue;
      }
      const spinXY = Math.hypot(ball.spinX, ball.spinY);
      const spinActivation = clampNumber(
        spinXY / Math.max(1e-6, config.cushionMaxSpinMagnitude * 0.2),
        0,
        1,
      );
      const linearSpinCoupling = clampNumber(
        config.clothLinearSpinCouplingPerSec * substepDtSec * spinActivation,
        0,
        1,
      );
      const rollingTargetVx = -ball.spinY * config.ballRadiusM;
      const rollingTargetVy = ball.spinX * config.ballRadiusM;
      const speedBeforeCoupling = Math.hypot(ball.vx, ball.vy);
      const rollingTargetSpeed = Math.hypot(rollingTargetVx, rollingTargetVy);
      let effectiveTargetVx = rollingTargetVx;
      let effectiveTargetVy = rollingTargetVy;
      const followAssistDot = (rollingTargetVx * ball.vx) + (rollingTargetVy * ball.vy);
      const cushionFollowRemain = cushionFollowDampByBallId.get(ball.id) ?? 0;
      const drawStrength = followAssistDot < 0
        ? clampNumber(
          -followAssistDot / Math.max(1e-6, speedBeforeCoupling * rollingTargetSpeed),
          0,
          1,
        )
        : 0;
      if (followAssistDot < 0) {
        // Draw(back-spin) can over-pull at low speed; cap spin-induced target velocity.
        const targetSpeed = Math.hypot(effectiveTargetVx, effectiveTargetVy);
        const strongDrawAllowance = 1 + (0.28 * drawStrength);
        const drawTargetSpeedCap = (0.58 + (0.45 * speedBeforeCoupling)) * strongDrawAllowance;
        if (targetSpeed > drawTargetSpeedCap && targetSpeed > 1e-9) {
          const scale = drawTargetSpeedCap / targetSpeed;
          effectiveTargetVx *= scale;
          effectiveTargetVy *= scale;
        }
      }
      // If spin is assisting current travel direction (follow), reduce coupling at low speed.
      // This keeps top-spin follow feel but avoids over-accelerating cue ball after object-ball hit.
      const lowSpeedFactor = clampNumber((0.9 - speedBeforeCoupling) / 0.9, 0, 1);
      let couplingScale = followAssistDot > 0
        ? (1 - 0.62 * lowSpeedFactor) // follow(top-spin) suppression
        : followAssistDot < 0
          ? (1 - 0.65 * lowSpeedFactor) // draw(back-spin) suppression
          : 1;
      if (followAssistDot > 0 && cushionFollowRemain > 0) {
        const cushionWindow = clampNumber(cushionFollowRemain / cushionFollowDampSubsteps, 0, 1);
        couplingScale *= (0.45 + (0.2 * (1 - cushionWindow)));
      }
      if (followAssistDot < 0) {
        // Prevent unrealistically early draw reversal on weak shots.
        // At low translational speed, fade-in draw coupling gradually.
        const drawEngageRamp = clampNumber((speedBeforeCoupling - 0.55) / (1.6 - 0.55), 0, 1);
        const weakDrawFactor = clampNumber((0.6 - drawStrength) / 0.6, 0, 1);
        const weakDrawRamp = 0.2 + (0.8 * drawEngageRamp);
        const drawRampScale = 1 - (weakDrawFactor * (1 - weakDrawRamp));
        couplingScale *= drawRampScale;
      }
      const effectiveLinearSpinCoupling = linearSpinCoupling * couplingScale;
      if (followAssistDot > 0 && cushionFollowRemain > 0) {
        const targetSpeed = Math.hypot(effectiveTargetVx, effectiveTargetVy);
        const cushionWindow = clampNumber(cushionFollowRemain / cushionFollowDampSubsteps, 0, 1);
        const postCushionTargetCap = speedBeforeCoupling * (0.9 + (0.08 * (1 - cushionWindow)));
        if (targetSpeed > postCushionTargetCap && targetSpeed > 1e-9) {
          const scale = postCushionTargetCap / targetSpeed;
          effectiveTargetVx *= scale;
          effectiveTargetVy *= scale;
        }
      }
      let nextVx = ball.vx + ((effectiveTargetVx - ball.vx) * effectiveLinearSpinCoupling);
      let nextVy = ball.vy + ((effectiveTargetVy - ball.vy) * effectiveLinearSpinCoupling);
      const hasRecentBallCollision = (drawReverseUnlockByBallId.get(ball.id) ?? 0) > 0;
      const reverseEligibility = drawReverseEligibilityByBallId.get(ball.id) ?? 0;
      const lockDir = Number.isFinite(ball.preContactLockX) && Number.isFinite(ball.preContactLockY)
        ? { x: ball.preContactLockX as number, y: ball.preContactLockY as number }
        : undefined;
      if (followAssistDot < 0) {
        const currentSpeed = Math.hypot(ball.vx, ball.vy);
        if (currentSpeed > 1e-6) {
          const currentDx = ball.vx / currentSpeed;
          const currentDy = ball.vy / currentSpeed;
          const alongCurrent = (nextVx * currentDx) + (nextVy * currentDy);
          const allowReverseNow = hasRecentBallCollision
            && reverseEligibility >= 0.62
            && speedBeforeCoupling <= 0.45
            && drawStrength >= 0.72;
          if (!allowReverseNow && alongCurrent < 0) {
            // Prevent premature reversal before contact: draw should mostly
            // consume forward speed first, then reverse near stop.
            const minAlongCurrent = Math.min(0.14, currentSpeed * 0.3);
            const deltaAlong = minAlongCurrent - alongCurrent;
            nextVx += currentDx * deltaAlong;
            nextVy += currentDy * deltaAlong;
          }
          if (!allowReverseNow) {
            // Additional no-contact safety: keep dominant-axis direction
            // from flipping before any ball-ball collision unlock.
            if (Math.abs(ball.vx) >= Math.abs(ball.vy) && Math.abs(ball.vx) > 0.005 && (nextVx * ball.vx) < 0) {
              nextVx = Math.sign(ball.vx) * Math.max(0.005, Math.abs(ball.vx) * 0.2);
            } else if (Math.abs(ball.vy) > Math.abs(ball.vx) && Math.abs(ball.vy) > 0.005 && (nextVy * ball.vy) < 0) {
              nextVy = Math.sign(ball.vy) * Math.max(0.005, Math.abs(ball.vy) * 0.2);
            }
          }
        } else if (!hasRecentBallCollision) {
          // Near-stop + no-contact: do not allow spin coupling to create
          // a sudden backward launch.
          nextVx = ball.vx;
          nextVy = ball.vy;
        }
      }
      if (!hasRecentBallCollision && lockDir) {
        const alongLock = (nextVx * lockDir.x) + (nextVy * lockDir.y);
        if (alongLock < 0.005) {
          const deltaAlong = 0.005 - alongLock;
          nextVx += lockDir.x * deltaAlong;
          nextVy += lockDir.y * deltaAlong;
        }
      }
      ball.vx = nextVx;
      ball.vy = nextVy;

      ball.vx *= linearDamping;
      ball.vy *= linearDamping;
      ball.spinX *= spinDamping;
      ball.spinY *= spinDamping;
      ball.spinZ *= spinDamping;
      const spinCap = Math.max(1e-6, config.cushionMaxSpinMagnitude);
      ball.spinX = clampNumber(ball.spinX, -spinCap, spinCap);
      ball.spinY = clampNumber(ball.spinY, -spinCap, spinCap);
      ball.spinZ = clampNumber(ball.spinZ, -spinCap, spinCap);
      maxObservedSpeedMps = Math.max(maxObservedSpeedMps, Math.hypot(ball.vx, ball.vy));
      if (Math.hypot(ball.vx, ball.vy) < config.shotEndLinearSpeedThresholdMps) {
        ball.vx = 0;
        ball.vy = 0;
      }
      const speed = Math.hypot(ball.vx, ball.vy);
      if (!hasRecentBallCollision && speed > 1e-6) {
        // Keep lock oriented to the latest legal forward heading before first ball contact.
        const currentDx = ball.vx / speed;
        const currentDy = ball.vy / speed;
        if (lockDir) {
          const align = (currentDx * lockDir.x) + (currentDy * lockDir.y);
          if (align > 0.15) {
            ball.preContactLockX = currentDx;
            ball.preContactLockY = currentDy;
          }
        } else {
          ball.preContactLockX = currentDx;
          ball.preContactLockY = currentDy;
        }
      }
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
      if (Math.hypot(ball.vx, ball.vy) <= preContactLockReleaseSpeedMps && Math.hypot(ball.spinX, ball.spinY) < 0.2) {
        ball.preContactLockX = undefined;
        ball.preContactLockY = undefined;
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
