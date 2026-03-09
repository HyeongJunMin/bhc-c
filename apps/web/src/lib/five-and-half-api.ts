import { PHYSICS } from './constants';

type PredictRequestPayload = {
  tableProfile: {
    id: string;
    widthM: number;
    heightM: number;
    indexScale: 50 | 100;
    condition: 'tight' | 'normal' | 'slippery';
  };
  layout: {
    cueBall: { x: number; y: number };
    objectBall1: { x: number; y: number };
    objectBall2: { x: number; y: number };
  };
  intent: {
    routeType: 'five_and_half';
    targetThirdRail: 'long' | 'short';
  };
  shotHint?: {
    speedBand: 'low' | 'mid' | 'high';
    spinBand: 'none' | 'light' | 'strong';
    angleBand: 'shallow' | 'mid' | 'steep';
  };
};

type SimulateRequestPayload = {
  predict?: Record<string, unknown>;
  shotInput: Record<string, unknown>;
  physicsProfile: {
    clothFriction: number;
    cushionRestitution: number;
    spinDecay: number;
  };
};

type CalibrateRequestPayload = {
  profileId: string;
  strategy: 'ema' | 'batch_least_squares';
  samples: Array<{
    predict: Record<string, unknown>;
    simulate: Record<string, unknown>;
    success: boolean;
  }>;
};

type FiveAndHalfSuccessEnvelope = {
  schemaName: 'five_and_half_api';
  schemaVersion: '1.0.0';
  payloadType: string;
  payload: Record<string, unknown>;
};

type FiveAndHalfErrorResponse = {
  errorCode: string;
  details?: string[];
};

function resolveApiBaseUrl(): string {
  const fromEnv = (import.meta.env.VITE_GAME_SERVER_URL as string | undefined)?.trim();
  if (fromEnv) {
    return fromEnv.replace(/\/+$/, '');
  }
  return 'http://localhost:9900';
}

function toEnvelope(payloadType: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaName: 'five_and_half_api',
    schemaVersion: '1.0.0',
    payloadType,
    payload,
  };
}

async function callOperation(
  operation: 'predict' | 'simulate' | 'calibrate',
  payload: Record<string, unknown>,
): Promise<FiveAndHalfSuccessEnvelope> {
  const baseUrl = resolveApiBaseUrl();
  const response = await fetch(`${baseUrl}/v1/systems/five-and-half/${operation}`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(toEnvelope(`${operation}_request`, payload)),
  });
  const parsed = (await response.json()) as FiveAndHalfSuccessEnvelope | FiveAndHalfErrorResponse;
  if (!response.ok) {
    const errorCode = 'errorCode' in parsed ? parsed.errorCode : 'ERR_FAH_SCHEMA_VALIDATION_FAILED';
    const details = 'details' in parsed && Array.isArray(parsed.details) ? parsed.details : [];
    throw new Error(`${errorCode}${details.length > 0 ? `: ${details.join(', ')}` : ''}`);
  }
  return parsed as FiveAndHalfSuccessEnvelope;
}

export async function predictFiveAndHalf(payload: PredictRequestPayload): Promise<FiveAndHalfSuccessEnvelope> {
  return callOperation('predict', payload as unknown as Record<string, unknown>);
}

export async function simulateFiveAndHalf(payload: SimulateRequestPayload): Promise<FiveAndHalfSuccessEnvelope> {
  return callOperation('simulate', payload as unknown as Record<string, unknown>);
}

export async function calibrateFiveAndHalf(payload: CalibrateRequestPayload): Promise<FiveAndHalfSuccessEnvelope> {
  return callOperation('calibrate', payload as unknown as Record<string, unknown>);
}

export function worldToTablePoint(position: { x: number; z: number }): { x: number; y: number } {
  return {
    x: position.x + PHYSICS.TABLE_WIDTH / 2,
    y: position.z + PHYSICS.TABLE_HEIGHT / 2,
  };
}
