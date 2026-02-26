import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type Viewport = { width: number; height: number; offsetX: number; offsetY: number };

function parseConst(source: string, pattern: RegExp): number {
  const raw = source.match(pattern)?.[1];
  assert.ok(raw, `상수 추출 실패: ${pattern}`);
  return Number(raw);
}

function computeViewport(contentWidth: number, contentHeight: number, tableWidthM: number, tableHeightM: number): Viewport {
  const tableAspect = tableWidthM / tableHeightM;
  const contentAspect = contentWidth / contentHeight;
  if (contentAspect > tableAspect) {
    const height = contentHeight;
    return {
      width: contentHeight * tableAspect,
      height,
      offsetX: (contentWidth - contentHeight * tableAspect) / 2,
      offsetY: 0,
    };
  }
  const width = contentWidth;
  return {
    width,
    height: contentWidth / tableAspect,
    offsetX: 0,
    offsetY: (contentHeight - contentWidth / tableAspect) / 2,
  };
}

async function run(): Promise<void> {
  const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
  const repoRoot = resolve(scriptDir, '../..');
  const source = await readFile(resolve(repoRoot, 'apps/web/src/main.ts'), 'utf8');
  const tableWidthM = parseConst(source, /const TABLE_WORLD_WIDTH_M = ([0-9.]+);/);
  const tableHeightM = parseConst(source, /const TABLE_WORLD_HEIGHT_M = ([0-9.]+);/);

  const viewports = [
    { w: 360, h: 780, label: 'mobile-portrait' },
    { w: 780, h: 360, label: 'mobile-landscape' },
    { w: 1366, h: 768, label: 'desktop' },
    { w: 1024, h: 1024, label: 'square' },
  ];

  for (const entry of viewports) {
    const vp = computeViewport(entry.w, entry.h, tableWidthM, tableHeightM);
    const ratio = vp.width / vp.height;
    assert.ok(Math.abs(ratio - 2) < 1e-9, `${entry.label} 뷰포트 비율이 2:1이 아닙니다. ratio=${ratio}`);
    assert.ok(vp.offsetX >= 0 && vp.offsetY >= 0, `${entry.label} 오프셋이 음수입니다.`);
    assert.ok(vp.width <= entry.w + 1e-9 && vp.height <= entry.h + 1e-9, `${entry.label} 뷰포트가 컨테이너를 초과합니다.`);
  }

  console.log(`ROOM-UI-005G pass: responsive 2:1 viewport verified (${viewports.length} cases)`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
