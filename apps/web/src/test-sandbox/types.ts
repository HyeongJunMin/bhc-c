import type { SimShotInput } from '@physics-core/standalone-simulator';

export type SandboxBallPositions = {
  cueBall: { x: number; z: number };
  objectBall1: { x: number; z: number };
  objectBall2: { x: number; z: number };
};

export type SandboxInput = {
  balls: SandboxBallPositions;
  shot: SimShotInput;
};

export type SandboxPreset = {
  id: string;
  name: string;
  description: string;
  input: SandboxInput;
};
