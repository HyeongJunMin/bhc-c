const FAH_FRAME_VERSION = 'fah-frame-v2-piecewise';

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

const FAH_DIAMOND_INDEX_POINTS = [0, 10, 20, 30, 40, 50, 70, 90, 110] as const;
const MIN_INDEX = FAH_DIAMOND_INDEX_POINTS[0];
const MAX_INDEX = FAH_DIAMOND_INDEX_POINTS[FAH_DIAMOND_INDEX_POINTS.length - 1];

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function getFahIndexScalePoints(): readonly number[] {
  return FAH_DIAMOND_INDEX_POINTS;
}

export function quantizeFahIndexToNearestHalfStep(index: number, points: readonly number[] = FAH_DIAMOND_INDEX_POINTS): number {
  const clamped = clamp(index, MIN_INDEX, MAX_INDEX);
  const candidates = getFahHalfStepScalePoints(points);
  let best = candidates[0];
  let bestDiff = Math.abs(clamped - best);
  for (let i = 1; i < candidates.length; i += 1) {
    const diff = Math.abs(clamped - candidates[i]);
    if (diff < bestDiff) {
      best = candidates[i];
      bestDiff = diff;
    }
  }
  return round3(best);
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

export function getFahHalfStepScalePoints(points: readonly number[] = FAH_DIAMOND_INDEX_POINTS): number[] {
  return getFahScaleHalfSteps(points);
}

export function mapFahRailRatioToIndex(ratio: number, points: readonly number[] = FAH_DIAMOND_INDEX_POINTS): number {
  const clampedRatio = clamp(ratio, 0, 1);
  const segmentCount = points.length - 1;
  const scaled = clampedRatio * segmentCount;
  const leftSegment = Math.floor(clamp(scaled, 0, segmentCount - 1));
  const t = scaled - leftSegment;
  const left = points[leftSegment];
  const right = points[leftSegment + 1];
  return round3(left + (right - left) * t);
}

export function mapFahIndexToRailRatio(index: number, points: readonly number[] = FAH_DIAMOND_INDEX_POINTS): number {
  const clamped = clamp(index, MIN_INDEX, MAX_INDEX);
  for (let i = 0; i < points.length - 1; i += 1) {
    const left = points[i];
    const right = points[i + 1];
    if (clamped >= left && clamped <= right) {
      const local = right === left ? 0 : (clamped - left) / (right - left);
      return (i + local) / (points.length - 1);
    }
  }
  return clamped <= MIN_INDEX ? 0 : 1;
}

export function mapFahCushionContactToIndex(
  cushion: FahCushionSide,
  contact: PointConversionInput,
  tableWidth: number,
  tableHeight: number,
  points: readonly number[] = FAH_DIAMOND_INDEX_POINTS,
): number {
  const { x, z } = contact;
  if (cushion === 'top' || cushion === 'bottom') {
    const topRailX = tableWidth / 2;
    const bottomRailX = -tableWidth / 2;
    const ratio = clamp((topRailX - x) / (topRailX - bottomRailX), 0, 1);
    return quantizeFahIndexToNearestHalfStep(mapFahRailRatioToIndex(ratio, points), points);
  }
  const topRailZ = tableHeight / 2;
  const bottomRailZ = -tableHeight / 2;
  const ratio = clamp((topRailZ - z) / (topRailZ - bottomRailZ), 0, 1);
  return quantizeFahIndexToNearestHalfStep(mapFahRailRatioToIndex(ratio, points), points);
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

export function inferFahStartSide(cueZ: number): FahRailSide {
  return cueZ <= 0 ? 'left' : 'right';
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
