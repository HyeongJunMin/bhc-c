import type { TestScenario } from './types.ts';
import straightRight from './scenarios/straight-right.ts';
import straightUpCushion from './scenarios/straight-up-cushion.ts';
import angle45 from './scenarios/angle-45.ts';
import cushionBounce from './scenarios/cushion-bounce.ts';
import spinEnglish from './scenarios/spin-english.ts';
import uraBackcut from './scenarios/ura-backcut.ts';
import hakkuSideangle from './scenarios/hakku-sideangle.ts';

export const ALL_SCENARIOS: TestScenario[] = [
  straightRight,
  straightUpCushion,
  angle45,
  cushionBounce,
  spinEnglish,
  uraBackcut,
  hakkuSideangle,
];

export function getScenario(id: string): TestScenario | undefined {
  return ALL_SCENARIOS.find((s) => s.id === id);
}
