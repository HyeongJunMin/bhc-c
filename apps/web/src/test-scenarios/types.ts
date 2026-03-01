import type { SimulationResult } from '@physics-core/standalone-simulator';

export type ScenarioBallPositions = {
  cueBall: { x: number; z: number };
  objectBall1: { x: number; z: number };
  objectBall2: { x: number; z: number };
};

export type ScenarioShotParams = {
  /** Direction in degrees. 0 = +X axis, 90 = +Z axis (server convention). */
  directionDeg: number;
  /** Stroke power in pixels (10–400). */
  dragPx: number;
  /** Side offset of cue tip impact (-BALL_RADIUS ~ +BALL_RADIUS). */
  impactOffsetX: number;
  /** Vertical offset of cue tip impact (-BALL_RADIUS ~ +BALL_RADIUS). */
  impactOffsetY: number;
};

export type TestScenario = {
  id: string;
  name: string;
  description: string;
  balls: ScenarioBallPositions;
  shot: ScenarioShotParams;
  tags: Array<'straight' | 'cushion' | 'spin' | 'ball-ball' | '3-cushion'>;
};

export type BaselineData = {
  version: 1;
  generatedAt: string;
  scenarioId: string;
  frames: SimulationResult['frames'];
  events: SimulationResult['events'];
};
