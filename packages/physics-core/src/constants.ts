export const TABLE_WIDTH_M = 2.844;
export const TABLE_HEIGHT_M = 1.422;
export const BALL_DIAMETER_M = 0.0615;
export const BALL_RADIUS_M = BALL_DIAMETER_M / 2;
export const BALL_MASS_KG = 0.21;

export const CUSHION_THICKNESS_M = 0.05;
// Base restitution used as the mid-speed reference in speedDependentRestitution.
// At low speeds (~0 m/s) restitution reaches CUSHION_RESTITUTION_LOW;
// at high speeds (>4 m/s) it approaches CUSHION_RESTITUTION_HIGH.
export const CUSHION_RESTITUTION = 0.72;
export const CUSHION_RESTITUTION_LOW = 0.88;
export const CUSHION_RESTITUTION_HIGH = 0.65;
// Mid-point speed (m/s) for the sigmoid transition between low/high restitution.
export const CUSHION_RESTITUTION_MID_SPEED_MPS = 2.0;
// Steepness of the sigmoid curve (higher = sharper transition).
export const CUSHION_RESTITUTION_SIGMOID_K = 1.5;
export const BALL_BALL_RESTITUTION = 0.95;
export const BALL_BALL_CONTACT_FRICTION = 0.05;

export const CUSHION_CONTACT_FRICTION_COEFFICIENT = 0.14;
export const CUSHION_CONTACT_REFERENCE_SPEED_MPS = 5.957692307692308;
// Exponent for contact-time scaling: higher = slower balls get proportionally more throw.
// Lowered from 1.2 to 0.7 to prevent throw divergence at near-zero speeds.
export const CUSHION_CONTACT_TIME_EXPONENT = 0.7;
// Maximum effective spin (m/s) at cushion contact point for full throw scaling.
// Computed as ω × r_contact tangential component; ~3.0 m/s corresponds to strong intentional english (~100 rad/s spinY).
export const CUSHION_MAX_SPIN_MAGNITUDE = 3.0;
// Realistic max throw angle from cushion contact (intentional english at slow speed).
export const CUSHION_MAX_THROW_ANGLE_DEG = 15;
// Hard cap on speedScale to prevent throw divergence at very low post-collision speeds.
// Without this cap, (referenceSpeed / nearZeroSpeed)^exponent grows unboundedly.
export const CUSHION_MAX_SPEED_SCALE = 5.0;
// Scale factor applied to the rolling-spin (spinZ/spinX) contribution in effectiveSpin.
// Reduces throw caused by natural rolling; does not affect intentional english (spinY·d term).
export const CUSHION_ROLLING_SPIN_HEIGHT_FACTOR = 0.1;
// Friction-driven damping factor applied to the rolling spin axis parallel to the cushion face.
// Each cushion contact dissipates a fraction of rolling spin via contact friction.
// (x-axis cushion → spinZ damped; z-axis cushion → spinX damped)
export const CUSHION_FRICTION_SPIN_DAMPING = 0.12;
// Damping factor for angular impulse (torque) transferred to the ball during cushion contact.
// Real cushion rubber absorbs energy during deformation, reducing torque transmission.
// Value < 1.0 prevents unrealistic spinX spikes from contact height geometry.
export const CUSHION_TORQUE_DAMPING = 0.35;
export const CUSHION_HEIGHT_M = 0.037;

export const SLIDING_FRICTION_COEFFICIENT = 0.2;
export const ROLLING_FRICTION_COEFFICIENT = 0.012;
export const GRAVITY_ACCELERATION_MPS2 = 9.81;
export const SLIP_SPEED_THRESHOLD_MPS = 0.01;

export const MAX_BALL_SPEED_MPS = 13.89;
export const STATIONARY_LINEAR_SPEED_THRESHOLD_MPS = 0.01;
export const STATIONARY_ANGULAR_SPEED_THRESHOLD_RADPS = 0.2;
export const PENETRATION_SLOP_M = 5e-5;
export const POSITION_CORRECTION_SCALE = 1.2;
