import test from 'node:test';
import assert from 'node:assert/strict';

import { handleShotInputEntry } from './shot-input-entry.ts';

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
  dragPx: 500,
  impactOffsetX: 0,
  impactOffsetY: 0,
  inputSeq: 1,
};

test('진입점에서 유효한 샷 입력 payload를 통과시킨다', () => {
  const result = handleShotInputEntry(validPayload);

  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.payload.roomId, 'room-1');
  }
});

test('진입점에서 스키마 위반 payload를 차단한다', () => {
  const result = handleShotInputEntry({
    ...validPayload,
    cueElevationDeg: 90,
  });

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.statusCode, 400);
    assert.equal(result.errorCode, 'SHOT_INPUT_SCHEMA_INVALID');
    assert.ok(result.errors.some((error) => error.includes('cueElevationDeg must be <= 89')));
  }
});

test('invalid payload는 위반 유형과 무관하게 SHOT_INPUT_SCHEMA_INVALID를 반환한다', () => {
  const invalidPayloads = [
    {
      ...validPayload,
      schemaName: 'invalid_name',
    },
    {
      ...validPayload,
      extraField: true,
    },
    {
      ...validPayload,
      dragPx: 1001,
    },
  ];

  for (const payload of invalidPayloads) {
    const result = handleShotInputEntry(payload);
    assert.equal(result.ok, false);
    if (!result.ok) {
      assert.equal(result.errorCode, 'SHOT_INPUT_SCHEMA_INVALID');
    }
  }
});
