import assert from 'node:assert/strict';

import { guestLogin } from '../../apps/game-server/src/auth/http.ts';

type AuthStateShape = {
  nextUserId: number;
  nextGuestId: number;
  usersByUsername: Map<string, { id: number; username: string; passwordHash: string }>;
};

async function run(): Promise<void> {
  const authState: AuthStateShape = {
    nextUserId: 1,
    nextGuestId: 1,
    usersByUsername: new Map(),
  };

  const requests = Array.from({ length: 6 }, (_, index) => {
    const nickname = `player-${index + 1}`;
    return Promise.resolve(guestLogin(authState, { nickname }));
  });

  const results = await Promise.all(requests);

  assert.equal(results.length, 6);
  assert.equal(results.every((result) => result.ok), true);

  const guestIds = results.flatMap((result) => (result.ok ? [result.guestId] : []));
  assert.equal(new Set(guestIds).size, 6);
  assert.deepEqual(guestIds, ['guest-1', 'guest-2', 'guest-3', 'guest-4', 'guest-5', 'guest-6']);

  console.log('6인 동시 접속 스모크 테스트 통과');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
