export type FahAnchorPoint = 0 | 10 | 20 | 30 | 40 | 45;

export type FahExpectedGuideline = {
  first: FahAnchorPoint;
  second: number;
  third: number;
  fourth: number;
  fourthRail: 'short' | 'long';
  tolerance: {
    second: number;
    third: number;
    fourth: number;
  };
  note: string;
};

export type FahCalibrationEntry = {
  targetPoint?: number;
  observedSecondCushionIndex?: number | null;
  observedThirdCushionIndex?: number | null;
  observedFourthCushionIndex?: number | null;
};

export type FahResolvedGuideline = {
  guideline: FahExpectedGuideline;
  source: 'learned' | 'interpolated' | 'baseline' | 'locked';
  sampleCount: number;
};

// Blog-derived baseline guide values for top-cam FAH anchors.
// These are target indices for FAH-only tuning and verification.
const FAH_GUIDELINE_BASELINES: readonly FahExpectedGuideline[] = [
  {
    first: 0,
    second: 37,
    third: 50,
    fourth: 20,
    fourthRail: 'short',
    tolerance: { second: 8, third: 8, fourth: 16 },
    note: 'P0 기준: 2쿠션 37 / 3쿠션 50 / 4쿠션 단쿠션 20.',
  },
  {
    first: 10,
    second: 32,
    third: 40,
    fourth: 25,
    fourthRail: 'short',
    tolerance: { second: 6, third: 6, fourth: 14 },
    note: 'P10 기준: 2쿠션 32 / 3쿠션 40 / 4쿠션 단쿠션 25.',
  },
  {
    first: 20,
    second: 27,
    third: 30,
    fourth: 32,
    fourthRail: 'short',
    tolerance: { second: 6, third: 6, fourth: 14 },
    note: 'P20 기준: 2쿠션 27 / 3쿠션 30 / 4쿠션 단쿠션 32.',
  },
  {
    first: 30,
    second: 20,
    third: 20,
    fourth: 40,
    fourthRail: 'short',
    tolerance: { second: 6, third: 6, fourth: 14 },
    note: 'P30 기준: 2쿠션 20 / 3쿠션 20 / 4쿠션 단쿠션 40.',
  },
  {
    first: 40,
    second: 10,
    third: 10,
    fourth: 100,
    fourthRail: 'long',
    tolerance: { second: 8, third: 6, fourth: 16 },
    note: 'P40 기준: 2쿠션 10 / 3쿠션 10 / 4쿠션 장쿠션 100.',
  },
  {
    first: 45,
    second: 5,
    third: 5,
    fourth: 95,
    fourthRail: 'long',
    tolerance: { second: 10, third: 8, fourth: 18 },
    note: 'P45 기준: 2쿠션 5 / 3쿠션 5 / 4쿠션 장쿠션 95.',
  },
] as const;

const BY_POINT = new Map<number, FahExpectedGuideline>(
  FAH_GUIDELINE_BASELINES.map((row) => [row.first, row]),
);
const LOCKED_ANCHOR_POINTS = new Set<number>(FAH_GUIDELINE_BASELINES.map((row) => row.first));

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function getFahGuidelineTable(): readonly FahExpectedGuideline[] {
  return FAH_GUIDELINE_BASELINES;
}

export function getFahGuideline(point: number): FahExpectedGuideline {
  if (BY_POINT.has(point)) {
    return BY_POINT.get(point)!;
  }
  // Safety fallback: interpolate for intermediate points.
  const points = FAH_GUIDELINE_BASELINES.map((row) => row.first);
  const clamped = clamp(point, points[0], points[points.length - 1]);
  let left = FAH_GUIDELINE_BASELINES[0];
  let right = FAH_GUIDELINE_BASELINES[FAH_GUIDELINE_BASELINES.length - 1];
  for (let i = 0; i < FAH_GUIDELINE_BASELINES.length - 1; i += 1) {
    const a = FAH_GUIDELINE_BASELINES[i];
    const b = FAH_GUIDELINE_BASELINES[i + 1];
    if (clamped >= a.first && clamped <= b.first) {
      left = a;
      right = b;
      break;
    }
  }
  const span = right.first - left.first;
  const t = span > 0 ? (clamped - left.first) / span : 0;
  const lerp = (a: number, b: number) => Math.round((a + (b - a) * t) * 1000) / 1000;
  return {
    first: Math.round(clamped) as FahAnchorPoint,
    second: lerp(left.second, right.second),
    third: lerp(left.third, right.third),
    fourth: lerp(left.fourth, right.fourth),
    fourthRail: lerp(left.fourth, right.fourth) <= 40 ? 'short' : 'long',
    tolerance: {
      second: lerp(left.tolerance.second, right.tolerance.second),
      third: lerp(left.tolerance.third, right.tolerance.third),
      fourth: lerp(left.tolerance.fourth, right.tolerance.fourth),
    },
    note: '보간된 가이드라인(중간 포인트).',
  };
}

function asFinite(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function round(value: number): number {
  return Math.round(value * 1000) / 1000;
}

type AggregatedRow = {
  targetPoint: number;
  second: number | null;
  third: number | null;
  fourth: number | null;
  sampleCount: number;
};

function aggregateCalibration(entries: FahCalibrationEntry[]): AggregatedRow[] {
  const buckets = new Map<number, Array<{ second: number | null; third: number | null; fourth: number | null }>>();
  for (const entry of entries) {
    const point = asFinite(entry.targetPoint);
    if (point === null) {
      continue;
    }
    const key = Math.round(point);
    const row = {
      second: asFinite(entry.observedSecondCushionIndex),
      third: asFinite(entry.observedThirdCushionIndex),
      fourth: asFinite(entry.observedFourthCushionIndex),
    };
    const bucket = buckets.get(key) ?? [];
    bucket.push(row);
    buckets.set(key, bucket);
  }

  const avg = (values: Array<number | null>): number | null => {
    const usable = values.filter((v): v is number => v !== null);
    if (usable.length === 0) {
      return null;
    }
    return round(usable.reduce((sum, item) => sum + item, 0) / usable.length);
  };

  return Array.from(buckets.entries())
    .sort((a, b) => a[0] - b[0])
    .map(([targetPoint, rows]) => ({
      targetPoint,
      second: avg(rows.map((row) => row.second)),
      third: avg(rows.map((row) => row.third)),
      fourth: avg(rows.map((row) => row.fourth)),
      sampleCount: rows.length,
    }));
}

function interpolateValue(
  rows: AggregatedRow[],
  point: number,
  field: 'second' | 'third' | 'fourth',
): number | null {
  const exact = rows.find((row) => row.targetPoint === point && row[field] !== null);
  if (exact && exact[field] !== null) {
    return exact[field];
  }
  const leftCandidates = rows.filter((row) => row.targetPoint <= point && row[field] !== null);
  const rightCandidates = rows.filter((row) => row.targetPoint >= point && row[field] !== null);
  const left = leftCandidates[leftCandidates.length - 1] ?? null;
  const right = rightCandidates[0] ?? null;
  if (left && right && left.targetPoint !== right.targetPoint && left[field] !== null && right[field] !== null) {
    const t = (point - left.targetPoint) / (right.targetPoint - left.targetPoint);
    return round(left[field]! + (right[field]! - left[field]!) * t);
  }
  if (left && left[field] !== null) {
    return left[field];
  }
  if (right && right[field] !== null) {
    return right[field];
  }
  return null;
}

export function resolveFahGuidelineFromCalibration(
  entries: FahCalibrationEntry[],
  point: number,
): FahResolvedGuideline {
  const targetPoint = Math.round(clamp(point, 0, 110));
  const baseline = getFahGuideline(point);
  if (LOCKED_ANCHOR_POINTS.has(targetPoint)) {
    return { guideline: baseline, source: 'locked', sampleCount: 0 };
  }
  const aggregated = aggregateCalibration(entries);
  if (aggregated.length === 0) {
    return { guideline: baseline, source: 'baseline', sampleCount: 0 };
  }
  const exact = aggregated.find((row) => row.targetPoint === targetPoint);

  const second = interpolateValue(aggregated, targetPoint, 'second');
  const third = interpolateValue(aggregated, targetPoint, 'third');
  const fourth = interpolateValue(aggregated, targetPoint, 'fourth');
  if (second === null || third === null || fourth === null) {
    return { guideline: baseline, source: 'baseline', sampleCount: exact?.sampleCount ?? 0 };
  }

  const source: FahResolvedGuideline['source'] =
    exact && exact.second !== null && exact.third !== null && exact.fourth !== null ? 'learned' : 'interpolated';

  return {
    guideline: {
      ...baseline,
      first: Math.round(point) as FahAnchorPoint,
      second,
      third,
      fourth,
      note:
        source === 'learned'
          ? '학습(캘리브레이션) 평균값 기반 가이드.'
          : '학습(캘리브레이션) 보간값 기반 가이드.',
    },
    source,
    sampleCount: exact?.sampleCount ?? 0,
  };
}
