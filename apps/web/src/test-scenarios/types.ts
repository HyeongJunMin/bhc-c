import type { SimResult } from '../../../../packages/physics-core/src/standalone-simulator.ts';
import type { RoomPhysicsProfile } from '../../../../packages/physics-core/src/room-physics-config.ts';

export type ScenarioExpectation = {
  arrivalPosition?: { x: number; y: number; toleranceM: number };
  cushionSequence?: Array<'left' | 'right' | 'top' | 'bottom'>;
  mustHitBalls?: string[];
  minCushionHitsBeforeLastBall?: number;
};

export type TestScenario = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  physicsProfile?: RoomPhysicsProfile;
  balls: Array<{ id: string; x: number; y: number }>;
  shot: {
    cueBallId: string;
    directionDeg: number;
    dragPx: number;
    impactOffsetX: number;
    impactOffsetY: number;
  };
  expected?: ScenarioExpectation;
};

export type BaselineData = {
  version: number;
  scenarioId: string;
  generatedAt: string;
  result: SimResult;
};
