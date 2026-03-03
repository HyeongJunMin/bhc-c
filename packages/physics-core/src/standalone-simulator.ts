/**
 * Standalone physics simulator – browser/server-agnostic pure functions.
 *
 * Extracts the physics loop from apps/game-server/src/lobby/http.ts so that
 * the web test-page can run the same simulation without any Node.js dependencies.
 *
 * Coordinate convention:
 *   x  – horizontal (0 = left cushion inner face, TABLE_WIDTH_M = right)
 *   z  – vertical   (0 = bottom cushion inner face, TABLE_HEIGHT_M = top)
 *   (The server snapshot schema stores z as `y`; this file uses explicit z.)
 */

import { applyCushionContactThrow } from './cushion-contact-throw.ts';
import { applyBallSurfaceFriction, type BallMotionState } from './ball-surface-friction.ts';
import { applyBallBallCollisionWithSpin } from './ball-ball-collision.ts';
import { computeShotInitialization } from './shot-init.ts';
import { computeSquirtAngleRad } from './squirt.ts';
import {
  TABLE_WIDTH_M,
  TABLE_HEIGHT_M,
  BALL_RADIUS_M,
  BALL_MASS_KG,
  CUSHION_THICKNESS_M,
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
  MAX_BALL_SPEED_MPS,
  PENETRATION_SLOP_M,
  POSITION_CORRECTION_SCALE,
} from './constants.ts';

// ─── Types ────────────────────────────────────────────────────────────────────

export type SimBallId = 'cueBall' | 'objectBall1' | 'objectBall2';

export type SimBall = {
  id: SimBallId;
  x: number;
  z: number;
  vx: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  motionState: BallMotionState;
  isPocketed: boolean;
};

export type SimEvent = {
  type: 'CUSHION' | 'BALL_BALL';
  frameIndex: number;
  timeSec: number;
  ballId: string;
  targetBallId?: string;
  axis?: 'x' | 'z';
  position: { x: number; z: number };
  speedBefore: number;
  speedAfter: number;
};

export type TrajectoryFrameBall = {
  id: string;
  x: number;
  z: number;
  vx: number;
  vz: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  speed: number;
};

export type TrajectoryFrame = {
  balls: TrajectoryFrameBall[];
};

export type SimulationResult = {
  frames: TrajectoryFrame[];
  events: SimEvent[];
  totalFrames: number;
  totalTimeSec: number;
};

export type SimShotInput = {
  directionDeg: number;
  dragPx: number;
  impactOffsetX: number;
  impactOffsetY: number;
};

export type SimulateInput = {
  balls: Array<{ id: SimBallId; x: number; z: number }>;
  shot: SimShotInput;
  maxFrames?: number;
};

// ─── Physics constants ────────────────────────────────────────────────────────

const PHYSICS_FRAME_MS = 50;
const PHYSICS_DT_SEC = PHYSICS_FRAME_MS / 1000;
const PHYSICS_SUBSTEPS = 4;
const STATIONARY_LINEAR_THRESHOLD = 0.01;
const STATIONARY_ANGULAR_THRESHOLD = 0.2;
// Number of consecutive frames below threshold before declaring settled
const SETTLED_FRAMES_REQUIRED = 3;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function snapshotBalls(balls: SimBall[]): TrajectoryFrame {
  return {
    balls: balls.map((b) => ({
      id: b.id,
      x: b.x,
      z: b.z,
      vx: b.vx,
      vz: b.vz,
      spinX: b.spinX,
      spinY: b.spinY,
      spinZ: b.spinZ,
      speed: Math.hypot(b.vx, b.vz),
    })),
  };
}

// ─── Shot initialisation ─────────────────────────────────────────────────────

function initializeShotOnBall(ball: SimBall, shot: SimShotInput): void {
  const { directionDeg, dragPx, impactOffsetX, impactOffsetY } = shot;
  const clampedOffsetX = clampNumber(impactOffsetX, -BALL_RADIUS_M, BALL_RADIUS_M);
  const clampedOffsetY = clampNumber(impactOffsetY, -BALL_RADIUS_M, BALL_RADIUS_M);

  const initialization = computeShotInitialization({
    dragPx,
    impactOffsetX: clampedOffsetX,
    impactOffsetY: clampedOffsetY,
  });

  const directionRad = (directionDeg * Math.PI) / 180;
  const squirtAngleRad = computeSquirtAngleRad({
    impactOffsetX: clampedOffsetX,
    ballRadiusM: BALL_RADIUS_M,
  });
  const finalDirectionRad = directionRad - squirtAngleRad;

  ball.vx = Math.cos(finalDirectionRad) * initialization.initialBallSpeedMps;
  ball.vz = Math.sin(finalDirectionRad) * initialization.initialBallSpeedMps;
  ball.spinX = initialization.omegaX;
  ball.spinY = initialization.omegaY;
  ball.spinZ = 0;
  ball.motionState = 'SLIDING';
}

// ─── Ball-ball collision ──────────────────────────────────────────────────────

/**
 * Resolves ball-ball collisions for one substep.
 * The ball-ball-collision module mutates `{vx, vy, spinY}` on the passed
 * objects – we bridge our `vz` field to `vy` via proxy-like local objects.
 */
function resolveBallCollisions(
  balls: SimBall[],
  prevPositions: Array<{ x: number; z: number }>,
  substepDtSec: number,
  events: SimEvent[],
  frameIndex: number,
): void {
  const minDistance = BALL_RADIUS_M * 2;
  const minDistanceSq = minDistance * minDistance;
  const epsilon = 1e-8;

  function applyImpulse(
    first: SimBall,
    second: SimBall,
    normalX: number,
    normalY: number,
    frameIdx: number,
  ): boolean {
    // Bridge: the ball-ball module uses `vy` for the z-velocity.
    const firstProxy = { vx: first.vx, vy: first.vz, spinY: first.spinY };
    const secondProxy = { vx: second.vx, vy: second.vz, spinY: second.spinY };

    const speedBefore = Math.hypot(first.vx, first.vz);

    const result = applyBallBallCollisionWithSpin({
      first: firstProxy,
      second: secondProxy,
      normalX,
      normalY,
      restitution: BALL_BALL_RESTITUTION,
      ballMassKg: BALL_MASS_KG,
      ballRadiusM: BALL_RADIUS_M,
    });

    if (result.collided) {
      first.vx = firstProxy.vx;
      first.vz = firstProxy.vy;
      first.spinY = firstProxy.spinY;
      second.vx = secondProxy.vx;
      second.vz = secondProxy.vy;
      second.spinY = secondProxy.spinY;

      events.push({
        type: 'BALL_BALL',
        frameIndex: frameIdx,
        timeSec: frameIdx * PHYSICS_DT_SEC,
        ballId: first.id,
        targetBallId: second.id,
        position: { x: (first.x + second.x) / 2, z: (first.z + second.z) / 2 },
        speedBefore,
        speedAfter: Math.hypot(first.vx, first.vz),
      });
    }

    return result.collided;
  }

  function sweepHitTime(
    firstPrev: { x: number; z: number },
    firstCurr: SimBall,
    secondPrev: { x: number; z: number },
    secondCurr: SimBall,
  ): number | null {
    const startX = secondPrev.x - firstPrev.x;
    const startZ = secondPrev.z - firstPrev.z;
    const endX = secondCurr.x - firstCurr.x;
    const endZ = secondCurr.z - firstCurr.z;
    const moveX = endX - startX;
    const moveZ = endZ - startZ;
    const moveLenSq = moveX * moveX + moveZ * moveZ;
    let t = 0;
    if (moveLenSq > epsilon) {
      t = -((startX * moveX) + (startZ * moveZ)) / moveLenSq;
      t = clampNumber(t, 0, 1);
    }
    const closestX = startX + moveX * t;
    const closestZ = startZ + moveZ * t;
    const closestDistSq = closestX * closestX + closestZ * closestZ;
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
      const deltaZ = second.z - first.z;
      const distanceSq = deltaX * deltaX + deltaZ * deltaZ;
      if (Number.isFinite(distanceSq) && distanceSq <= minDistanceSq) {
        const distance = Math.sqrt(Math.max(distanceSq, epsilon));
        const normalX = distance > epsilon ? deltaX / distance : 1;
        const normalY = distance > epsilon ? deltaZ / distance : 0;
        applyImpulse(first, second, normalX, normalY, frameIndex);
        const penetration = minDistance - distance;
        if (penetration > 0) {
          const correction =
            (Math.max(penetration - PENETRATION_SLOP_M, 0) / 2) * POSITION_CORRECTION_SCALE;
          first.x -= normalX * correction;
          first.z -= normalY * correction;
          second.x += normalX * correction;
          second.z += normalY * correction;
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
      const firstHitZ = firstPrev.z + (first.z - firstPrev.z) * hitTime;
      const secondHitX = secondPrev.x + (second.x - secondPrev.x) * hitTime;
      const secondHitZ = secondPrev.z + (second.z - secondPrev.z) * hitTime;
      const hitDeltaX = secondHitX - firstHitX;
      const hitDeltaZ = secondHitZ - firstHitZ;
      const hitDistance = Math.hypot(hitDeltaX, hitDeltaZ);
      const normalX = hitDistance > epsilon ? hitDeltaX / hitDistance : 1;
      const normalY = hitDistance > epsilon ? hitDeltaZ / hitDistance : 0;
      const collided = applyImpulse(first, second, normalX, normalY, frameIndex);
      if (!collided) {
        continue;
      }
      first.x = firstHitX;
      first.z = firstHitZ;
      second.x = secondHitX;
      second.z = secondHitZ;
      const remainDtSec = substepDtSec * (1 - hitTime);
      first.x += first.vx * remainDtSec;
      first.z += first.vz * remainDtSec;
      second.x += second.vx * remainDtSec;
      second.z += second.vz * remainDtSec;
    }
  }
}

// ─── One physics frame ────────────────────────────────────────────────────────

function stepPhysics(balls: SimBall[], events: SimEvent[], frameIndex: number): void {
  const substepDtSec = PHYSICS_DT_SEC / PHYSICS_SUBSTEPS;

  for (let step = 0; step < PHYSICS_SUBSTEPS; step += 1) {
    const prevPositions = balls.map((b) => ({ x: b.x, z: b.z }));

    for (const ball of balls) {
      if (ball.isPocketed) {
        continue;
      }

      let x = ball.x;
      let z = ball.z;
      let vx = ball.vx;
      let vz = ball.vz;
      let spinX = ball.spinX;
      let spinY = ball.spinY;
      let spinZ = ball.spinZ;

      x += vx * substepDtSec;
      z += vz * substepDtSec;

      const xMin = CUSHION_THICKNESS_M + BALL_RADIUS_M;
      const xMax = TABLE_WIDTH_M - CUSHION_THICKNESS_M - BALL_RADIUS_M;
      const zMin = CUSHION_THICKNESS_M + BALL_RADIUS_M;
      const zMax = TABLE_HEIGHT_M - CUSHION_THICKNESS_M - BALL_RADIUS_M;

      // Track the start of the current linear movement segment.
      // Updated after each collision so that the next collision's
      // interpolation uses the correct origin.
      let moveFromX = ball.x;
      let moveFromZ = ball.z;

      // X-axis cushion collision
      if (x <= xMin || x >= xMax) {
        const speedBefore = Math.hypot(vx, vz);
        const xBoundary = x <= xMin ? xMin : xMax;
        const dx = x - moveFromX;
        const tHit = Math.abs(dx) > 1e-12
          ? clampNumber((xBoundary - moveFromX) / dx, 0, 1) : 0;
        const collZ = moveFromZ + (z - moveFromZ) * tHit;
        x = xBoundary;
        z = collZ;
        const collision = applyCushionContactThrow({
          axis: 'x',
          vx,
          vy: vz,
          spinX,
          spinY,
          spinZ,
          restitution: CUSHION_RESTITUTION,
          contactFriction: CUSHION_CONTACT_FRICTION_COEFFICIENT,
          referenceNormalSpeedMps: CUSHION_CONTACT_REFERENCE_SPEED_MPS,
          contactTimeExponent: CUSHION_CONTACT_TIME_EXPONENT,
          maxSpinMagnitude: CUSHION_MAX_SPIN_MAGNITUDE,
          maxThrowAngleDeg: CUSHION_MAX_THROW_ANGLE_DEG,
          ballMassKg: BALL_MASS_KG,
          ballRadiusM: BALL_RADIUS_M,
          cushionHeightM: CUSHION_HEIGHT_M,
          rollingSpinHeightFactor: CUSHION_ROLLING_SPIN_HEIGHT_FACTOR,
          cushionTorqueDamping: CUSHION_TORQUE_DAMPING,
          maxSpeedScale: CUSHION_MAX_SPEED_SCALE,
          restitutionLow: CUSHION_RESTITUTION_LOW,
          restitutionHigh: CUSHION_RESTITUTION_HIGH,
          restitutionMidSpeedMps: CUSHION_RESTITUTION_MID_SPEED_MPS,
          restitutionSigmoidK: CUSHION_RESTITUTION_SIGMOID_K,
          frictionSpinDamping: CUSHION_FRICTION_SPIN_DAMPING,
        });
        vx = collision.vx;
        vz = collision.vy;
        spinX = collision.spinX;
        spinY = collision.spinY;
        spinZ = collision.spinZ;
        events.push({
          type: 'CUSHION',
          frameIndex,
          timeSec: frameIndex * PHYSICS_DT_SEC,
          ballId: ball.id,
          axis: 'x',
          position: { x: xBoundary, z: collZ },
          speedBefore,
          speedAfter: Math.hypot(vx, vz),
        });
        // Advance remaining substep time with post-collision velocity
        const remainDt = substepDtSec * (1 - tHit);
        moveFromX = xBoundary;
        moveFromZ = collZ;
        x = moveFromX + vx * remainDt;
        z = moveFromZ + vz * remainDt;
      }

      // Z-axis cushion collision
      if (z <= zMin || z >= zMax) {
        const speedBefore = Math.hypot(vx, vz);
        const zBoundary = z <= zMin ? zMin : zMax;
        const dz = z - moveFromZ;
        const tHit = Math.abs(dz) > 1e-12
          ? clampNumber((zBoundary - moveFromZ) / dz, 0, 1) : 0;
        const collX = moveFromX + (x - moveFromX) * tHit;
        x = collX;
        z = zBoundary;
        const collision = applyCushionContactThrow({
          axis: 'y',
          vx,
          vy: vz,
          spinX,
          spinY,
          spinZ,
          restitution: CUSHION_RESTITUTION,
          contactFriction: CUSHION_CONTACT_FRICTION_COEFFICIENT,
          referenceNormalSpeedMps: CUSHION_CONTACT_REFERENCE_SPEED_MPS,
          contactTimeExponent: CUSHION_CONTACT_TIME_EXPONENT,
          maxSpinMagnitude: CUSHION_MAX_SPIN_MAGNITUDE,
          maxThrowAngleDeg: CUSHION_MAX_THROW_ANGLE_DEG,
          ballMassKg: BALL_MASS_KG,
          ballRadiusM: BALL_RADIUS_M,
          cushionHeightM: CUSHION_HEIGHT_M,
          rollingSpinHeightFactor: CUSHION_ROLLING_SPIN_HEIGHT_FACTOR,
          cushionTorqueDamping: CUSHION_TORQUE_DAMPING,
          maxSpeedScale: CUSHION_MAX_SPEED_SCALE,
          restitutionLow: CUSHION_RESTITUTION_LOW,
          restitutionHigh: CUSHION_RESTITUTION_HIGH,
          restitutionMidSpeedMps: CUSHION_RESTITUTION_MID_SPEED_MPS,
          restitutionSigmoidK: CUSHION_RESTITUTION_SIGMOID_K,
          frictionSpinDamping: CUSHION_FRICTION_SPIN_DAMPING,
        });
        vx = collision.vx;
        vz = collision.vy;
        spinX = collision.spinX;
        spinY = collision.spinY;
        spinZ = collision.spinZ;
        events.push({
          type: 'CUSHION',
          frameIndex,
          timeSec: frameIndex * PHYSICS_DT_SEC,
          ballId: ball.id,
          axis: 'z',
          position: { x: collX, z: zBoundary },
          speedBefore,
          speedAfter: Math.hypot(vx, vz),
        });
        // Advance remaining substep time with post-collision velocity
        const remainDt = substepDtSec * (1 - tHit);
        x = collX + vx * remainDt;
        z = zBoundary + vz * remainDt;
      }

      ball.x = x;
      ball.z = z;
      ball.vx = vx;
      ball.vz = vz;
      ball.spinX = spinX;
      ball.spinY = spinY;
      ball.spinZ = spinZ;
    }

    resolveBallCollisions(balls, prevPositions, substepDtSec, events, frameIndex);

    for (const ball of balls) {
      if (ball.isPocketed) {
        continue;
      }

      // applyBallSurfaceFriction uses `vy` for the z-velocity (same schema as server)
      const frictionResult = applyBallSurfaceFriction({
        vx: ball.vx,
        vy: ball.vz,
        spinX: ball.spinX,
        spinY: ball.spinY,
        spinZ: ball.spinZ,
        radiusM: BALL_RADIUS_M,
        dtSec: substepDtSec,
      });
      ball.vx = frictionResult.vx;
      ball.vz = frictionResult.vy;
      ball.spinX = frictionResult.spinX;
      ball.spinY = frictionResult.spinY;
      ball.spinZ = frictionResult.spinZ;
      ball.motionState = frictionResult.motionState;

      const speed = Math.hypot(ball.vx, ball.vz);
      if (speed > MAX_BALL_SPEED_MPS) {
        const ratio = MAX_BALL_SPEED_MPS / speed;
        ball.vx *= ratio;
        ball.vz *= ratio;
      }

      ball.x = clampNumber(
        ball.x,
        CUSHION_THICKNESS_M + BALL_RADIUS_M,
        TABLE_WIDTH_M - CUSHION_THICKNESS_M - BALL_RADIUS_M,
      );
      ball.z = clampNumber(
        ball.z,
        CUSHION_THICKNESS_M + BALL_RADIUS_M,
        TABLE_HEIGHT_M - CUSHION_THICKNESS_M - BALL_RADIUS_M,
      );
      ball.vx = Number.isFinite(ball.vx) ? ball.vx : 0;
      ball.vz = Number.isFinite(ball.vz) ? ball.vz : 0;
      ball.spinX = Number.isFinite(ball.spinX) ? ball.spinX : 0;
      ball.spinY = Number.isFinite(ball.spinY) ? ball.spinY : 0;
      ball.spinZ = Number.isFinite(ball.spinZ) ? ball.spinZ : 0;
      if (!ball.motionState) {
        ball.motionState = 'STATIONARY';
      }
    }
  }
}

// ─── Settle detection ─────────────────────────────────────────────────────────

function areBallsSettled(balls: SimBall[]): boolean {
  const activeBalls = balls.filter((b) => !b.isPocketed);
  if (activeBalls.length === 0) {
    return true;
  }
  return activeBalls.every((b) => {
    const linearSpeed = Math.hypot(b.vx, b.vz);
    const angularSpeed = Math.hypot(b.spinX, b.spinY, b.spinZ);
    return (
      linearSpeed <= STATIONARY_LINEAR_THRESHOLD &&
      angularSpeed <= STATIONARY_ANGULAR_THRESHOLD
    );
  });
}

// ─── Main entry point ─────────────────────────────────────────────────────────

/**
 * Run a complete shot simulation and return the full trajectory.
 *
 * @param input.balls   Initial ball positions (all other fields default to zero/STATIONARY)
 * @param input.shot    Shot parameters
 * @param input.maxFrames  Max frames to simulate (default 600 = 30 s)
 */
export function simulateShot(input: SimulateInput): SimulationResult {
  const maxFrames = input.maxFrames ?? 600;

  // Initialise balls
  const balls: SimBall[] = input.balls.map((b) => ({
    id: b.id,
    x: b.x,
    z: b.z,
    vx: 0,
    vz: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    motionState: 'STATIONARY' as BallMotionState,
    isPocketed: false,
  }));

  // Apply shot to cue ball
  const cueBall = balls.find((b) => b.id === 'cueBall');
  if (!cueBall) {
    throw new Error('simulateShot: cueBall not found in input.balls');
  }
  initializeShotOnBall(cueBall, input.shot);

  const frames: TrajectoryFrame[] = [];
  const events: SimEvent[] = [];
  let settledFrames = 0;

  // Record initial state (frame 0)
  frames.push(snapshotBalls(balls));

  for (let frameIndex = 1; frameIndex <= maxFrames; frameIndex += 1) {
    stepPhysics(balls, events, frameIndex);
    frames.push(snapshotBalls(balls));

    if (areBallsSettled(balls)) {
      settledFrames += 1;
      if (settledFrames >= SETTLED_FRAMES_REQUIRED) {
        break;
      }
    } else {
      settledFrames = 0;
    }
  }

  return {
    frames,
    events,
    totalFrames: frames.length,
    totalTimeSec: (frames.length - 1) * PHYSICS_DT_SEC,
  };
}
