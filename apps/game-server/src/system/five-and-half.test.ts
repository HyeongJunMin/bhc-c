import assert from 'node:assert/strict';
import test from 'node:test';

import { handleFiveAndHalfOperation } from './five-and-half.ts';

function buildEnvelope(payloadType: string, payload: Record<string, unknown>): Record<string, unknown> {
  return {
    schemaName: 'five_and_half_api',
    schemaVersion: '1.0.0',
    payloadType,
    payload,
  };
}

function buildValidShotInput(): Record<string, unknown> {
  return {
    schemaName: 'shot_input',
    schemaVersion: '1.0.0',
    roomId: 'room-1',
    matchId: 'match-1',
    turnId: 'turn-1',
    playerId: 'member-1',
    clientTsMs: 100,
    shotDirectionDeg: 35,
    cueElevationDeg: 12,
    dragPx: 180,
    impactOffsetX: 0.01,
    impactOffsetY: 0.005,
  };
}

test('five-and-half predict: 유효 요청이면 predict_response를 반환한다', () => {
  const request = buildEnvelope('predict_request', {
    tableProfile: {
      id: 'table-a',
      widthM: 2.84,
      heightM: 1.42,
      indexScale: 100,
      condition: 'normal',
    },
    layout: {
      cueBall: { x: 1.2, y: 0.7 },
      objectBall1: { x: 2.0, y: 0.5 },
      objectBall2: { x: 0.8, y: 1.0 },
    },
    intent: {
      routeType: 'five_and_half',
      targetThirdRail: 'long',
    },
    shotHint: {
      speedBand: 'mid',
      spinBand: 'light',
      angleBand: 'mid',
    },
  });

  const result = handleFiveAndHalfOperation('predict', request);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.body.payloadType, 'predict_response');
    const payload = result.body.payload as Record<string, unknown>;
    assert.equal(typeof payload.baseAim, 'number');
    assert.equal(typeof payload.correctedAim, 'number');
    assert.equal(typeof payload.confidence, 'number');
  }
});

test('five-and-half predict: indexScale이 지원 범위를 벗어나면 에러를 반환한다', () => {
  const request = buildEnvelope('predict_request', {
    tableProfile: {
      id: 'table-a',
      widthM: 2.84,
      heightM: 1.42,
      indexScale: 60,
      condition: 'normal',
    },
    layout: {
      cueBall: { x: 1.2, y: 0.7 },
      objectBall1: { x: 2.0, y: 0.5 },
      objectBall2: { x: 0.8, y: 1.0 },
    },
    intent: {
      routeType: 'five_and_half',
      targetThirdRail: 'long',
    },
  });

  const result = handleFiveAndHalfOperation('predict', request);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.errorCode, 'ERR_FAH_UNSUPPORTED_INDEX_SCALE');
  }
});

test('five-and-half simulate: 유효 샷 입력이면 simulate_response를 반환한다', () => {
  const request = buildEnvelope('simulate_request', {
    shotInput: buildValidShotInput(),
    physicsProfile: {
      clothFriction: 0.2,
      cushionRestitution: 0.72,
      spinDecay: 0.15,
    },
    predict: {
      baseAim: 18,
      correctedAim: 18.5,
      expectedThirdCushion: 32,
      confidence: 0.86,
    },
  });

  const result = handleFiveAndHalfOperation('simulate', request);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.body.payloadType, 'simulate_response');
    const payload = result.body.payload as Record<string, unknown>;
    const metrics = payload.errorMetrics as Record<string, unknown>;
    assert.equal(typeof metrics.thirdCushionIndexDelta, 'number');
    assert.equal(typeof metrics.landingDistanceM, 'number');
  }
});

test('five-and-half simulate: 샷 입력이 스키마 위반이면 에러를 반환한다', () => {
  const invalidShot = buildValidShotInput();
  delete invalidShot.roomId;
  const request = buildEnvelope('simulate_request', {
    shotInput: invalidShot,
    physicsProfile: {
      clothFriction: 0.2,
      cushionRestitution: 0.72,
      spinDecay: 0.15,
    },
  });

  const result = handleFiveAndHalfOperation('simulate', request);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.errorCode, 'ERR_FAH_SCHEMA_VALIDATION_FAILED');
    assert.ok((result.error.details ?? []).some((detail) => detail.includes('roomId is required')));
  }
});

test('five-and-half calibrate: 유효 샘플이면 calibrate_response를 반환한다', () => {
  const request = buildEnvelope('calibrate_request', {
    profileId: 'profile-a',
    strategy: 'ema',
    samples: [
      {
        predict: {
          baseAim: 18,
          correctedAim: 18.5,
          expectedThirdCushion: 32,
          confidence: 0.86,
        },
        simulate: {
          events: [],
          finalState: {},
          errorMetrics: {
            thirdCushionIndexDelta: 1.2,
            landingDistanceM: 0.14,
          },
        },
        success: true,
      },
    ],
  });

  const result = handleFiveAndHalfOperation('calibrate', request);
  assert.equal(result.ok, true);
  if (result.ok) {
    assert.equal(result.body.payloadType, 'calibrate_response');
    const payload = result.body.payload as Record<string, unknown>;
    assert.equal(payload.appliedSampleCount, 1);
  }
});

test('five-and-half calibrate: 샘플이 비어있으면 calibration 에러를 반환한다', () => {
  const request = buildEnvelope('calibrate_request', {
    profileId: 'profile-a',
    strategy: 'ema',
    samples: [],
  });

  const result = handleFiveAndHalfOperation('calibrate', request);
  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.error.errorCode, 'ERR_FAH_CALIBRATION_NOT_ENOUGH_SAMPLES');
  }
});
