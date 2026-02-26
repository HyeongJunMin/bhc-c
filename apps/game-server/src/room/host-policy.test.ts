import test from 'node:test';
import assert from 'node:assert/strict';

import { addMemberToRoster, createRoomRoster, removeMemberAndCollectHostEvents } from './host-policy.ts';

test('host 이탈 시 HOST_TRANSFERRED 이벤트가 생성된다', () => {
  const roster = createRoomRoster();
  addMemberToRoster(roster, 'u1');
  addMemberToRoster(roster, 'u2');

  const result = removeMemberAndCollectHostEvents(roster, 'u1');

  assert.equal(result.roster.hostMemberId, 'u2');
  assert.equal(result.events.length, 1);
  assert.equal(result.events[0]?.type, 'HOST_TRANSFERRED');
  assert.equal(result.events[0]?.previousHostMemberId, 'u1');
  assert.equal(result.events[0]?.nextHostMemberId, 'u2');
});

test('비방장 이탈 시 host 이벤트는 생성되지 않는다', () => {
  const roster = createRoomRoster();
  addMemberToRoster(roster, 'u1');
  addMemberToRoster(roster, 'u2');

  const result = removeMemberAndCollectHostEvents(roster, 'u2');

  assert.equal(result.roster.hostMemberId, 'u1');
  assert.equal(result.events.length, 0);
});
