import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

type PngDimensions = {
  width: number;
  height: number;
};

function parsePngDimensions(buffer: Buffer): PngDimensions {
  const pngSignature = '89504e470d0a1a0a';
  assert.equal(buffer.subarray(0, 8).toString('hex'), pngSignature, 'PNG 시그니처가 아닙니다.');
  const ihdrType = buffer.subarray(12, 16).toString('ascii');
  assert.equal(ihdrType, 'IHDR', 'IHDR 청크를 찾지 못했습니다.');
  const width = buffer.readUInt32BE(16);
  const height = buffer.readUInt32BE(20);
  return { width, height };
}

async function checkLocalAssets(repoRoot: string): Promise<void> {
  const clothPath = resolve(repoRoot, 'apps/web/public/assets/table/cloth.png');
  const framePath = resolve(repoRoot, 'apps/web/public/assets/table/frame.png');

  const [clothBuffer, frameBuffer] = await Promise.all([readFile(clothPath), readFile(framePath)]);
  const cloth = parsePngDimensions(clothBuffer);
  const frame = parsePngDimensions(frameBuffer);

  assert.equal(cloth.width / cloth.height, 2, `cloth 비율이 2:1이 아닙니다. ${cloth.width}x${cloth.height}`);
  assert.equal(frame.width / frame.height, 2, `frame 비율이 2:1이 아닙니다. ${frame.width}x${frame.height}`);

  console.log(`ROOM-UI-005 local pass: cloth=${cloth.width}x${cloth.height}, frame=${frame.width}x${frame.height}`);
}

async function checkRenderSource(repoRoot: string): Promise<void> {
  const sourcePath = resolve(repoRoot, 'apps/web/src/main.ts');
  const source = await readFile(sourcePath, 'utf8');
  const frameDrawToken = "context.drawImage(\n        stageState.frameImage";
  const clothDrawToken = "context.drawImage(\n        stageState.clothImage";
  const frameDrawIndex = source.indexOf(frameDrawToken);
  const clothDrawIndex = source.indexOf(clothDrawToken);
  const frameSrcIndex = source.indexOf("frameImage.src = '/assets/table/frame.png'");
  const clothSrcIndex = source.indexOf("clothImage.src = '/assets/table/cloth.png'");
  const tableTopIndex = source.indexOf('table-top.png');

  assert.ok(frameDrawIndex >= 0, 'main.ts에 frameImage 렌더 코드가 없습니다.');
  assert.ok(clothDrawIndex >= 0, 'main.ts에 clothImage 렌더 코드가 없습니다.');
  assert.ok(frameDrawIndex < clothDrawIndex, 'main.ts 렌더 순서가 frame -> cloth가 아닙니다.');
  assert.ok(frameSrcIndex >= 0, 'main.ts에 frame.png 경로 설정이 없습니다.');
  assert.ok(clothSrcIndex >= 0, 'main.ts에 cloth.png 경로 설정이 없습니다.');
  assert.ok(frameSrcIndex < clothSrcIndex, 'main.ts 이미지 로드 순서가 frame -> cloth가 아닙니다.');
  assert.ok(tableTopIndex < 0, 'main.ts에 레거시 table-top.png 참조가 남아 있습니다.');

  console.log('ROOM-UI-005 source pass: frame->cloth render/load order verified');
}

async function checkHttpAssets(baseUrl: string): Promise<void> {
  const roomResponse = await fetch(`${baseUrl}/room/room-1`);
  assert.equal(roomResponse.ok, true, '/room/room-1 응답 실패');
  const html = await roomResponse.text();

  const frameIndex = html.indexOf('/assets/table/frame.png');
  const clothIndex = html.indexOf('/assets/table/cloth.png');
  const tableTopIndex = html.indexOf('/assets/table/table-top.png');
  assert.ok(frameIndex >= 0, 'room HTML에서 frame.png 참조를 찾지 못했습니다.');
  assert.ok(clothIndex >= 0, 'room HTML에서 cloth.png 참조를 찾지 못했습니다.');
  assert.ok(frameIndex < clothIndex, 'room HTML에서 frame 참조가 cloth보다 먼저 나오지 않습니다.');
  assert.ok(tableTopIndex < 0, 'room HTML에 레거시 table-top.png 참조가 남아 있습니다.');

  for (const name of ['frame.png', 'cloth.png']) {
    const response = await fetch(`${baseUrl}/assets/table/${name}`);
    assert.equal(response.ok, true, `/assets/table/${name} 응답 실패`);
    const contentType = response.headers.get('content-type') ?? '';
    assert.ok(contentType.includes('image/png'), `/assets/table/${name} content-type이 image/png가 아닙니다. ${contentType}`);
    const data = Buffer.from(await response.arrayBuffer());
    const dimensions = parsePngDimensions(data);
    assert.equal(dimensions.width / dimensions.height, 2, `${name} 비율이 2:1이 아닙니다. ${dimensions.width}x${dimensions.height}`);
  }

  console.log(`ROOM-UI-005 http pass: baseUrl=${baseUrl}`);
}

async function run(): Promise<void> {
  const scriptDir = resolve(fileURLToPath(new URL('.', import.meta.url)));
  const repoRoot = resolve(scriptDir, '../..');
  const modeArg = (process.argv.find((arg) => arg.startsWith('--mode=')) ?? '--mode=all').replace('--mode=', '');
  const mode = modeArg as 'local' | 'http' | 'all';
  assert.ok(['local', 'http', 'all'].includes(mode), `지원하지 않는 mode입니다: ${modeArg}`);

  if (mode === 'local' || mode === 'all') {
    await checkLocalAssets(repoRoot);
    await checkRenderSource(repoRoot);
  }
  if (mode === 'http' || mode === 'all') {
    const baseUrl = process.env.QA_BASE_URL;
    assert.ok(baseUrl, 'HTTP 검증 모드는 QA_BASE_URL 환경변수가 필요합니다.');
    await checkHttpAssets(baseUrl);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
