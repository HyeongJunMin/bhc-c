import assert from 'node:assert/strict';

type JsonResult = {
  ok: boolean;
  status: number;
  data: any;
};

type SnapshotSample = {
  seq: number;
  cueX: number;
  cueY: number;
};

async function requestJson(url: string, options?: RequestInit): Promise<JsonResult> {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function collectSnapshots(url: string, durationMs: number): Promise<SnapshotSample[]> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), durationMs);
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
  const snapshots: SnapshotSample[] = [];
  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) {
        break;
      }
      buffer += decoder.decode(value, { stream: true });
      let sep = buffer.indexOf('\n\n');
      while (sep >= 0) {
        const frame = buffer.slice(0, sep);
        buffer = buffer.slice(sep + 2);
        const lines = frame.split('\n');
        const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() ?? '';
        if (event === 'room_snapshot') {
          const dataLine = lines.find((line) => line.startsWith('data:'));
          if (dataLine) {
            const data = JSON.parse(dataLine.slice(5).trim());
            const cueBall = (data.balls as any[]).find((ball) => ball.id === 'cueBall');
            if (cueBall) {
              snapshots.push({
                seq: Number(data.seq),
                cueX: Number(cueBall.x),
                cueY: Number(cueBall.y),
              });
            }
          }
        }
        sep = buffer.indexOf('\n\n');
      }
    }
  } catch (error) {
    if (!(error instanceof Error) || error.name !== 'AbortError') {
      throw error;
    }
  } finally {
    clearTimeout(timer);
    reader.releaseLock();
  }

  return snapshots;
}

function assertMonotonicSeq(samples: SnapshotSample[]): void {
  for (let i = 1; i < samples.length; i += 1) {
    assert.ok(samples[i].seq > samples[i - 1].seq, `seq must increase: ${samples[i - 1].seq} -> ${samples[i].seq}`);
  }
}

async function run(): Promise<void> {
  const baseUrl = process.env.QA_BASE_URL ?? 'http://localhost:9900';
  const driftThreshold = 0.03075; // 공 반지름 1.0배

  const memberId = 'qa-drift-member';

  const created = await requestJson(`${baseUrl}/api/lobby/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'qa-drift-room' }),
  });
  assert.equal(created.ok, true);
  const roomId = created.data.room.roomId as string;

  const joined = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ memberId, displayName: 'qa-drift' }),
  });
  assert.equal(joined.ok, true);

  const streamUrl = `${baseUrl}/api/room-stream/${roomId}?memberId=${encodeURIComponent(memberId)}`;
  const [first, second] = await Promise.all([
    collectSnapshots(streamUrl, 1200),
    collectSnapshots(streamUrl, 1200),
  ]);

  assert.ok(first.length > 5);
  assert.ok(second.length > 5);
  assertMonotonicSeq(first);
  assertMonotonicSeq(second);

  const secondBySeq = new Map(second.map((sample) => [sample.seq, sample]));
  const overlaps = first
    .map((sample) => {
      const matched = secondBySeq.get(sample.seq);
      if (!matched) {
        return null;
      }
      return Math.hypot(sample.cueX - matched.cueX, sample.cueY - matched.cueY);
    })
    .filter((value): value is number => typeof value === 'number');

  assert.ok(overlaps.length >= 3);
  const maxDrift = Math.max(...overlaps);
  assert.ok(maxDrift <= driftThreshold, `max drift ${maxDrift} exceeded threshold ${driftThreshold}`);

  console.log(`ROOM-QA-002B pass: roomId=${roomId}, overlap=${overlaps.length}, maxDrift=${maxDrift.toFixed(6)}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
