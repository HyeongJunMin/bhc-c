import { validateShotInputSchema } from './shot-schema-validator.ts';

export type ShotInputEntryResult =
  | {
      ok: true;
      payload: Record<string, unknown>;
    }
  | {
      ok: false;
      statusCode: 400;
      errorCode: 'SHOT_INPUT_SCHEMA_INVALID';
      errors: string[];
    };

export function handleShotInputEntry(payload: unknown): ShotInputEntryResult {
  const validationResult = validateShotInputSchema(payload);
  if (!validationResult.ok) {
    return {
      ok: false,
      statusCode: 400,
      errorCode: validationResult.errorCode,
      errors: validationResult.errors,
    };
  }

  return {
    ok: true,
    payload: payload as Record<string, unknown>,
  };
}
