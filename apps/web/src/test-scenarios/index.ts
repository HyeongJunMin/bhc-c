import type { TestScenario } from './types';
import { straightRight } from './scenarios/straight-right';
import { straightUpCushion } from './scenarios/straight-up-cushion';
import { angle45 } from './scenarios/angle-45';
import { cushionBounce } from './scenarios/cushion-bounce';
import { spinEnglish } from './scenarios/spin-english';
import { uraBackcut } from './scenarios/ura-backcut';
import { hakkuSideangle } from './scenarios/hakku-sideangle';

export const scenarios: TestScenario[] = [
  straightRight,
  straightUpCushion,
  angle45,
  cushionBounce,
  spinEnglish,
  uraBackcut,
  hakkuSideangle,
];

export function getScenario(id: string): TestScenario | undefined {
  return scenarios.find((s) => s.id === id);
}

export type { TestScenario, ScenarioBallPositions, ScenarioShotParams, BaselineData } from './types';
