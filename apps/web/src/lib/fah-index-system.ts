const FAH_DIAMOND_INDEX_POINTS = [0, 10, 20, 30, 40, 50, 70, 90, 110] as const;
const FAH_FRAME_VERSION = 'fah-frame-v2-piecewise';

export type FahRailSide = 'left' | 'right';

export type FahIndexModel = {
  frameVersion: string;
  startIndex: number;
  firstCushionIndex: number;
  expectedThirdIndex: number;
  startSide: FahRailSide;
  firstCushionSide: FahRailSide;
  thirdCushionSide: FahRailSide;
};

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

export function getFahHalfStepScalePoints(): number[] {
  const values: number[] = [];
  for (let i = 0; i < FAH_DIAMOND_INDEX_POINTS.length - 1; i += 1) {
    const a = FAH_DIAMOND_INDEX_POINTS[i];
    const b = FAH_DIAMOND_INDEX_POINTS[i + 1];
    values.push(a);
    values.push((a + b) / 2);
  }
  values.push(FAH_DIAMOND_INDEX_POINTS[FAH_DIAMOND_INDEX_POINTS.length - 1]);
  return values;
}

export function quantizeFahIndexToNearestHalfStep(index: number): number {
  const clamped = clamp(index, MIN_INDEX, MAX_INDEX);
  const candidates = getFahHalfStepScalePoints();
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

export function mapFahRailRatioToIndex(ratio: number): number {
  const clampedRatio = clamp(ratio, 0, 1);
  const segmentCount = FAH_DIAMOND_INDEX_POINTS.length - 1;
  const scaled = clampedRatio * segmentCount;
  const leftSegment = Math.floor(clamp(scaled, 0, segmentCount - 1));
  const t = scaled - leftSegment;
  const left = FAH_DIAMOND_INDEX_POINTS[leftSegment];
  const right = FAH_DIAMOND_INDEX_POINTS[leftSegment + 1];
  return round3(left + (right - left) * t);
}

export function mapFahIndexToRailRatio(index: number): number {
  const clamped = clamp(index, MIN_INDEX, MAX_INDEX);
  for (let i = 0; i < FAH_DIAMOND_INDEX_POINTS.length - 1; i += 1) {
    const left = FAH_DIAMOND_INDEX_POINTS[i];
    const right = FAH_DIAMOND_INDEX_POINTS[i + 1];
    if (clamped >= left && clamped <= right) {
      const local = right === left ? 0 : (clamped - left) / (right - left);
      return (i + local) / (FAH_DIAMOND_INDEX_POINTS.length - 1);
    }
  }
  return clamped <= MIN_INDEX ? 0 : 1;
}

export function inferFahStartSide(cueZ: number): FahRailSide {
  return cueZ <= 0 ? 'left' : 'right';
}

export function buildFahIndexModel(startIndex: number, firstCushionIndex: number, startSide: FahRailSide): FahIndexModel {
  const start = quantizeFahIndexToNearestHalfStep(startIndex);
  const first = quantizeFahIndexToNearestHalfStep(firstCushionIndex);
  const expectedThird = quantizeFahIndexToNearestHalfStep(start - first);
  return {
    frameVersion: FAH_FRAME_VERSION,
    startIndex: start,
    firstCushionIndex: first,
    expectedThirdIndex: expectedThird,
    startSide,
    firstCushionSide: startSide === 'left' ? 'right' : 'left',
    thirdCushionSide: startSide,
  };
}
