import type { PhysicsBallState } from '../room-physics-step.ts';

export type Vec2 = {
  x: number;
  y: number;
};

export type Vec3 = {
  x: number;
  y: number;
  z: number;
};

export type RigidBallState = {
  id: string;
  p: Vec2;
  v: Vec2;
  w: Vec3;
  isPocketed: boolean;
};

export type RigidBallParams = {
  massKg: number;
  radiusM: number;
  inertiaKgM2: number;
};

function cloneVec2(vec: Vec2): Vec2 {
  return { x: vec.x, y: vec.y };
}

function cloneVec3(vec: Vec3): Vec3 {
  return { x: vec.x, y: vec.y, z: vec.z };
}

export function cloneRigidBallState(state: RigidBallState): RigidBallState {
  return {
    id: state.id,
    p: cloneVec2(state.p),
    v: cloneVec2(state.v),
    w: cloneVec3(state.w),
    isPocketed: state.isPocketed,
  };
}

export function toRigidBallState(ball: PhysicsBallState): RigidBallState {
  return {
    id: ball.id,
    p: { x: ball.x, y: ball.y },
    v: { x: ball.vx, y: ball.vy },
    w: { x: ball.spinX, y: ball.spinY, z: ball.spinZ },
    isPocketed: ball.isPocketed,
  };
}

export function fromRigidBallState(state: RigidBallState): PhysicsBallState {
  return {
    id: state.id,
    x: state.p.x,
    y: state.p.y,
    vx: state.v.x,
    vy: state.v.y,
    spinX: state.w.x,
    spinY: state.w.y,
    spinZ: state.w.z,
    isPocketed: state.isPocketed,
  };
}

export function applyRigidBallState(target: PhysicsBallState, source: RigidBallState): void {
  target.id = source.id;
  target.x = source.p.x;
  target.y = source.p.y;
  target.vx = source.v.x;
  target.vy = source.v.y;
  target.spinX = source.w.x;
  target.spinY = source.w.y;
  target.spinZ = source.w.z;
  target.isPocketed = source.isPocketed;
}

export function mapPhysicsBallsToRigidStates(balls: PhysicsBallState[]): RigidBallState[] {
  return balls.map(toRigidBallState);
}

export function mapRigidStatesToPhysicsBalls(states: RigidBallState[]): PhysicsBallState[] {
  return states.map(fromRigidBallState);
}
