import type { StepRoomPhysicsConfig } from '../../../../packages/physics-core/src/room-physics-step.ts';

export const FAH_PHYSICS_TUNING_STORAGE_KEY = 'bhc.fah.physics-tuning.v1';

export type FahPhysicsTuningSample = {
  firstCushionIndexDelta: number | null;
  secondCushionIndexDelta?: number | null;
  thirdCushionIndexDelta?: number | null;
  fourthCushionIndexDelta?: number | null;
  targetPoint: number;
  observedFirstCushionIndex: number | null;
  observedSecondCushionIndex?: number | null;
  observedThirdCushionIndex?: number | null;
  observedFourthCushionIndex?: number | null;
};

export type FahPhysicsTuningProfile = {
  schemaVersion: '1.0.0';
  updatedAt: string;
  sampleCount: number;
  speedBoost: number;
  pointCorrections: Record<string, number>;
  overrides: Partial<StepRoomPhysicsConfig>;
  stats: {
    meanDelta: number;
    meanAbsDelta: number;
  };
};

const DEFAULT_PROFILE: FahPhysicsTuningProfile = {
  schemaVersion: '1.0.0',
  updatedAt: new Date(0).toISOString(),
  sampleCount: 0,
  speedBoost: 2.0,
  pointCorrections: {},
  overrides: {},
  stats: {
    meanDelta: 0,
    meanAbsDelta: 0,
  },
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

export function readFahPhysicsTuning(raw: string | null): FahPhysicsTuningProfile {
  if (!raw) {
    return DEFAULT_PROFILE;
  }
  try {
    const parsed = JSON.parse(raw) as Partial<FahPhysicsTuningProfile>;
    if (!parsed || typeof parsed !== 'object') {
      return DEFAULT_PROFILE;
    }
    const speedBoost = typeof parsed.speedBoost === 'number' ? parsed.speedBoost : DEFAULT_PROFILE.speedBoost;
    const sampleCount = typeof parsed.sampleCount === 'number' ? parsed.sampleCount : 0;
    const updatedAt = typeof parsed.updatedAt === 'string' ? parsed.updatedAt : new Date(0).toISOString();
    const pointCorrectionsRaw =
      parsed.pointCorrections && typeof parsed.pointCorrections === 'object'
        ? (parsed.pointCorrections as Record<string, unknown>)
        : {};
    const pointCorrections = Object.entries(pointCorrectionsRaw).reduce<Record<string, number>>((acc, [key, value]) => {
      if (typeof value === 'number' && Number.isFinite(value)) {
        acc[key] = round3(value);
      }
      return acc;
    }, {});
    const meanDelta =
      typeof parsed.stats?.meanDelta === 'number' ? parsed.stats.meanDelta : 0;
    const meanAbsDelta =
      typeof parsed.stats?.meanAbsDelta === 'number' ? parsed.stats.meanAbsDelta : 0;
    return {
      schemaVersion: '1.0.0',
      updatedAt,
      sampleCount,
      speedBoost,
      pointCorrections,
      overrides: parsed.overrides && typeof parsed.overrides === 'object' ? parsed.overrides : {},
      stats: {
        meanDelta,
        meanAbsDelta,
      },
    };
  } catch {
    return DEFAULT_PROFILE;
  }
}

export function deriveFahPhysicsTuning(samples: FahPhysicsTuningSample[]): FahPhysicsTuningProfile {
  const usable = samples.filter((sample) => {
    const deltas = [
      sample.firstCushionIndexDelta,
      sample.secondCushionIndexDelta,
      sample.thirdCushionIndexDelta,
      sample.fourthCushionIndexDelta,
    ];
    return deltas.some((value) => typeof value === 'number');
  });
  if (usable.length === 0) {
    return DEFAULT_PROFILE;
  }

  const pointBuckets = new Map<number, Array<{ weightedDelta: number }>>();

  const perSampleSummary = usable.map((sample) => {
    let weightSum = 0;
    let weightedDelta = 0;
    let weightedAbsDelta = 0;
    const add = (value: number | null | undefined, weight: number): void => {
      if (typeof value !== 'number') {
        return;
      }
      weightSum += weight;
      weightedDelta += value * weight;
      weightedAbsDelta += Math.abs(value) * weight;
    };
    add(sample.firstCushionIndexDelta, 1);
    add(sample.secondCushionIndexDelta, 0.9);
    add(sample.thirdCushionIndexDelta, 0.75);
    add(sample.fourthCushionIndexDelta, 0.6);
    if (weightSum <= 0) {
      return null;
    }
    const summary = {
      weightedDelta: weightedDelta / weightSum,
      weightedAbsDelta: weightedAbsDelta / weightSum,
    };
    const point = Math.round(sample.targetPoint);
    const bucket = pointBuckets.get(point) ?? [];
    bucket.push({ weightedDelta: summary.weightedDelta });
    pointBuckets.set(point, bucket);
    return summary;
  }).filter((entry): entry is { weightedDelta: number; weightedAbsDelta: number } => entry !== null);

  if (perSampleSummary.length === 0) {
    return DEFAULT_PROFILE;
  }

  const meanDelta = perSampleSummary.reduce((acc, value) => acc + value.weightedDelta, 0) / perSampleSummary.length;
  const meanAbsDelta = perSampleSummary.reduce((acc, value) => acc + value.weightedAbsDelta, 0) / perSampleSummary.length;

  const correction = clamp(-meanDelta / 40, -0.35, 0.35);
  const spread = clamp(meanAbsDelta / 20, 0, 1);

  const speedBoost = clamp(2.0 + correction * 0.35, 1.7, 2.4);
  const linearDampingPerTick = clamp(0.983 + correction * 0.0015 - spread * 0.0008, 0.981, 0.987);
  const spinDampingPerTick = clamp(0.989 + correction * 0.001 - spread * 0.0006, 0.987, 0.993);
  const cushionRestitution = clamp(0.9 + correction * 0.02 - spread * 0.01, 0.86, 0.94);
  const cushionContactFriction = clamp(0.05 - correction * 0.01 + spread * 0.01, 0.03, 0.09);
  const cushionPostCollisionSpeedScale = clamp(1.0 + correction * 0.004 - spread * 0.004, 0.985, 1.01);
  const clothLinearSpinCouplingPerSec = clamp(1.0 - correction * 0.3 + spread * 0.5, 0.7, 1.8);

  const pointCorrections = Array.from(pointBuckets.entries())
    .sort((a, b) => a[0] - b[0])
    .reduce<Record<string, number>>((acc, [point, bucket]) => {
      if (bucket.length < 3) {
        return acc;
      }
      const avgDelta = bucket.reduce((sum, item) => sum + item.weightedDelta, 0) / bucket.length;
      acc[String(point)] = round3(clamp(-avgDelta, -20, 20));
      return acc;
    }, {});

  return {
    schemaVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    sampleCount: usable.length,
    speedBoost: round3(speedBoost),
    pointCorrections,
    overrides: {
      linearDampingPerTick: round3(linearDampingPerTick),
      spinDampingPerTick: round3(spinDampingPerTick),
      cushionRestitution: round3(cushionRestitution),
      cushionContactFriction: round3(cushionContactFriction),
      cushionPostCollisionSpeedScale: round3(cushionPostCollisionSpeedScale),
      clothLinearSpinCouplingPerSec: round3(clothLinearSpinCouplingPerSec),
    },
    stats: {
      meanDelta: round3(meanDelta),
      meanAbsDelta: round3(meanAbsDelta),
    },
  };
}

export function resolveFahPointCorrection(profile: FahPhysicsTuningProfile, targetPoint: number): number {
  const entries = Object.entries(profile.pointCorrections)
    .map(([point, correction]) => ({ point: Number(point), correction }))
    .filter((item) => Number.isFinite(item.point) && Number.isFinite(item.correction))
    .sort((a, b) => a.point - b.point);
  if (entries.length === 0 || !Number.isFinite(targetPoint)) {
    return 0;
  }

  const clampedTarget = clamp(targetPoint, 0, 110);
  if (clampedTarget <= entries[0].point) {
    return entries[0].correction;
  }
  if (clampedTarget >= entries[entries.length - 1].point) {
    return entries[entries.length - 1].correction;
  }

  for (let i = 0; i < entries.length - 1; i += 1) {
    const left = entries[i];
    const right = entries[i + 1];
    if (clampedTarget >= left.point && clampedTarget <= right.point) {
      const span = right.point - left.point;
      if (span <= 0) {
        return left.correction;
      }
      const t = (clampedTarget - left.point) / span;
      return round3(left.correction + (right.correction - left.correction) * t);
    }
  }
  return 0;
}
