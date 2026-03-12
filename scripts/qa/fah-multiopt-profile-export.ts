import { readFileSync, readdirSync, statSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, isAbsolute, join, resolve } from 'node:path';

type NumberRecord = Record<string, number>;

type CandidateOverrides = {
  speedBoost: number;
  cushionRestitution: number;
  cushionContactFriction: number;
  clothLinearSpinCouplingPerSec: number;
  spinDampingPerTick: number;
  linearDampingPerTick: number;
  cushionPostCollisionSpeedScale: number;
  cushionSpinMonotonicRetention: number;
};

type CandidateRow = {
  overrides?: Partial<CandidateOverrides>;
  byPoint?: Array<{ error?: { second?: number; third?: number; fourth?: number } }>;
  byPointCorrected?: Array<{ error?: { second?: number; third?: number; fourth?: number } }>;
  pointCorrections?: NumberRecord;
};

type MultiCushionSummary = {
  runId?: string;
  best?: CandidateRow;
  top?: CandidateRow[];
};

type FahPhysicsTuningProfile = {
  schemaVersion: '1.0.0';
  updatedAt: string;
  sampleCount: number;
  speedBoost: number;
  pointCorrections: NumberRecord;
  overrides: Partial<CandidateOverrides>;
  stats: {
    meanDelta: number;
    meanAbsDelta: number;
  };
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function normalizePoint(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function toCandidateOverrides(raw: Record<string, unknown> | undefined): CandidateOverrides | null {
  if (!raw) {
    return null;
  }
  const speedBoost = normalizePoint(raw.speedBoost);
  const cushionRestitution = normalizePoint(raw.cushionRestitution);
  const cushionContactFriction = normalizePoint(raw.cushionContactFriction);
  const clothLinearSpinCouplingPerSec = normalizePoint(raw.clothLinearSpinCouplingPerSec);
  const spinDampingPerTick = normalizePoint(raw.spinDampingPerTick);
  const linearDampingPerTick = normalizePoint(raw.linearDampingPerTick);
  const cushionPostCollisionSpeedScale = normalizePoint(raw.cushionPostCollisionSpeedScale);
  const cushionSpinMonotonicRetention = normalizePoint(raw.cushionSpinMonotonicRetention);
  if (
    speedBoost === null ||
    cushionRestitution === null ||
    cushionContactFriction === null ||
    clothLinearSpinCouplingPerSec === null ||
    spinDampingPerTick === null ||
    linearDampingPerTick === null ||
    cushionPostCollisionSpeedScale === null ||
    cushionSpinMonotonicRetention === null
  ) {
    return null;
  }
  return {
    speedBoost,
    cushionRestitution,
    cushionContactFriction,
    clothLinearSpinCouplingPerSec,
    spinDampingPerTick,
    linearDampingPerTick,
    cushionPostCollisionSpeedScale,
    cushionSpinMonotonicRetention,
  };
}

function normalizePointCorrections(raw: unknown): NumberRecord {
  if (!raw || typeof raw !== 'object') {
    return {};
  }
  return Object.entries(raw).reduce<NumberRecord>((acc, [key, value]) => {
    const point = normalizePoint(Number(key));
    const correction = normalizePoint(value);
    if (point === null || correction === null) {
      return acc;
    }
    acc[String(round3(point))] = round3(correction);
    return acc;
  }, {});
}

function collectErrors(row: CandidateRow | undefined): number[] {
  const sourceRows = row?.byPointCorrected?.length ? row.byPointCorrected : (row?.byPoint ?? []);
  const errors: number[] = [];
  for (const point of sourceRows) {
    const error = point.error ?? {};
    const s = normalizePoint(error.second);
    const t = normalizePoint(error.third);
    const f = normalizePoint(error.fourth);
    if (s !== null) {
      errors.push(s);
    }
    if (t !== null) {
      errors.push(t);
    }
    if (f !== null) {
      errors.push(f);
    }
  }
  return errors;
}

function pickBest(summary: MultiCushionSummary): CandidateRow | null {
  if (summary.best && typeof summary.best === 'object') {
    return summary.best;
  }
  if (!Array.isArray(summary.top) || summary.top.length === 0) {
    return null;
  }
  const ranked = summary.top
    .filter((row): row is CandidateRow & { rank?: number } => !!row)
    .sort((a, b) => (a.rank ?? Number.MAX_VALUE) - (b.rank ?? Number.MAX_VALUE));
  return ranked[0] ?? null;
}

function parseSummary(raw: string): MultiCushionSummary {
  const parsed = JSON.parse(raw) as MultiCushionSummary;
  if (!parsed || typeof parsed !== 'object') {
    throw new Error('요약 JSON 형식이 올바르지 않습니다.');
  }
  return parsed;
}

function resolveSummaryFilePath(): string {
  const configured = process.env.FAH_MULTI_SOURCE;
  if (configured) {
    return resolve(process.cwd(), configured);
  }
  const candidateDir = resolve(process.cwd(), 'tmp', 'fah');
  const files = readdirSync(candidateDir)
    .filter((name) => name.endsWith('.multi-cushion-opt.summary.json'))
    .map((name) => join(candidateDir, name))
    .filter((file) => file.endsWith('.summary.json'));
  if (files.length === 0) {
    throw new Error('요약 파일이 없습니다. FAH_MULTI_SOURCE를 지정해 주세요.');
  }
  files.sort((left, right) => {
    const leftStat = statSync(left);
    const rightStat = statSync(right);
    return rightStat.mtimeMs - leftStat.mtimeMs;
  });
  return files[0];
}

function buildProfile(summary: MultiCushionSummary): FahPhysicsTuningProfile {
  const selected = pickBest(summary);
  if (!selected) {
    throw new Error('summary에 best/top 결과가 없습니다.');
  }
  const overrides = toCandidateOverrides(selected.overrides as Record<string, unknown>) ?? {
    speedBoost: 2,
    cushionRestitution: 0.9,
    cushionContactFriction: 0.05,
    clothLinearSpinCouplingPerSec: 1,
    spinDampingPerTick: 0.989,
    linearDampingPerTick: 0.983,
    cushionPostCollisionSpeedScale: 1,
    cushionSpinMonotonicRetention: 0.92,
  };
  const errors = collectErrors(selected);
  const total = errors.length > 0 ? errors.length : 1;
  const meanDelta = round3(errors.reduce((sum, v) => sum + v, 0) / total);
  const meanAbsDelta = round3(errors.reduce((sum, v) => sum + Math.abs(v), 0) / total);

  return {
    schemaVersion: '1.0.0',
    updatedAt: new Date().toISOString(),
    sampleCount: errors.length,
    speedBoost: overrides.speedBoost,
    pointCorrections: normalizePointCorrections(selected.pointCorrections),
    overrides: {
      cushionRestitution: round3(overrides.cushionRestitution),
      cushionContactFriction: round3(overrides.cushionContactFriction),
      clothLinearSpinCouplingPerSec: round3(overrides.clothLinearSpinCouplingPerSec),
      spinDampingPerTick: round3(overrides.spinDampingPerTick),
      linearDampingPerTick: round3(overrides.linearDampingPerTick),
      cushionPostCollisionSpeedScale: round3(overrides.cushionPostCollisionSpeedScale),
      cushionSpinMonotonicRetention: round3(overrides.cushionSpinMonotonicRetention),
    },
    stats: {
      meanDelta: clamp(meanDelta, -200, 200),
      meanAbsDelta: clamp(Math.abs(meanAbsDelta), 0, 200),
    },
  };
}

function resolveOutputPath(inputPath: string): string {
  const provided = process.env.FAH_MULTI_PROFILE_OUTPUT;
  if (provided) {
    return isAbsolute(provided) ? provided : resolve(process.cwd(), provided);
  }
  const base = `${Date.now()}.fah-physics-tuning.json`;
  return resolve(dirname(inputPath), base);
}

function run(): void {
  const inputPath = resolveSummaryFilePath();
  const raw = readFileSync(inputPath, 'utf8');
  const summary = parseSummary(raw);
  const profile = buildProfile(summary);
  const outputPath = resolveOutputPath(inputPath);

  mkdirSync(dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, `${JSON.stringify(profile, null, 2)}\n`, 'utf8');

  console.log(JSON.stringify({
    sourcePath: inputPath,
    outputPath,
    profile,
  }, null, 2));
}

run();
