import assert from 'node:assert/strict';

type JsonResult = {
  ok: boolean;
  status: number;
  data: any;
};

async function requestJson(url: string, options?: RequestInit): Promise<JsonResult> {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function waitFirstSnapshotEvent(url: string, timeoutMs: number): Promise<number> {
  const startedAt = Date.now();
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const response = await fetch(url, {
    method: 'GET',
    headers: { accept: 'text/event-stream' },
    signal: controller.signal,
  });
  assert.equal(response.ok, true);
  assert.ok(response.body);

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      if (buffer.includes('event: room_snapshot')) {
        return Date.now() - startedAt;
      }
    }
  } finally {
    clearTimeout(timer);
    reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
  throw new Error('room_snapshot not received');
}

async function run(): Promise<void> {
  const baseUrl = process.env.QA_BASE_URL ?? 'http://localhost:9213';

  const memberId = 'qa-recovery-member';

  const created = await requestJson(`${baseUrl}/api/lobby/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'qa-recover' }),
  });
  assert.equal(created.ok, true);
  const roomId = created.data.room.roomId as string;

  const joined = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ memberId, displayName: 'qa-recovery' }),
  });
  assert.equal(joined.ok, true);

  const streamUrl = `${baseUrl}/api/room-stream/${roomId}?memberId=${encodeURIComponent(memberId)}`;
  const firstConnectMs = await waitFirstSnapshotEvent(streamUrl, 3000);
  assert.ok(firstConnectMs <= 3000);

  // fallback polling check (스트림 단절 가정 시에도 상태 조회가 가능한지 확인)
  const poll1 = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}`, { method: 'GET' });
  const poll2 = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}`, { method: 'GET' });
  assert.equal(poll1.ok, true);
  assert.equal(poll2.ok, true);

  const recoveryMs = await waitFirstSnapshotEvent(streamUrl, 3000);
  assert.ok(recoveryMs <= 3000, `recovery exceeded 3000ms: ${recoveryMs}`);

  console.log(`ROOM-QA-002C pass: roomId=${roomId}, first=${firstConnectMs}ms, recovery=${recoveryMs}ms`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
