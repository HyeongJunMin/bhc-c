import assert from 'node:assert/strict';

type JsonResult = {
  ok: boolean;
  status: number;
  data: any;
};

async function requestJson(url: string, options?: RequestInit): Promise<JsonResult> {
  const response = await fetch(url, options);
  const data = await response.json().catch(() => ({}));
  return {
    ok: response.ok,
    status: response.status,
    data,
  };
}

async function run(): Promise<void> {
  const baseUrl = process.env.QA_BASE_URL ?? 'http://localhost:9213';

  const guest1 = await requestJson(`${baseUrl}/api/auth/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nickname: 'e2e-host' }),
  });
  assert.equal(guest1.ok, true);
  const hostId = guest1.data.guestId as string;

  const guest2 = await requestJson(`${baseUrl}/api/auth/guest`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ nickname: 'e2e-guest' }),
  });
  assert.equal(guest2.ok, true);
  const guestId = guest2.data.guestId as string;

  const created = await requestJson(`${baseUrl}/api/lobby/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ title: 'e2e-room' }),
  });
  assert.equal(created.ok, true);
  const roomId = created.data.room.roomId as string;

  const joinHost = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ memberId: hostId, displayName: 'e2e-host' }),
  });
  assert.equal(joinHost.ok, true);

  const joinGuest = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ memberId: guestId, displayName: 'e2e-guest' }),
  });
  assert.equal(joinGuest.ok, true);

  const started = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/start`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ actorMemberId: hostId }),
  });
  assert.equal(started.ok, true);
  assert.equal(started.data.room.state, 'IN_GAME');

  const chatSend = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/chat`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ senderMemberId: hostId, message: 'hello-e2e' }),
  });
  assert.equal(chatSend.ok, true);

  const chatList = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/chat`, {
    method: 'GET',
  });
  assert.equal(chatList.ok, true);
  assert.equal(Array.isArray(chatList.data.items), true);
  assert.equal(chatList.data.items.length > 0, true);

  const shotInvalid = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/shot`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      actorMemberId: hostId,
      payload: { schemaName: 'shot_input' },
    }),
  });
  assert.equal(shotInvalid.ok, false);
  assert.equal(shotInvalid.data.errorCode, 'SHOT_INPUT_SCHEMA_INVALID');

  const shotValid = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/shot`, {
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
  assert.equal(shotValid.ok, true);
  assert.equal(shotValid.data.accepted, true);

  const kicked = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}/kick`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      actorMemberId: hostId,
      targetMemberId: guestId,
    }),
  });
  assert.equal(kicked.ok, true);
  assert.equal(kicked.data.room.playerCount, 1);

  const detail = await requestJson(`${baseUrl}/api/lobby/rooms/${roomId}`, { method: 'GET' });
  assert.equal(detail.ok, true);
  assert.equal(detail.data.room.playerCount, 1);

  console.log(`QA-E2E-001 pass: roomId=${roomId}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

