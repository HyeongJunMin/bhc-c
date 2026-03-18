import type { TestScenario } from './types.ts';
import fahPos10 from './scenarios/fah-pos10.ts';
import fahPos20 from './scenarios/fah-pos20.ts';
import fahPos30 from './scenarios/fah-pos30.ts';
import fahPos40 from './scenarios/fah-pos40.ts';
import fahPos50 from './scenarios/fah-pos50.ts';
import uraBackcut from './scenarios/ura-backcut.ts';
import apDolligi from './scenarios/ap-dolligi.ts';
import dwiDolligi from './scenarios/dwi-dolligi.ts';
import yeopDolligi from './scenarios/yeop-dolligi.ts';
import daeHoejeon from './scenarios/dae-hoejeon.ts';
import doeDoraoogi from './scenarios/doe-doraoogi.ts';

export const ALL_SCENARIOS: TestScenario[] = [
  fahPos10,
  fahPos20,
  fahPos30,
  fahPos40,
  fahPos50,
  uraBackcut,
  apDolligi,
  dwiDolligi,
  yeopDolligi,
  daeHoejeon,
  doeDoraoogi,
];

export function getScenario(id: string): TestScenario | undefined {
  return ALL_SCENARIOS.find((s) => s.id === id);
}
