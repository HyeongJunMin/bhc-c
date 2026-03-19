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
  overrides: Partial<StepRoomPhysicsConfig>;
  stats: {
    meanDelta: number;
    meanAbsDelta: number;
  };
};

const DEFAULT_PROFILE: FahPhysicsTuningProfile = {
  schemaVersion: '1.0.0',
  updatedAt: '2026-03-12T00:00:00.000Z',
  sampleCount: 0,
  speedBoost: 1.0,
  overrides: {
    cushionRestitution: 0.89,
    cushionContactFriction: 0.055,
    cushionSpinMonotonicRetention: 0.93,
  },
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
    const meanDelta =
      typeof parsed.stats?.meanDelta === 'number' ? parsed.stats.meanDelta : 0;
    const meanAbsDelta =
      typeof parsed.stats?.meanAbsDelta === 'number' ? parsed.stats.meanAbsDelta : 0;
    return {
      schemaVersion: '1.0.0',
      updatedAt,
      sampleCount,
      speedBoost,
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
  const cushionRestitution = clamp(0.9 + correction * 0.02 - spread * 0.01, 0.86, 0.94);
  const cushionContactFriction = clamp(0.05 - correction * 0.01 + spread * 0.01, 0.03, 0.09);

  return {
    schemaVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    sampleCount: usable.length,
    speedBoost: round3(speedBoost),
    overrides: {
      cushionRestitution: round3(cushionRestitution),
      cushionContactFriction: round3(cushionContactFriction),
    },
    stats: {
      meanDelta: round3(meanDelta),
      meanAbsDelta: round3(meanAbsDelta),
    },
  };
}
