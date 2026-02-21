import test from 'node:test';
import assert from 'node:assert/strict';

import { addMemberToRoster, createRoomRoster } from './host-policy.ts';
import { executeKickCommand } from './kick-policy.ts';

test('비방장은 강퇴 명령을 실행할 수 없다', () => {
  const roster = createRoomRoster();
  addMemberToRoster(roster, 'host');
  addMemberToRoster(roster, 'u2');

  const result = executeKickCommand(roster, 'u2', 'host');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'ROOM_HOST_ONLY');
  }
});

test('방장은 다른 멤버를 강퇴하면 disconnect 이벤트가 생성된다', () => {
  const roster = createRoomRoster();
  addMemberToRoster(roster, 'host');
  addMemberToRoster(roster, 'u2');

  const result = executeKickCommand(roster, 'host', 'u2');

  assert.equal(result.ok, true);
  if (result.ok) {
    const eventTypes = result.events.map((event) => event.type);
    assert.deepEqual(eventTypes, ['MEMBER_KICKED', 'MEMBER_DISCONNECTED']);
  }
});

test('방장은 자기 자신을 강퇴할 수 없다', () => {
  const roster = createRoomRoster();
  addMemberToRoster(roster, 'host');

  const result = executeKickCommand(roster, 'host', 'host');

  assert.equal(result.ok, false);
  if (!result.ok) {
    assert.equal(result.errorCode, 'ROOM_CANNOT_KICK_SELF');
  }
});
