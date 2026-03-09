import type { StepRoomPhysicsConfig } from '../../../../packages/physics-core/src/room-physics-step.ts';

export const FAH_PHYSICS_TUNING_STORAGE_KEY = 'bhc.fah.physics-tuning.v1';

export type FahPhysicsTuningSample = {
  firstCushionIndexDelta: number | null;
  targetPoint: number;
  observedFirstCushionIndex: number | null;
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
  updatedAt: new Date(0).toISOString(),
  sampleCount: 0,
  speedBoost: 2.0,
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
  const usable = samples.filter((sample) => typeof sample.firstCushionIndexDelta === 'number');
  if (usable.length === 0) {
    return DEFAULT_PROFILE;
  }
  const deltas = usable.map((sample) => sample.firstCushionIndexDelta as number);
  const meanDelta = deltas.reduce((acc, value) => acc + value, 0) / deltas.length;
  const meanAbsDelta = deltas.reduce((acc, value) => acc + Math.abs(value), 0) / deltas.length;

  const correction = clamp(-meanDelta / 40, -0.35, 0.35);
  const spread = clamp(meanAbsDelta / 20, 0, 1);

  const speedBoost = clamp(2.0 + correction * 0.35, 1.7, 2.4);
  const linearDampingPerTick = clamp(0.983 + correction * 0.0015 - spread * 0.0008, 0.981, 0.987);
  const spinDampingPerTick = clamp(0.989 + correction * 0.001 - spread * 0.0006, 0.987, 0.993);
  const cushionRestitution = clamp(0.9 + correction * 0.02 - spread * 0.01, 0.86, 0.94);
  const cushionContactFriction = clamp(0.05 - correction * 0.01 + spread * 0.01, 0.03, 0.09);
  const cushionPostCollisionSpeedScale = clamp(1.0 + correction * 0.004 - spread * 0.004, 0.985, 1.01);
  const clothLinearSpinCouplingPerSec = clamp(1.0 - correction * 0.3 + spread * 0.5, 0.7, 1.8);

  return {
    schemaVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    sampleCount: usable.length,
    speedBoost: round3(speedBoost),
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
