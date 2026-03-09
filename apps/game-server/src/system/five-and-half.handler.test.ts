import test from 'node:test';
import assert from 'node:assert/strict';
import { createServer } from 'node:http';

import { createFiveAndHalfRequestHandler } from './five-and-half.ts';

async function withServer(run: (baseUrl: string) => Promise<void>): Promise<void> {
  const handler = createFiveAndHalfRequestHandler();
  const server = createServer((req, res) => {
    void handler(req, res);
  });

  await new Promise<void>((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve());
  });

  const address = server.address();
  if (!address || typeof address === 'string') {
    server.close();
    throw new Error('failed to resolve test server address');
  }
  const baseUrl = `http://127.0.0.1:${address.port}`;

  try {
    await run(baseUrl);
  } finally {
    await new Promise<void>((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
}

test('five-and-half handler: OPTIONS preflight는 204를 반환한다', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/systems/five-and-half/predict`, { method: 'OPTIONS' });
    assert.equal(response.status, 204);
    assert.equal(response.headers.get('access-control-allow-methods'), 'POST,OPTIONS');
  });
});

test('five-and-half handler: POST invalid JSON이면 schema 에러를 반환한다', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/systems/five-and-half/predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: '{"schemaName"',
    });
    assert.equal(response.status, 400);
    const body = (await response.json()) as { errorCode?: string; details?: string[] };
    assert.equal(body.errorCode, 'ERR_FAH_SCHEMA_VALIDATION_FAILED');
    assert.ok(Array.isArray(body.details));
  });
});

test('five-and-half handler: GET 요청은 404를 반환한다', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/systems/five-and-half/predict`, { method: 'GET' });
    assert.equal(response.status, 404);
    const body = (await response.json()) as { errorCode?: string };
    assert.equal(body.errorCode, 'NOT_FOUND');
  });
});

test('five-and-half handler: predict 유효 요청이면 predict_response를 반환한다', async () => {
  await withServer(async (baseUrl) => {
    const response = await fetch(`${baseUrl}/v1/systems/five-and-half/predict`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        schemaName: 'five_and_half_api',
        schemaVersion: '1.0.0',
        payloadType: 'predict_request',
        payload: {
          tableProfile: {
            id: 'table-a',
            widthM: 2.84,
            heightM: 1.42,
            indexScale: 100,
            condition: 'normal',
          },
          layout: {
            cueBall: { x: 1.0, y: 0.3 },
            objectBall1: { x: 1.8, y: 0.7 },
            objectBall2: { x: 0.5, y: 1.0 },
          },
          intent: {
            routeType: 'five_and_half',
            targetThirdRail: 'long',
          },
        },
      }),
    });

    assert.equal(response.status, 200);
    const body = (await response.json()) as {
      payloadType?: string;
      payload?: { correctedAim?: number; expectedThirdCushion?: number };
    };
    assert.equal(body.payloadType, 'predict_response');
    assert.equal(typeof body.payload?.correctedAim, 'number');
    assert.equal(typeof body.payload?.expectedThirdCushion, 'number');
  });
});
