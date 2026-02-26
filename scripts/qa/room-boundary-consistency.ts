import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Constants = {
  tableWidthM: number;
  tableHeightM: number;
  ballRadiusM: number;
};

type Viewport = {
  width: number;
  height: number;
  offsetX: number;
  offsetY: number;
};

function parseNumberExpression(expression: string): number {
  const normalized = expression.replace(/\s+/g, '');
  if (/^[0-9.]+$/.test(normalized)) {
    return Number(normalized);
  }
  const divideMatch = normalized.match(/^([0-9.]+)\/([0-9.]+)$/);
  if (divideMatch) {
    return Number(divideMatch[1]) / Number(divideMatch[2]);
  }
  throw new Error(`지원하지 않는 숫자 표현식입니다: ${expression}`);
}

function extractConstants(source: string, patterns: { tableWidth: RegExp; tableHeight: RegExp; ballRadius: RegExp }): Constants {
  const tableWidthRaw = source.match(patterns.tableWidth)?.[1];
  const tableHeightRaw = source.match(patterns.tableHeight)?.[1];
  const ballRadiusRaw = source.match(patterns.ballRadius)?.[1];
  assert.ok(tableWidthRaw && tableHeightRaw && ballRadiusRaw, '상수 추출에 실패했습니다.');
  return {
    tableWidthM: parseNumberExpression(tableWidthRaw),
    tableHeightM: parseNumberExpression(tableHeightRaw),
    ballRadiusM: parseNumberExpression(ballRadiusRaw),
  };
}

function computeViewport(contentWidth: number, contentHeight: number, tableWidthM: number, tableHeightM: number): Viewport {
  const tableAspect = tableWidthM / tableHeightM;
  const contentAspect = contentWidth / contentHeight;
  if (contentAspect > tableAspect) {
    const height = contentHeight;
    const width = contentHeight * tableAspect;
    return {
      width,
      height,
      offsetX: (contentWidth - width) / 2,
      offsetY: 0,
    };
  }
  const width = contentWidth;
  const height = contentWidth / tableAspect;
  return {
    width,
    height,
    offsetX: 0,
    offsetY: (contentHeight - height) / 2,
  };
}

function worldToCanvas(x: number, y: number, viewport: Viewport, tableWidthM: number, tableHeightM: number): { x: number; y: number } {
  return {
    x: viewport.offsetX + (x / tableWidthM) * viewport.width,
    y: viewport.offsetY + (y / tableHeightM) * viewport.height,
  };
}

function canvasToWorld(x: number, y: number, viewport: Viewport, tableWidthM: number, tableHeightM: number): { x: number; y: number } {
  const nx = (x - viewport.offsetX) / viewport.width;
  const ny = (y - viewport.offsetY) / viewport.height;
  const clampedX = Math.max(0, Math.min(tableWidthM, nx * tableWidthM));
  const clampedY = Math.max(0, Math.min(tableHeightM, ny * tableHeightM));
  return { x: clampedX, y: clampedY };
}

function nearlyEqual(a: number, b: number, eps = 1e-6): boolean {
  return Math.abs(a - b) <= eps;
}

async function run(): Promise<void> {
  const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
  const repoRoot = resolve(scriptDir, '../..');
  const webSource = await readFile(resolve(repoRoot, 'apps/web/src/main.ts'), 'utf8');
  const gameSource = await readFile(resolve(repoRoot, 'apps/game-server/src/lobby/http.ts'), 'utf8');

  const web = extractConstants(webSource, {
    tableWidth: /const TABLE_WORLD_WIDTH_M = ([^;]+);/,
    tableHeight: /const TABLE_WORLD_HEIGHT_M = ([^;]+);/,
    ballRadius: /const cueBallRadiusM = ([^;]+);/,
  });
  const game = extractConstants(gameSource, {
    tableWidth: /const TABLE_WIDTH_M = ([^;]+);/,
    tableHeight: /const TABLE_HEIGHT_M = ([^;]+);/,
    ballRadius: /const BALL_RADIUS_M = ([^;]+);/,
  });

  assert.ok(nearlyEqual(web.tableWidthM, game.tableWidthM), `테이블 너비 상수가 다릅니다. web=${web.tableWidthM}, game=${game.tableWidthM}`);
  assert.ok(nearlyEqual(web.tableHeightM, game.tableHeightM), `테이블 높이 상수가 다릅니다. web=${web.tableHeightM}, game=${game.tableHeightM}`);
  assert.ok(nearlyEqual(web.ballRadiusM, game.ballRadiusM), `공 반지름 상수가 다릅니다. web=${web.ballRadiusM}, game=${game.ballRadiusM}`);

  const samples = [
    { w: 960, h: 480 },
    { w: 1280, h: 720 },
    { w: 390, h: 844 },
    { w: 844, h: 390 },
    { w: 800, h: 800 },
  ];

  for (const sample of samples) {
    const viewport = computeViewport(sample.w, sample.h, web.tableWidthM, web.tableHeightM);
    const ratio = viewport.width / viewport.height;
    assert.ok(nearlyEqual(ratio, 2, 1e-9), `뷰포트 비율이 2:1이 아닙니다. ${sample.w}x${sample.h}, ratio=${ratio}`);

    const minX = web.ballRadiusM;
    const maxX = web.tableWidthM - web.ballRadiusM;
    const minY = web.ballRadiusM;
    const maxY = web.tableHeightM - web.ballRadiusM;
    const points = [
      { x: minX, y: minY },
      { x: maxX, y: minY },
      { x: minX, y: maxY },
      { x: maxX, y: maxY },
      { x: web.tableWidthM / 2, y: web.tableHeightM / 2 },
    ];

    const radiusPx = (web.ballRadiusM / web.tableWidthM) * viewport.width;
    for (const point of points) {
      const canvas = worldToCanvas(point.x, point.y, viewport, web.tableWidthM, web.tableHeightM);
      assert.ok(canvas.x - radiusPx >= viewport.offsetX - 1e-6, '좌측 경계 가시 범위를 벗어났습니다.');
      assert.ok(canvas.x + radiusPx <= viewport.offsetX + viewport.width + 1e-6, '우측 경계 가시 범위를 벗어났습니다.');
      assert.ok(canvas.y - radiusPx >= viewport.offsetY - 1e-6, '상단 경계 가시 범위를 벗어났습니다.');
      assert.ok(canvas.y + radiusPx <= viewport.offsetY + viewport.height + 1e-6, '하단 경계 가시 범위를 벗어났습니다.');

      const roundTrip = canvasToWorld(canvas.x, canvas.y, viewport, web.tableWidthM, web.tableHeightM);
      assert.ok(nearlyEqual(roundTrip.x, point.x, 1e-6) && nearlyEqual(roundTrip.y, point.y, 1e-6), 'world<->canvas 역변환 오차가 큽니다.');
    }
  }

  console.log(`ROOM-UI-005E pass: constants sync + boundary visibility + resize ratio checks (${samples.length} viewports)`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
