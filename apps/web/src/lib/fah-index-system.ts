const FAH_FRAME_VERSION = 'fah-frame-v3-rail-fixed';

export type FahRailSide = 'left' | 'right';
export type FahCushionSide = 'left' | 'right' | 'top' | 'bottom';

export type FahCushionHit = {
  index: number;
  side: FahRailSide;
};

export type FahIndexModel = {
  frameVersion: string;
  startIndex: number;
  firstCushionIndex: number;
  expectedSecondIndex: number;
  expectedThirdIndex: number;
  expectedFourthIndex: number;
  startSide: FahRailSide;
  firstCushionSide: FahRailSide;
  thirdCushionSide: FahRailSide;
  fourthCushionSide: FahRailSide;
};

type PointConversionInput = {
  x: number;
  z: number;
};

const FAH_LONG_RAIL_INDEX_POINTS = [0, 10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110] as const;
const LONG_MIN_INDEX = 0;
const LONG_MAX_INDEX = 110;
const SHORT_MIN_INDEX = 0;
const SHORT_MAX_INDEX = 40;

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function getFahIndexScalePoints(): readonly number[] {
  return FAH_LONG_RAIL_INDEX_POINTS;
}

export function quantizeFahIndexToNearestHalfStep(
  index: number,
  points: readonly number[] = FAH_LONG_RAIL_INDEX_POINTS,
): number {
  const max = points[points.length - 1] ?? LONG_MAX_INDEX;
  const clamped = clamp(index, 0, max);
  // 1 unit == 1/10 point
  return Math.round(clamped);
}

export function getFahScaleHalfSteps(points: readonly number[]): number[] {
  const values: number[] = [];
  for (let i = 0; i < points.length - 1; i += 1) {
    const a = points[i];
    const b = points[i + 1];
    values.push(a);
    values.push((a + b) / 2);
  }
  values.push(points[points.length - 1]);
  return values;
}

export function getFahHalfStepScalePoints(points: readonly number[] = FAH_LONG_RAIL_INDEX_POINTS): number[] {
  return getFahScaleHalfSteps(points);
}

export function mapFahRailRatioToIndex(
  ratio: number,
  points: readonly number[] = FAH_LONG_RAIL_INDEX_POINTS,
): number {
  const max = points[points.length - 1] ?? LONG_MAX_INDEX;
  return round3(clamp(ratio, 0, 1) * max);
}

export function mapFahIndexToRailRatio(
  index: number,
  points: readonly number[] = FAH_LONG_RAIL_INDEX_POINTS,
): number {
  const max = points[points.length - 1] ?? LONG_MAX_INDEX;
  return clamp(index, 0, max) / max;
}

export function mapFahCushionContactToIndex(
  cushion: FahCushionSide,
  contact: PointConversionInput,
  tableWidth: number,
  tableHeight: number,
  points: readonly number[] = FAH_LONG_RAIL_INDEX_POINTS,
): number {
  const { x, z } = contact;
  if (cushion === 'top' || cushion === 'bottom') {
    const leftRailX = -tableWidth / 2;
    const rightRailX = tableWidth / 2;
    const ratio = clamp((x - leftRailX) / (rightRailX - leftRailX), 0, 1);
    const index = ratio * SHORT_MAX_INDEX;
    return Math.round(clamp(index, SHORT_MIN_INDEX, SHORT_MAX_INDEX));
  }
  const topRailZ = tableHeight / 2;
  const bottomRailZ = -tableHeight / 2;
  const ratio = clamp((topRailZ - z) / (topRailZ - bottomRailZ), 0, 1);
  const max = points[points.length - 1] ?? LONG_MAX_INDEX;
  const index = ratio * max;
  return Math.round(clamp(index, LONG_MIN_INDEX, LONG_MAX_INDEX));
}

export function buildFahExpectedCushionSequence(startIndex: number, firstCushionIndex: number): {
  expectedSecondIndex: number;
  expectedThirdIndex: number;
  expectedFourthIndex: number;
} {
  const start = quantizeFahIndexToNearestHalfStep(startIndex);
  const first = quantizeFahIndexToNearestHalfStep(firstCushionIndex);
  return {
    expectedSecondIndex: first,
    expectedThirdIndex: quantizeFahIndexToNearestHalfStep(start - first),
    expectedFourthIndex: quantizeFahIndexToNearestHalfStep(2 * start - 2 * first),
  };
}

export function inferFahStartSide(cueX: number): FahRailSide {
  return cueX <= 0 ? 'left' : 'right';
}

export function buildFahIndexModel(startIndex: number, firstCushionIndex: number, startSide: FahRailSide): FahIndexModel {
  const start = quantizeFahIndexToNearestHalfStep(startIndex);
  const first = quantizeFahIndexToNearestHalfStep(firstCushionIndex);
  const { expectedSecondIndex, expectedThirdIndex, expectedFourthIndex } = buildFahExpectedCushionSequence(start, first);
  return {
    frameVersion: FAH_FRAME_VERSION,
    startIndex: start,
    firstCushionIndex: first,
    expectedSecondIndex,
    expectedThirdIndex,
    expectedFourthIndex,
    startSide,
    firstCushionSide: startSide === 'left' ? 'right' : 'left',
    thirdCushionSide: startSide,
    fourthCushionSide: startSide === 'left' ? 'right' : 'left',
  };
}
