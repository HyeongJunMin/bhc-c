import { readFileSync } from 'node:fs';

type SchemaProperty = {
  type?: 'string' | 'number' | 'integer';
  const?: string;
  minLength?: number;
  maxLength?: number;
  minimum?: number;
  maximum?: number;
  exclusiveMaximum?: number;
};

type ShotInputSchema = {
  type: 'object';
  additionalProperties: boolean;
  required: string[];
  properties: Record<string, SchemaProperty>;
};

const fallbackShotInputSchema: ShotInputSchema = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaName',
    'schemaVersion',
    'roomId',
    'matchId',
    'turnId',
    'playerId',
    'clientTsMs',
    'shotDirectionDeg',
    'cueElevationDeg',
    'dragPx',
    'impactOffsetX',
    'impactOffsetY',
  ],
  properties: {
    schemaName: { type: 'string', const: 'shot_input' },
    schemaVersion: { type: 'string', const: '1.0.0' },
    roomId: { type: 'string', minLength: 1, maxLength: 64 },
    matchId: { type: 'string', minLength: 1, maxLength: 64 },
    turnId: { type: 'string', minLength: 1, maxLength: 64 },
    playerId: { type: 'string', minLength: 1, maxLength: 64 },
    clientTsMs: { type: 'integer', minimum: 0 },
    shotDirectionDeg: { type: 'number', minimum: 0, exclusiveMaximum: 360 },
    cueElevationDeg: { type: 'number', minimum: 0, maximum: 89 },
    dragPx: { type: 'number', minimum: 10, maximum: 400 },
    impactOffsetX: { type: 'number', minimum: -0.03075, maximum: 0.03075 },
    impactOffsetY: { type: 'number', minimum: -0.03075, maximum: 0.03075 },
    inputSeq: { type: 'integer', minimum: 0 },
  },
};

export type ShotSchemaValidationResult =
  | { ok: true }
  | { ok: false; errorCode: 'SHOT_INPUT_SCHEMA_INVALID'; errors: string[] };

function loadShotInputSchema(): ShotInputSchema {
  const candidates = [
    new URL('../../schemas/shot-input-v1.json', import.meta.url),
    new URL('../../../../schemas/shot-input-v1.json', import.meta.url),
  ];
  for (const candidate of candidates) {
    try {
      return JSON.parse(readFileSync(candidate, 'utf8')) as ShotInputSchema;
    } catch {
      // Try next candidate.
    }
  }
  return fallbackShotInputSchema;
}

const shotInputSchema = loadShotInputSchema();

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function validateProperty(propertyName: string, propertySchema: SchemaProperty, value: unknown): string[] {
  const errors: string[] = [];

  if (propertySchema.const !== undefined && value !== propertySchema.const) {
    errors.push(`${propertyName} must equal ${propertySchema.const}`);
  }

  if (propertySchema.type === 'string') {
    if (typeof value !== 'string') {
      errors.push(`${propertyName} must be string`);
      return errors;
    }

    if (propertySchema.minLength !== undefined && value.length < propertySchema.minLength) {
      errors.push(`${propertyName} must have length >= ${propertySchema.minLength}`);
    }

    if (propertySchema.maxLength !== undefined && value.length > propertySchema.maxLength) {
      errors.push(`${propertyName} must have length <= ${propertySchema.maxLength}`);
    }

    return errors;
  }

  if (propertySchema.type === 'integer') {
    if (!Number.isInteger(value)) {
      errors.push(`${propertyName} must be integer`);
      return errors;
    }
  } else if (propertySchema.type === 'number') {
    if (typeof value !== 'number' || Number.isNaN(value)) {
      errors.push(`${propertyName} must be number`);
      return errors;
    }
  }

  if (typeof value === 'number') {
    if (propertySchema.minimum !== undefined && value < propertySchema.minimum) {
      errors.push(`${propertyName} must be >= ${propertySchema.minimum}`);
    }

    if (propertySchema.maximum !== undefined && value > propertySchema.maximum) {
      errors.push(`${propertyName} must be <= ${propertySchema.maximum}`);
    }

    if (propertySchema.exclusiveMaximum !== undefined && value >= propertySchema.exclusiveMaximum) {
      errors.push(`${propertyName} must be < ${propertySchema.exclusiveMaximum}`);
    }
  }

  return errors;
}

export function validateShotInputSchema(payload: unknown): ShotSchemaValidationResult {
  const errors: string[] = [];

  if (!isRecord(payload)) {
    return {
      ok: false,
      errorCode: 'SHOT_INPUT_SCHEMA_INVALID',
      errors: ['payload must be object'],
    };
  }

  for (const requiredProperty of shotInputSchema.required) {
    if (!(requiredProperty in payload)) {
      errors.push(`${requiredProperty} is required`);
    }
  }

  if (shotInputSchema.additionalProperties === false) {
    for (const propertyName of Object.keys(payload)) {
      if (!(propertyName in shotInputSchema.properties)) {
        errors.push(`${propertyName} is not allowed`);
      }
    }
  }

  for (const [propertyName, propertySchema] of Object.entries(shotInputSchema.properties)) {
    if (!(propertyName in payload)) {
      continue;
    }

    errors.push(...validateProperty(propertyName, propertySchema, payload[propertyName]));
  }

  if (errors.length > 0) {
    return {
      ok: false,
      errorCode: 'SHOT_INPUT_SCHEMA_INVALID',
      errors,
    };
  }

  return { ok: true };
}
