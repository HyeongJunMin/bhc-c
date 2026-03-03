import assert from 'node:assert/strict';

type JsonResult = {
  ok: boolean;
  status: number;
  data: any;
};

type SseEvent = {
  event: string;
  data: string;
};

async function requestJson(url: string, options?: RequestInit): Promise<JsonResult> {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return { ok: response.ok, status: response.status, data };
}

async function collectSseEvents(
  url: string,
  durationMs: number,
  filter: (event: SseEvent) => boolean,
): Promise<SseEvent[]> {
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
  const events: SseEvent[] = [];
  let buffer = '';
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
        const event = lines.find((line) => line.startsWith('event:'))?.slice(6).trim() ?? 'message';
        const data = lines
          .filter((line) => line.startsWith('data:'))
          .map((line) => line.slice(5).trim())
          .join('\n');
        const parsed = { event, data };
        if (filter(parsed)) {
          events.push(parsed);
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

  return events;
}

async function run(): Promise<void> {
  const baseUrl = process.env.QA_BASE_URL ?? 'http://localhost:9900';
  const targetEvents = ['shot_started', 'shot_resolved', 'turn_changed'];

  const hostId = 'qa-single-host';

  const created = await requestJson(`${baseUrl}/api/lobby/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'qa-single-room' }),
  });
  assert.equal(created.ok, true);
  const roomId = created.data.room.roomId as string;

  const joined = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ memberId: hostId, displayName: 'qa-single' }),
  });
  assert.equal(joined.ok, true);

  const streamPromise = collectSseEvents(
    `${baseUrl}/api/room-stream/${roomId}?memberId=${encodeURIComponent(hostId)}`,
    2000,
    (event) => targetEvents.includes(event.event),
  );
  await new Promise((resolve) => setTimeout(resolve, 150));

  const shot = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/shot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      actorMemberId: hostId,
      payload: {
        schemaName: 'shot_input',
        schemaVersion: '1.0.0',
        roomId,
        matchId: 'qa-match',
        turnId: 'qa-turn',
        playerId: hostId,
        clientTsMs: Date.now(),
        shotDirectionDeg: 120,
        cueElevationDeg: 10,
        dragPx: 300,
        impactOffsetX: 0,
        impactOffsetY: 0,
      },
    }),
  });
  assert.equal(shot.ok, true);

  const events = await streamPromise;
  const names = events.map((event) => event.event);
  const startedIndex = names.indexOf('shot_started');
  const resolvedIndex = names.indexOf('shot_resolved');
  const turnChangedIndex = names.indexOf('turn_changed');
  assert.ok(startedIndex >= 0);
  assert.ok(resolvedIndex > startedIndex);
  assert.ok(turnChangedIndex > resolvedIndex);

  console.log(`ROOM-QA-002A pass: roomId=${roomId}, events=${names.join(',')}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
