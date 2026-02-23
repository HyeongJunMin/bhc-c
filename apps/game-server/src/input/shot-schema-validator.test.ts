import test from 'node:test';
import assert from 'node:assert/strict';

import { validateShotInputSchema } from './shot-schema-validator.ts';

const validPayload = {
  schemaName: 'shot_input',
  schemaVersion: '1.0.0',
  roomId: 'room-1',
  matchId: 'match-1',
  turnId: 'turn-1',
  playerId: 'player-1',
  clientTsMs: 1000,
  shotDirectionDeg: 120,
  cueElevationDeg: 10,
  dragPx: 300,
  impactOffsetX: 0,
  impactOffsetY: 0,
  inputSeq: 1,
};

test('샷 입력 payload가 스키마를 만족하면 통과한다', () => {
  const result = validateShotInputSchema(validPayload);

  assert.deepEqual(result, { ok: true });
});

test('필수 필드가 없으면 SHOT_INPUT_SCHEMA_INVALID를 반환한다', () => {
  const { turnId: _turnId, ...invalidPayload } = validPayload;

  const result = validateShotInputSchema(invalidPayload);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'SHOT_INPUT_SCHEMA_INVALID');
    assert.ok(result.errors.some((error) => error.includes('turnId is required')));
  }
});

test('제약을 위반하면 SHOT_INPUT_SCHEMA_INVALID를 반환한다', () => {
  const invalidPayload = {
    ...validPayload,
    dragPx: 1,
  };

  const result = validateShotInputSchema(invalidPayload);

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'SHOT_INPUT_SCHEMA_INVALID');
    assert.ok(result.errors.some((error) => error.includes('dragPx must be >= 10')));
  }
});
