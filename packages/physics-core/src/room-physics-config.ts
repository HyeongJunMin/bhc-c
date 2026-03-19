import type { StepRoomPhysicsConfig } from './room-physics-step.ts';
import { TABLE_GEOMETRY } from '../../shared-types/src/table-geometry.ts';

export const ROOM_SNAPSHOT_BROADCAST_INTERVAL_MS = 50;
export const ROOM_PHYSICS_SUBSTEPS = 12;
export const ROOM_PHYSICS_TABLE_WIDTH_M = TABLE_GEOMETRY.tableInnerWidthM;
export const ROOM_PHYSICS_TABLE_HEIGHT_M = TABLE_GEOMETRY.tableInnerHeightM;
export const ROOM_PHYSICS_BALL_RADIUS_M = TABLE_GEOMETRY.ballRadiusM;
export const ROOM_PHYSICS_COLLISION_PLANE_OFFSET_M = TABLE_GEOMETRY.effectiveCollisionPlaneOffsetM;
export const ROOM_PHYSICS_SHOT_END_LINEAR_SPEED_THRESHOLD_MPS = 0.01;
export const ROOM_PHYSICS_MAX_BALL_SPEED_MPS = 13.89;
export const ROOM_PHYSICS_BALL_BALL_RESTITUTION = 0.95;
export const ROOM_PHYSICS_BALL_MASS_KG = 0.21;
export const ROOM_PHYSICS_CUSHION_RESTITUTION = 0.72;
export const ROOM_PHYSICS_CUSHION_CONTACT_FRICTION = 0.14;
export const ROOM_PHYSICS_CUSHION_REFERENCE_SPEED_MPS = 5.957692307692308;
export const ROOM_PHYSICS_CUSHION_CONTACT_TIME_EXPONENT = 0.7;
export const ROOM_PHYSICS_CUSHION_MAX_SPIN_MAGNITUDE = 3.0;
export const ROOM_PHYSICS_CUSHION_MAX_THROW_ANGLE_DEG = 25;
export const ROOM_PHYSICS_RECOVERY_FALLBACK_ENABLED = true;
export const ROOM_PHYSICS_MAX_SUBSTEP_ENERGY_GAIN_J = 0.03;
export const ROOM_PHYSICS_CUSHION_SPIN_MONOTONIC_ENABLED = false;
export const ROOM_PHYSICS_CUSHION_SPIN_MONOTONIC_RETENTION = 1.0;
// Cushion contact throw geometry
export const ROOM_PHYSICS_CUSHION_HEIGHT_M = 0.037;
export const ROOM_PHYSICS_CUSHION_ROLLING_SPIN_HEIGHT_FACTOR = 0.1;
export const ROOM_PHYSICS_CUSHION_TORQUE_DAMPING = 0.35;
export const ROOM_PHYSICS_CUSHION_MAX_SPEED_SCALE = 5.0;
export const ROOM_PHYSICS_CUSHION_FRICTION_SPIN_DAMPING = 0.80;
// Sigmoid speed-dependent cushion restitution
export const ROOM_PHYSICS_CUSHION_RESTITUTION_LOW = 0.88;
export const ROOM_PHYSICS_CUSHION_RESTITUTION_HIGH = 0.65;
export const ROOM_PHYSICS_CUSHION_RESTITUTION_MID_SPEED_MPS = 2.0;
export const ROOM_PHYSICS_CUSHION_RESTITUTION_SIGMOID_K = 1.5;
// Ball-ball contact friction for spin transfer
export const ROOM_PHYSICS_BALL_BALL_CONTACT_FRICTION = 0.05;
// State machine friction constants
export const ROOM_PHYSICS_SLIDING_FRICTION = 0.2;
export const ROOM_PHYSICS_ROLLING_FRICTION = 0.012;
export const ROOM_PHYSICS_GRAVITY_MPS2 = 9.81;
export type RoomPhysicsProfile = 'default' | 'fahTest';

export const FAH_TEST_ROOM_PHYSICS_OVERRIDES: Partial<StepRoomPhysicsConfig> = {
  linearDampingPerTick: 0.983,
  spinDampingPerTick: 0.989,
  cushionRestitution: 0.9,
  cushionContactFriction: 0.05,
  cushionPostCollisionSpeedScale: 1.0,
  clothLinearSpinCouplingPerSec: 1.0,
  cushionSpinMonotonicEnabled: true,
  cushionSpinMonotonicRetention: 0.92,
  cushionRestitutionLow: ROOM_PHYSICS_CUSHION_RESTITUTION_LOW,
  cushionRestitutionHigh: ROOM_PHYSICS_CUSHION_RESTITUTION_HIGH,
  cushionRestitutionMidSpeedMps: ROOM_PHYSICS_CUSHION_RESTITUTION_MID_SPEED_MPS,
  cushionRestitutionSigmoidK: ROOM_PHYSICS_CUSHION_RESTITUTION_SIGMOID_K,
};

export function createRoomPhysicsStepConfig(
  profile: RoomPhysicsProfile = 'default',
  overrides?: Partial<StepRoomPhysicsConfig>,
): StepRoomPhysicsConfig {
  const baseConfig: StepRoomPhysicsConfig = {
    dtSec: ROOM_SNAPSHOT_BROADCAST_INTERVAL_MS / 1000,
    substeps: ROOM_PHYSICS_SUBSTEPS,
    tableWidthM: ROOM_PHYSICS_TABLE_WIDTH_M,
    tableHeightM: ROOM_PHYSICS_TABLE_HEIGHT_M,
    ballRadiusM: ROOM_PHYSICS_BALL_RADIUS_M,
    shotEndLinearSpeedThresholdMps: ROOM_PHYSICS_SHOT_END_LINEAR_SPEED_THRESHOLD_MPS,
    maxBallSpeedMps: ROOM_PHYSICS_MAX_BALL_SPEED_MPS,
    ballBallRestitution: ROOM_PHYSICS_BALL_BALL_RESTITUTION,
    ballMassKg: ROOM_PHYSICS_BALL_MASS_KG,
    cushionRestitution: ROOM_PHYSICS_CUSHION_RESTITUTION,
    cushionContactFriction: ROOM_PHYSICS_CUSHION_CONTACT_FRICTION,
    cushionReferenceSpeedMps: ROOM_PHYSICS_CUSHION_REFERENCE_SPEED_MPS,
    cushionContactTimeExponent: ROOM_PHYSICS_CUSHION_CONTACT_TIME_EXPONENT,
    cushionMaxSpinMagnitude: ROOM_PHYSICS_CUSHION_MAX_SPIN_MAGNITUDE,
    cushionMaxThrowAngleDeg: ROOM_PHYSICS_CUSHION_MAX_THROW_ANGLE_DEG,
    cushionHeightM: ROOM_PHYSICS_CUSHION_HEIGHT_M,
    cushionRollingSpinHeightFactor: ROOM_PHYSICS_CUSHION_ROLLING_SPIN_HEIGHT_FACTOR,
    cushionTorqueDamping: ROOM_PHYSICS_CUSHION_TORQUE_DAMPING,
    cushionMaxSpeedScale: ROOM_PHYSICS_CUSHION_MAX_SPEED_SCALE,
    cushionFrictionSpinDamping: ROOM_PHYSICS_CUSHION_FRICTION_SPIN_DAMPING,
    recoveryFallbackEnabled: ROOM_PHYSICS_RECOVERY_FALLBACK_ENABLED,
    maxSubstepEnergyGainJ: ROOM_PHYSICS_MAX_SUBSTEP_ENERGY_GAIN_J,
    cushionSpinMonotonicEnabled: ROOM_PHYSICS_CUSHION_SPIN_MONOTONIC_ENABLED,
    cushionSpinMonotonicRetention: ROOM_PHYSICS_CUSHION_SPIN_MONOTONIC_RETENTION,
    cushionRestitutionLow: ROOM_PHYSICS_CUSHION_RESTITUTION_LOW,
    cushionRestitutionHigh: ROOM_PHYSICS_CUSHION_RESTITUTION_HIGH,
    cushionRestitutionMidSpeedMps: ROOM_PHYSICS_CUSHION_RESTITUTION_MID_SPEED_MPS,
    cushionRestitutionSigmoidK: ROOM_PHYSICS_CUSHION_RESTITUTION_SIGMOID_K,
    ballBallContactFriction: ROOM_PHYSICS_BALL_BALL_CONTACT_FRICTION,
    slidingFriction: ROOM_PHYSICS_SLIDING_FRICTION,
    rollingFriction: ROOM_PHYSICS_ROLLING_FRICTION,
    gravityMps2: ROOM_PHYSICS_GRAVITY_MPS2,
  };
  const profileOverrides = profile === 'fahTest' ? FAH_TEST_ROOM_PHYSICS_OVERRIDES : undefined;
  return {
    ...baseConfig,
    ...(profileOverrides ?? {}),
    ...(overrides ?? {}),
  };
}
