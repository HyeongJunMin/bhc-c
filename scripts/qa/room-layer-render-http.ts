import assert from 'node:assert/strict';

async function run(): Promise<void> {
  const baseUrl = process.env.QA_BASE_URL;
  assert.ok(baseUrl, 'QA_BASE_URL 환경변수가 필요합니다.');

  const response = await fetch(`${baseUrl}/room/room-1`);
  assert.equal(response.ok, true, '/room/room-1 응답 실패');
  const html = await response.text();

  const renderStageFrameStart = html.indexOf('function renderStageFrame()');
  const renderStageFrameEnd = html.indexOf('function runStageRenderLoop()');
  assert.ok(renderStageFrameStart >= 0 && renderStageFrameEnd > renderStageFrameStart, 'renderStageFrame 함수 블록을 찾지 못했습니다.');
  const renderStageFrameBlock = html.slice(renderStageFrameStart, renderStageFrameEnd);

  const frameDrawToken = "context.drawImage(\n        stageState.frameImage";
  const clothDrawToken = "context.drawImage(\n        stageState.clothImage";
  const ballsDrawToken = 'renderInterpolatedBalls();';

  const frameIndex = renderStageFrameBlock.indexOf(frameDrawToken);
  const clothIndex = renderStageFrameBlock.indexOf(clothDrawToken);
  const ballsIndex = renderStageFrameBlock.indexOf(ballsDrawToken);

  assert.ok(frameIndex >= 0, 'room HTML에서 frame draw 토큰을 찾지 못했습니다.');
  assert.ok(clothIndex >= 0, 'room HTML에서 cloth draw 토큰을 찾지 못했습니다.');
  assert.ok(ballsIndex >= 0, 'room HTML에서 drawBalls 토큰을 찾지 못했습니다.');
  assert.ok(frameIndex < clothIndex, '렌더 순서가 frame -> cloth가 아닙니다.');
  assert.ok(clothIndex < ballsIndex, '렌더 순서가 cloth -> balls가 아닙니다.');

  console.log(`ROOM-UI-005F pass: baseUrl=${baseUrl}, order=frame->cloth->balls`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
