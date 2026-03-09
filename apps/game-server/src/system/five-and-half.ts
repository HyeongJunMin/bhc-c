import type { IncomingMessage, ServerResponse } from 'node:http';

import { handleShotInputEntry } from '../input/shot-input-entry.ts';
import { computeShotInitialization } from '../../../../packages/physics-core/src/shot-init.ts';

const SCHEMA_NAME = 'five_and_half_api';
const SCHEMA_VERSION = '1.0.0';
const BASE_PATH = '/v1/systems/five-and-half';

type PayloadType = 'predict_request' | 'simulate_request' | 'calibrate_request';

type ApiEnvelope = {
  schemaName: string;
  schemaVersion: string;
  payloadType: string;
  payload: Record<string, unknown>;
};

type ApiError = {
  statusCode: number;
  errorCode:
    | 'ERR_FAH_INVALID_LAYOUT'
    | 'ERR_FAH_UNSUPPORTED_INDEX_SCALE'
    | 'ERR_FAH_PREDICTION_OUT_OF_RANGE'
    | 'ERR_FAH_SIMULATION_DIVERGED'
    | 'ERR_FAH_CALIBRATION_NOT_ENOUGH_SAMPLES'
    | 'ERR_FAH_SCHEMA_VALIDATION_FAILED';
  details?: string[];
};

type ApiResult = { ok: true; body: ApiEnvelope } | { ok: false; error: ApiError };

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function asFiniteNumber(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '*';
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-methods', 'POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type,Accept');
}

function buildSchemaError(details: string[]): ApiResult {
  return {
    ok: false,
    error: {
      statusCode: 400,
      errorCode: 'ERR_FAH_SCHEMA_VALIDATION_FAILED',
      details,
    },
  };
}

function parseEnvelope(raw: unknown, expectedPayloadType: PayloadType): ApiResult | { ok: true; envelope: ApiEnvelope } {
  if (!isRecord(raw)) {
    return buildSchemaError(['body must be object']);
  }
  const envelope: ApiEnvelope = {
    schemaName: String(raw.schemaName ?? ''),
    schemaVersion: String(raw.schemaVersion ?? ''),
    payloadType: String(raw.payloadType ?? ''),
    payload: isRecord(raw.payload) ? raw.payload : {},
  };
  const errors: string[] = [];
  if (envelope.schemaName !== SCHEMA_NAME) {
    errors.push(`schemaName must equal ${SCHEMA_NAME}`);
  }
  if (envelope.schemaVersion !== SCHEMA_VERSION) {
    errors.push(`schemaVersion must equal ${SCHEMA_VERSION}`);
  }
  if (envelope.payloadType !== expectedPayloadType) {
    errors.push(`payloadType must equal ${expectedPayloadType}`);
  }
  if (!isRecord(raw.payload)) {
    errors.push('payload must be object');
  }
  if (errors.length > 0) {
    return buildSchemaError(errors);
  }
  return { ok: true, envelope };
}

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

function validatePoint2(payload: Record<string, unknown>, fieldName: string, errors: string[]): { x: number; y: number } | null {
  const point = payload[fieldName];
  if (!isRecord(point)) {
    errors.push(`${fieldName} must be object`);
    return null;
  }
  const x = asFiniteNumber(point.x);
  const y = asFiniteNumber(point.y);
  if (x === null || y === null) {
    errors.push(`${fieldName}.x/y must be finite number`);
    return null;
  }
  return { x, y };
}

function predict(payload: Record<string, unknown>): ApiResult {
  const errors: string[] = [];
  const tableProfile = isRecord(payload.tableProfile) ? payload.tableProfile : null;
  const layout = isRecord(payload.layout) ? payload.layout : null;
  const intent = isRecord(payload.intent) ? payload.intent : null;
  if (!tableProfile) {
    errors.push('tableProfile must be object');
  }
  if (!layout) {
    errors.push('layout must be object');
  }
  if (!intent) {
    errors.push('intent must be object');
  }
  if (errors.length > 0) {
    return buildSchemaError(errors);
  }

  const widthM = asFiniteNumber(tableProfile!.widthM);
  const heightM = asFiniteNumber(tableProfile!.heightM);
  const indexScale = tableProfile!.indexScale;
  const condition = String(tableProfile!.condition ?? '');
  if (widthM === null || widthM <= 0 || heightM === null || heightM <= 0) {
    return {
      ok: false,
      error: { statusCode: 400, errorCode: 'ERR_FAH_INVALID_LAYOUT', details: ['tableProfile.widthM/heightM must be > 0'] },
    };
  }
  if (indexScale !== 50 && indexScale !== 100) {
    return {
      ok: false,
      error: { statusCode: 400, errorCode: 'ERR_FAH_UNSUPPORTED_INDEX_SCALE', details: ['indexScale must be 50 or 100'] },
    };
  }
  if (!['tight', 'normal', 'slippery'].includes(condition)) {
    errors.push('tableProfile.condition must be tight|normal|slippery');
  }

  const cueBall = validatePoint2(layout!, 'cueBall', errors);
  const objectBall1 = validatePoint2(layout!, 'objectBall1', errors);
  validatePoint2(layout!, 'objectBall2', errors);
  const routeType = String(intent!.routeType ?? '');
  const targetThirdRail = String(intent!.targetThirdRail ?? '');
  if (routeType !== 'five_and_half') {
    errors.push('intent.routeType must be five_and_half');
  }
  if (!['long', 'short'].includes(targetThirdRail)) {
    errors.push('intent.targetThirdRail must be long|short');
  }
  if (errors.length > 0) {
    return buildSchemaError(errors);
  }

  const cueIndexRaw = (cueBall!.x / widthM) * Number(indexScale);
  const thirdIndexRaw =
    targetThirdRail === 'long'
      ? (objectBall1!.x / widthM) * Number(indexScale)
      : (objectBall1!.y / heightM) * Number(indexScale);

  const cueIndex = clamp(cueIndexRaw, 0, Number(indexScale));
  const thirdIndex = clamp(thirdIndexRaw, 0, Number(indexScale));
  const baseAim = cueIndex - thirdIndex;

  const shotHint = isRecord(payload.shotHint) ? payload.shotHint : null;
  const conditionDelta = condition === 'tight' ? -1.2 : condition === 'slippery' ? 1.2 : 0;
  const speedDelta = shotHint?.speedBand === 'high' ? 0.8 : shotHint?.speedBand === 'low' ? -0.8 : 0;
  const spinDelta = shotHint?.spinBand === 'strong' ? 0.6 : shotHint?.spinBand === 'light' ? 0.25 : 0;
  const angleDelta = shotHint?.angleBand === 'steep' ? -0.4 : shotHint?.angleBand === 'shallow' ? 0.4 : 0;

  const correctedAim = clamp(baseAim + conditionDelta + speedDelta + spinDelta + angleDelta, 0, Number(indexScale));
  const confidence = clamp(0.9 - Math.abs(conditionDelta + speedDelta + spinDelta + angleDelta) * 0.05, 0.1, 0.99);

  return {
    ok: true,
    body: {
      schemaName: SCHEMA_NAME,
      schemaVersion: SCHEMA_VERSION,
      payloadType: 'predict_response',
      payload: {
        baseAim: round3(baseAim),
        correctedAim: round3(correctedAim),
        expectedThirdCushion: round3(thirdIndex),
        confidence: round3(confidence),
        correctionBreakdown: [
          { factor: 'table_condition', delta: round3(conditionDelta) },
          { factor: 'speed', delta: round3(speedDelta) },
          { factor: 'spin', delta: round3(spinDelta) },
          { factor: 'angle', delta: round3(angleDelta) },
        ],
      },
    },
  };
}

function simulate(payload: Record<string, unknown>): ApiResult {
  const physicsProfile = isRecord(payload.physicsProfile) ? payload.physicsProfile : null;
  if (!physicsProfile) {
    return buildSchemaError(['physicsProfile must be object']);
  }
  const clothFriction = asFiniteNumber(physicsProfile.clothFriction);
  const cushionRestitution = asFiniteNumber(physicsProfile.cushionRestitution);
  const spinDecay = asFiniteNumber(physicsProfile.spinDecay);
  if (
    clothFriction === null ||
    clothFriction < 0 ||
    cushionRestitution === null ||
    cushionRestitution < 0 ||
    cushionRestitution > 1 ||
    spinDecay === null ||
    spinDecay < 0
  ) {
    return buildSchemaError(['physicsProfile fields are invalid']);
  }

  const shotValidation = handleShotInputEntry(payload.shotInput);
  if (!shotValidation.ok) {
    return {
      ok: false,
      error: {
        statusCode: 400,
        errorCode: 'ERR_FAH_SCHEMA_VALIDATION_FAILED',
        details: shotValidation.errors,
      },
    };
  }

  const shot = shotValidation.payload;
  const init = computeShotInitialization({
    dragPx: Number(shot.dragPx),
    impactOffsetX: Number(shot.impactOffsetX),
    impactOffsetY: Number(shot.impactOffsetY),
  });
  const shotDirectionDeg = Number(shot.shotDirectionDeg);
  const cueElevationDeg = Number(shot.cueElevationDeg);
  const headingRad = (shotDirectionDeg * Math.PI) / 180;
  const elevationAttenuation = clamp(1 - cueElevationDeg / 120, 0.35, 1);
  const effectiveSpeed = init.initialBallSpeedMps * elevationAttenuation;
  const simulatedTravelDistanceM = (effectiveSpeed * (0.6 + cushionRestitution * 0.25)) / (1 + clothFriction * 0.15);

  const predictPayload = isRecord(payload.predict) ? payload.predict : null;
  const expectedThird = asFiniteNumber(predictPayload?.expectedThirdCushion) ?? 0;
  const simulatedThird = expectedThird + init.omegaZ * 0.003 - spinDecay * 0.1 + Math.sin(headingRad) * 0.35;
  const thirdCushionIndexDelta = round3(simulatedThird - expectedThird);
  const landingDistanceM = round3(Math.max(0, Math.abs(thirdCushionIndexDelta) * 0.01 + Math.abs(init.omegaX) * 0.0004));

  if (landingDistanceM > 2) {
    return {
      ok: false,
      error: { statusCode: 400, errorCode: 'ERR_FAH_SIMULATION_DIVERGED', details: ['landingDistanceM exceeded guard threshold'] },
    };
  }

  return {
    ok: true,
    body: {
      schemaName: SCHEMA_NAME,
      schemaVersion: SCHEMA_VERSION,
      payloadType: 'simulate_response',
      payload: {
        events: [
          {
            tMs: 40,
            kind: 'cushion_contact',
            rail: Math.abs(Math.sin(headingRad)) > Math.abs(Math.cos(headingRad)) ? 'left' : 'top',
          },
          {
            tMs: 120,
            kind: 'ball_contact',
          },
        ],
        finalState: {
          cueBallSpeedMps: round3(effectiveSpeed),
          omegaX: round3(init.omegaX),
          omegaZ: round3(init.omegaZ),
          simulatedTravelDistanceM: round3(simulatedTravelDistanceM),
        },
        errorMetrics: {
          thirdCushionIndexDelta,
          landingDistanceM,
        },
      },
    },
  };
}

function calibrate(payload: Record<string, unknown>): ApiResult {
  const profileId = typeof payload.profileId === 'string' ? payload.profileId.trim() : '';
  const strategy = String(payload.strategy ?? '');
  const samples = Array.isArray(payload.samples) ? payload.samples : null;
  if (!profileId || profileId.length > 64) {
    return buildSchemaError(['profileId must be non-empty string <= 64 chars']);
  }
  if (!samples || samples.length < 1) {
    return {
      ok: false,
      error: { statusCode: 400, errorCode: 'ERR_FAH_CALIBRATION_NOT_ENOUGH_SAMPLES', details: ['samples must include at least one item'] },
    };
  }
  if (strategy !== 'ema' && strategy !== 'batch_least_squares') {
    return buildSchemaError(['strategy must be ema|batch_least_squares']);
  }

  const deltas: number[] = [];
  for (const sample of samples) {
    if (!isRecord(sample) || !isRecord(sample.simulate) || !isRecord(sample.simulate.errorMetrics)) {
      return buildSchemaError(['samples[*].simulate.errorMetrics must be object']);
    }
    const delta = asFiniteNumber(sample.simulate.errorMetrics.thirdCushionIndexDelta);
    if (delta === null) {
      return buildSchemaError(['samples[*].simulate.errorMetrics.thirdCushionIndexDelta must be number']);
    }
    deltas.push(delta);
  }

  const avgDelta = deltas.reduce((acc, value) => acc + value, 0) / deltas.length;
  const gain = strategy === 'ema' ? 0.35 : 0.6;
  const correctionOffset = round3(-avgDelta * gain);
  const confidence = round3(clamp(1 - Math.abs(avgDelta) * 0.1, 0.2, 0.99));

  return {
    ok: true,
    body: {
      schemaName: SCHEMA_NAME,
      schemaVersion: SCHEMA_VERSION,
      payloadType: 'calibrate_response',
      payload: {
        updatedProfile: {
          profileId,
          strategy,
          correctionOffset,
          confidence,
          updatedAt: new Date().toISOString(),
        },
        deltaSummary: [
          {
            factor: 'user_profile',
            delta: correctionOffset,
          },
        ],
        appliedSampleCount: samples.length,
      },
    },
  };
}

export function handleFiveAndHalfOperation(operation: 'predict' | 'simulate' | 'calibrate', body: unknown): ApiResult {
  const payloadType = `${operation}_request` as PayloadType;
  const parsed = parseEnvelope(body, payloadType);
  if (!parsed.ok) {
    return parsed;
  }
  if (operation === 'predict') {
    return predict(parsed.envelope.payload);
  }
  if (operation === 'simulate') {
    return simulate(parsed.envelope.payload);
  }
  return calibrate(parsed.envelope.payload);
}

export function createFiveAndHalfRequestHandler() {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    applyCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }
    if (req.method !== 'POST') {
      writeJson(res, 404, { errorCode: 'NOT_FOUND' });
      return;
    }

    const url = new URL(req.url ?? BASE_PATH, 'http://localhost');
    const operation = url.pathname === `${BASE_PATH}/predict`
      ? 'predict'
      : url.pathname === `${BASE_PATH}/simulate`
        ? 'simulate'
        : url.pathname === `${BASE_PATH}/calibrate`
          ? 'calibrate'
          : null;
    if (!operation) {
      writeJson(res, 404, { errorCode: 'NOT_FOUND' });
      return;
    }

    let body: unknown = {};
    try {
      const rawBody = await readBody(req);
      body = JSON.parse(rawBody || '{}');
    } catch {
      writeJson(res, 400, {
        errorCode: 'ERR_FAH_SCHEMA_VALIDATION_FAILED',
        details: ['body must be valid json'],
      });
      return;
    }

    const result = handleFiveAndHalfOperation(operation, body);
    if (!result.ok) {
      writeJson(res, result.error.statusCode, {
        errorCode: result.error.errorCode,
        details: result.error.details ?? [],
      });
      return;
    }

    writeJson(res, 200, result.body);
  };
}
