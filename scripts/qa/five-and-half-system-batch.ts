import { appendFileSync, mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createRoomPhysicsStepConfig } from '../../packages/physics-core/src/room-physics-config.ts';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

type FahEnvelope = {
  schemaName: 'five_and_half_api';
  schemaVersion: '1.0.0';
  payloadType: string;
  payload: Record<string, JsonValue>;
};

type ShotLogRow = {
  ts: string;
  runId: string;
  caseLabel: string;
  targetPoint: number;
  iteration: number;
  cuePoint: { x: number; y: number };
  objectBall1: { x: number; y: number };
  objectBall2: { x: number; y: number };
  shotInput: {
    shotDirectionDeg: number;
    cueElevationDeg: number;
    dragPx: number;
    impactOffsetX: number;
    impactOffsetY: number;
  };
  predict: Record<string, JsonValue>;
  simulate: Record<string, JsonValue>;
  errorMetrics: {
    thirdCushionIndexDelta: number;
    landingDistanceM: number;
  };
  observedThirdCushion: number;
  estimatedS11: number;
};

type PointStats = {
  targetPoint: number;
  count: number;
  meanDelta: number;
  stdDevDelta: number;
  ci95DeltaHalfWidth: number;
  meanAbsDelta: number;
  meanLandingDistanceM: number;
  suggestedOffset: number;
  reproducibilityGrade: 'A' | 'B' | 'C' | 'D' | 'N/A';
};

function asFiniteNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function stdDev(values: number[]): number {
  if (values.length < 2) {
    return 0;
  }
  const mean = values.reduce((acc, value) => acc + value, 0) / values.length;
  const variance = values.reduce((acc, value) => acc + (value - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance);
}

function mean(values: number[]): number {
  if (values.length === 0) {
    return 0;
  }
  return values.reduce((acc, value) => acc + value, 0) / values.length;
}

function ci95HalfWidth(values: number[]): number {
  const n = values.length;
  if (n < 2) {
    return 0;
  }
  return (1.96 * stdDev(values)) / Math.sqrt(n);
}

function reproducibilityGrade(stdDevDelta: number, count: number): 'A' | 'B' | 'C' | 'D' | 'N/A' {
  if (count < 3) {
    return 'N/A';
  }
  if (stdDevDelta <= 0.35) return 'A';
  if (stdDevDelta <= 0.7) return 'B';
  if (stdDevDelta <= 1.2) return 'C';
  return 'D';
}

function toFahEnvelope(payloadType: string, payload: Record<string, JsonValue>): FahEnvelope {
  return {
    schemaName: 'five_and_half_api',
    schemaVersion: '1.0.0',
    payloadType,
    payload,
  };
}

function directionDegFromTablePoints(from: { x: number; y: number }, to: { x: number; y: number }): number {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const deg = (Math.atan2(dx, dy) * 180) / Math.PI;
  return (deg + 360) % 360;
}

async function callFah(
  baseUrl: string,
  operation: 'predict' | 'simulate' | 'calibrate',
  payload: Record<string, JsonValue>,
): Promise<FahEnvelope> {
  const response = await fetch(`${baseUrl}/v1/systems/five-and-half/${operation}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(toFahEnvelope(`${operation}_request`, payload)),
  });
  const body = (await response.json()) as Record<string, unknown>;
  if (!response.ok) {
    const code = typeof body.errorCode === 'string' ? body.errorCode : 'ERR_FAH_UNKNOWN';
    const details = Array.isArray(body.details) ? body.details.map((item) => String(item)).join(', ') : '';
    throw new Error(`${operation} failed: ${code}${details ? ` (${details})` : ''}`);
  }
  return body as FahEnvelope;
}

async function run(): Promise<void> {
  const baseUrl = (process.env.FAH_BASE_URL ?? 'http://localhost:9900').replace(/\/+$/, '');
  const repeats = Math.max(1, Number(process.env.FAH_REPEATS ?? '10'));
  const runId = process.env.FAH_RUN_ID ?? `fah-batch-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const dryRun = process.env.FAH_DRY_RUN === '1';
  const outputDir = resolve(process.cwd(), 'tmp', 'fah');
  const logPath = resolve(outputDir, `${runId}.ndjson`);
  const summaryPath = resolve(outputDir, `${runId}.summary.json`);

  const config = createRoomPhysicsStepConfig();
  const tableWidthM = config.tableWidthM;
  const tableHeightM = config.tableHeightM;
  const indexScale = 100;

  // 요구사항: 다이아몬드 포인트 (1,1)에 수구 고정
  const cuePoint = {
    x: tableWidthM / 8,
    y: tableHeightM / 4,
  };

  // 요구사항: 상-왼 2팁 고정 (1tip ~= 0.2R 가정)
  const twoTipOffset = config.ballRadiusM * 0.4;
  const fixedShot = {
    cueElevationDeg: 0,
    dragPx: 127,
    impactOffsetX: -twoTipOffset,
    impactOffsetY: twoTipOffset,
  };

  const targetPoints = (process.env.FAH_TARGET_POINTS ?? '10,20,30,40,50,60,70,80,90')
    .split(',')
    .map((raw) => Number(raw.trim()))
    .filter((value) => Number.isFinite(value) && value >= 0 && value <= indexScale);

  mkdirSync(outputDir, { recursive: true });

  const rows: ShotLogRow[] = [];
  let shotCount = 0;

  for (const targetPoint of targetPoints) {
    // predict에서 expectedThirdCushion ~= objectBall1.x 비율이므로 target point를 x좌표로 역매핑
    const objectBall1 = {
      x: (targetPoint / indexScale) * tableWidthM,
      y: tableHeightM * 0.5,
    };
    const objectBall2 = {
      x: tableWidthM * 0.78,
      y: tableHeightM * 0.76,
    };
    const shotDirectionDeg = directionDegFromTablePoints(cuePoint, objectBall1);

    for (let i = 1; i <= repeats; i += 1) {
      shotCount += 1;

      if (dryRun) {
        continue;
      }

      const predict = await callFah(baseUrl, 'predict', {
        tableProfile: {
          id: 'fah-isolated-test',
          widthM: tableWidthM,
          heightM: tableHeightM,
          indexScale,
          condition: 'normal',
        },
        layout: {
          cueBall: cuePoint,
          objectBall1,
          objectBall2,
        },
        intent: {
          routeType: 'five_and_half',
          targetThirdRail: 'long',
        },
        shotHint: {
          speedBand: 'high',
          spinBand: 'light',
          angleBand: 'shallow',
        },
      });

      const simulate = await callFah(baseUrl, 'simulate', {
        predict: predict.payload,
        shotInput: {
          schemaName: 'shot_input',
          schemaVersion: '1.0.0',
          roomId: 'fah-isolated-room',
          matchId: runId,
          turnId: `${runId}-${targetPoint}-${i}`,
          playerId: 'fah-bot',
          clientTsMs: Date.now(),
          shotDirectionDeg,
          cueElevationDeg: fixedShot.cueElevationDeg,
          dragPx: fixedShot.dragPx,
          impactOffsetX: fixedShot.impactOffsetX,
          impactOffsetY: fixedShot.impactOffsetY,
          inputSeq: i,
        },
        physicsProfile: {
          clothFriction: 0.22,
          cushionRestitution: 0.72,
          spinDecay: 0.12,
        },
      });

      const metrics = (simulate.payload.errorMetrics ?? {}) as Record<string, unknown>;
      const expectedThird = asFiniteNumber(predict.payload.expectedThirdCushion);
      const correctedAim = asFiniteNumber(predict.payload.correctedAim);
      const thirdDelta = asFiniteNumber(metrics.thirdCushionIndexDelta);
      const observedThirdCushion = expectedThird + thirdDelta;
      const row: ShotLogRow = {
        ts: new Date().toISOString(),
        runId,
        caseLabel: `P${targetPoint}`,
        targetPoint,
        iteration: i,
        cuePoint,
        objectBall1,
        objectBall2,
        shotInput: {
          shotDirectionDeg,
          cueElevationDeg: fixedShot.cueElevationDeg,
          dragPx: fixedShot.dragPx,
          impactOffsetX: fixedShot.impactOffsetX,
          impactOffsetY: fixedShot.impactOffsetY,
        },
        predict: predict.payload,
        simulate: simulate.payload,
        errorMetrics: {
          thirdCushionIndexDelta: thirdDelta,
          landingDistanceM: asFiniteNumber(metrics.landingDistanceM),
        },
        observedThirdCushion: round3(observedThirdCushion),
        estimatedS11: round3(correctedAim + observedThirdCushion),
      };
      rows.push(row);
      appendFileSync(logPath, `${JSON.stringify(row)}\n`, 'utf8');
    }
  }

  const pointStats: PointStats[] = targetPoints.map((targetPoint) => {
    const samples = rows.filter((row) => row.targetPoint === targetPoint);
    const deltas = samples.map((row) => row.errorMetrics.thirdCushionIndexDelta);
    const landings = samples.map((row) => row.errorMetrics.landingDistanceM);
    const meanDelta = mean(deltas);
    const stdDevDelta = stdDev(deltas);
    const deltaCi95 = ci95HalfWidth(deltas);
    const meanAbsDelta = deltas.length === 0 ? 0 : mean(deltas.map((value) => Math.abs(value)));
    const meanLandingDistanceM = mean(landings);

    // sign 반전 보정값: 다음 반복에서 correctedAim += suggestedOffset
    const suggestedOffset = -meanDelta;
    return {
      targetPoint,
      count: samples.length,
      meanDelta: round3(meanDelta),
      stdDevDelta: round3(stdDevDelta),
      ci95DeltaHalfWidth: round3(deltaCi95),
      meanAbsDelta: round3(meanAbsDelta),
      meanLandingDistanceM: round3(meanLandingDistanceM),
      suggestedOffset: round3(suggestedOffset),
      reproducibilityGrade: reproducibilityGrade(stdDevDelta, samples.length),
    };
  });

  const s11Samples = rows.map((row) => row.estimatedS11);
  const s11Estimate = {
    count: s11Samples.length,
    mean: round3(mean(s11Samples)),
    stdDev: round3(stdDev(s11Samples)),
    ci95HalfWidth: round3(ci95HalfWidth(s11Samples)),
  };

  const correctionTable = pointStats.reduce<Record<string, number>>((acc, item) => {
    acc[String(item.targetPoint)] = item.suggestedOffset;
    return acc;
  }, {});

  const pointStatsCsvPath = resolve(outputDir, `${runId}.point-stats.csv`);
  const csvHeader = [
    'targetPoint',
    'count',
    'meanDelta',
    'stdDevDelta',
    'ci95DeltaHalfWidth',
    'meanAbsDelta',
    'meanLandingDistanceM',
    'suggestedOffset',
    'reproducibilityGrade',
  ];
  const csvRows = pointStats.map((row) =>
    [
      row.targetPoint,
      row.count,
      row.meanDelta,
      row.stdDevDelta,
      row.ci95DeltaHalfWidth,
      row.meanAbsDelta,
      row.meanLandingDistanceM,
      row.suggestedOffset,
      row.reproducibilityGrade,
    ].join(','),
  );
  writeFileSync(pointStatsCsvPath, `${csvHeader.join(',')}\n${csvRows.join('\n')}\n`, 'utf8');

  const summary = {
    runId,
    baseUrl,
    dryRun,
    repeats,
    shotCount,
    savedRows: rows.length,
    cuePoint,
    fixedShot,
    targetPoints,
    logPath,
    summaryPath,
    pointStatsCsvPath,
    pointStats,
    correctionTable,
    s11Estimate,
    avgAbsIndexDelta:
      rows.length === 0
        ? 0
        : rows.reduce((acc, row) => acc + Math.abs(row.errorMetrics.thirdCushionIndexDelta), 0) / rows.length,
    avgLandingDistanceM:
      rows.length === 0 ? 0 : rows.reduce((acc, row) => acc + row.errorMetrics.landingDistanceM, 0) / rows.length,
  };

  writeFileSync(summaryPath, `${JSON.stringify(summary, null, 2)}\n`, 'utf8');
  console.log(JSON.stringify(summary, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
