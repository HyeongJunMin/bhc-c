import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createRoomPhysicsStepConfig } from '../../packages/physics-core/src/room-physics-config.ts';

type JsonValue = string | number | boolean | null | JsonValue[] | { [k: string]: JsonValue };

type FahEnvelope = {
  schemaName: 'five_and_half_api';
  schemaVersion: '1.0.0';
  payloadType: string;
  payload: Record<string, JsonValue>;
};

type AnchorResult = {
  point: number;
  desiredThird: number;
  expectedThird: number;
  observedThirdMean: number;
  error: number;
};

type Candidate = {
  rank?: number;
  clothFriction: number;
  cushionRestitution: number;
  spinDecay: number;
  mae: number;
  rmse: number;
  weightedScore: number;
  anchors: AnchorResult[];
};

function asFiniteNumber(value: unknown, fallback: number = 0): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback;
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function parseNumberList(raw: string, fallback: number[]): number[] {
  const parsed = raw
    .split(',')
    .map((value) => Number(value.trim()))
    .filter((value) => Number.isFinite(value));
  return parsed.length > 0 ? parsed : fallback;
}

function parseAnchorMap(raw: string): Map<number, number> {
  const map = new Map<number, number>();
  raw
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean)
    .forEach((pair) => {
      const [left, right] = pair.split(':').map((token) => Number(token.trim()));
      if (Number.isFinite(left) && Number.isFinite(right)) {
        map.set(left, right);
      }
    });
  if (map.size === 0) {
    map.set(0, 40);
    map.set(30, 20);
    map.set(40, 10);
    map.set(45, 5);
  }
  return map;
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
  operation: 'predict' | 'simulate',
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
  const runId = process.env.FAH_RUN_ID ?? `fah-opt-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  const outputDir = resolve(process.cwd(), 'tmp', 'fah');

  const anchorMap = parseAnchorMap(process.env.FAH_ANCHOR_TARGETS ?? '0:40,30:20,40:10,45:5');
  const anchorPoints = parseNumberList(
    process.env.FAH_ANCHOR_FIRST_POINTS ?? Array.from(anchorMap.keys()).join(','),
    [0, 30, 40, 45],
  );
  const clothFrictions = parseNumberList(process.env.FAH_GRID_CLOTH ?? '0.16,0.2,0.22,0.24,0.28', [0.22]);
  const cushionRestitutions = parseNumberList(process.env.FAH_GRID_RESTITUTION ?? '0.86,0.88,0.9,0.92,0.94', [0.72]);
  const spinDecays = parseNumberList(process.env.FAH_GRID_SPIN_DECAY ?? '0.08,0.1,0.12,0.14,0.16', [0.12]);

  const cfg = createRoomPhysicsStepConfig();
  const tableWidthM = cfg.tableWidthM;
  const tableHeightM = cfg.tableHeightM;
  const cuePoint = {
    x: tableWidthM / 8,
    y: tableHeightM / 4,
  };
  const twoTipOffset = cfg.ballRadiusM * 0.4;
  const fixedShot = {
    cueElevationDeg: 0,
    dragPx: 127,
    impactOffsetX: -twoTipOffset,
    impactOffsetY: twoTipOffset,
  };

  const predictCache = new Map<number, { payload: Record<string, JsonValue>; directionDeg: number }>();
  for (const point of anchorPoints) {
    const objectBall1 = {
      x: (point / 100) * tableWidthM,
      y: tableHeightM * 0.5,
    };
    const objectBall2 = {
      x: tableWidthM * 0.78,
      y: tableHeightM * 0.76,
    };
    const directionDeg = directionDegFromTablePoints(cuePoint, objectBall1);
    const predict = await callFah(baseUrl, 'predict', {
      tableProfile: {
        id: 'fah-anchor-opt',
        widthM: tableWidthM,
        heightM: tableHeightM,
        indexScale: 100,
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
    predictCache.set(point, { payload: predict.payload, directionDeg });
  }

  const candidates: Candidate[] = [];
  for (const clothFriction of clothFrictions) {
    for (const cushionRestitution of cushionRestitutions) {
      for (const spinDecay of spinDecays) {
        const anchors: AnchorResult[] = [];
        for (const point of anchorPoints) {
          const desiredThird = anchorMap.get(point) ?? point;
          const cached = predictCache.get(point);
          if (!cached) {
            continue;
          }
          const expectedThird = asFiniteNumber(cached.payload.expectedThirdCushion);
          let observedSum = 0;
          for (let i = 0; i < repeats; i += 1) {
            const simulate = await callFah(baseUrl, 'simulate', {
              predict: cached.payload,
              shotInput: {
                schemaName: 'shot_input',
                schemaVersion: '1.0.0',
                roomId: 'fah-anchor-opt-room',
                matchId: runId,
                turnId: `${runId}-${point}-${i + 1}`,
                playerId: 'fah-opt-bot',
                clientTsMs: Date.now(),
                shotDirectionDeg: cached.directionDeg,
                cueElevationDeg: fixedShot.cueElevationDeg,
                dragPx: fixedShot.dragPx,
                impactOffsetX: fixedShot.impactOffsetX,
                impactOffsetY: fixedShot.impactOffsetY,
                inputSeq: i + 1,
              },
              physicsProfile: {
                clothFriction,
                cushionRestitution,
                spinDecay,
              },
            });
            const metrics = (simulate.payload.errorMetrics ?? {}) as Record<string, unknown>;
            const thirdDelta = asFiniteNumber(metrics.thirdCushionIndexDelta);
            observedSum += expectedThird + thirdDelta;
          }
          const observedThirdMean = observedSum / repeats;
          const error = observedThirdMean - desiredThird;
          anchors.push({
            point,
            desiredThird,
            expectedThird: round3(expectedThird),
            observedThirdMean: round3(observedThirdMean),
            error: round3(error),
          });
        }
        if (anchors.length === 0) {
          continue;
        }
        const mae = anchors.reduce((sum, anchor) => sum + Math.abs(anchor.error), 0) / anchors.length;
        const rmse = Math.sqrt(anchors.reduce((sum, anchor) => sum + anchor.error ** 2, 0) / anchors.length);
        const weightedScore = rmse * 0.7 + mae * 0.3;
        candidates.push({
          clothFriction: round3(clothFriction),
          cushionRestitution: round3(cushionRestitution),
          spinDecay: round3(spinDecay),
          mae: round3(mae),
          rmse: round3(rmse),
          weightedScore: round3(weightedScore),
          anchors,
        });
      }
    }
  }

  candidates.sort((a, b) => a.weightedScore - b.weightedScore);
  const ranked = candidates.slice(0, 12).map((candidate, index) => ({ ...candidate, rank: index + 1 }));

  const best = ranked[0] ?? null;
  const result = {
    runId,
    baseUrl,
    repeats,
    anchorTargets: Object.fromEntries(anchorMap),
    anchorPoints,
    grid: {
      clothFrictions,
      cushionRestitutions,
      spinDecays,
      totalCases: clothFrictions.length * cushionRestitutions.length * spinDecays.length,
    },
    best,
    ranked,
  };

  mkdirSync(outputDir, { recursive: true });
  const summaryPath = resolve(outputDir, `${runId}.anchor-opt.summary.json`);
  writeFileSync(summaryPath, `${JSON.stringify(result, null, 2)}\n`, 'utf8');

  const csvPath = resolve(outputDir, `${runId}.anchor-opt.top.csv`);
  const csvHeader = [
    'rank',
    'clothFriction',
    'cushionRestitution',
    'spinDecay',
    'mae',
    'rmse',
    'weightedScore',
    'p0_error',
    'p30_error',
    'p40_error',
    'p45_error',
  ];
  const csvRows = ranked.map((candidate) => {
    const err = (point: number) => candidate.anchors.find((anchor) => anchor.point === point)?.error ?? '';
    return [
      candidate.rank,
      candidate.clothFriction,
      candidate.cushionRestitution,
      candidate.spinDecay,
      candidate.mae,
      candidate.rmse,
      candidate.weightedScore,
      err(0),
      err(30),
      err(40),
      err(45),
    ].join(',');
  });
  writeFileSync(csvPath, `${csvHeader.join(',')}\n${csvRows.join('\n')}\n`, 'utf8');

  console.log(JSON.stringify({
    runId,
    summaryPath,
    csvPath,
    best,
    topCount: ranked.length,
  }, null, 2));
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
