import type { SimResult } from '../../../../packages/physics-core/src/standalone-simulator.ts';

export type TestScenario = {
  id: string;
  name: string;
  description: string;
  tags: string[];
  balls: Array<{ id: string; x: number; y: number }>;
  shot: {
    cueBallId: string;
    directionDeg: number;
    dragPx: number;
    impactOffsetX: number;
    impactOffsetY: number;
  };
};

export type BaselineData = {
  version: number;
  scenarioId: string;
  generatedAt: string;
  result: SimResult;
};
