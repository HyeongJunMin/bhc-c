import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { paginateRooms } from './pagination.ts';
import { compareRoomsForLobby } from './sort-rooms.ts';
import { validateRoomTitle } from './validate-room-title.ts';
import { evaluateRoomJoin } from '../room/join-policy.ts';
import { startGameRequest } from '../game/start-policy.ts';
import { transitionShotLifecycleState, type ShotLifecycleState } from '../game/shot-state-machine.ts';
import { serializeRoomSnapshot, type SnapshotBallFrame } from '../game/snapshot-serializer.ts';
import { applyCushionContactThrow } from '../game/cushion-contact-throw.ts';
import { handleShotInputEntry } from '../input/shot-input-entry.ts';
import { evaluateChatRateLimit, recordLastChatSentAt, type UserLastSentAtStore } from '../chat/rate-limit.ts';
import { increaseScoreAndCheckGameEnd } from '../game/score-policy.ts';
import { applyBallSurfaceFriction } from '../../../../packages/physics-core/src/ball-surface-friction.ts';
import { applyBallBallCollisionWithSpin } from '../../../../packages/physics-core/src/ball-ball-collision.ts';
import { computeShotInitialization } from '../../../../packages/physics-core/src/shot-init.ts';
import {
  evaluateShotEndWithFrames,
  initShotEndTracker,
  type ShotEndTracker,
} from '../../../../packages/physics-core/src/shot-end.ts';
import {
  BALL_BALL_RESTITUTION,
  BALL_MASS_KG,
  BALL_RADIUS_M,
  CUSHION_CONTACT_FRICTION_COEFFICIENT,
  CUSHION_CONTACT_REFERENCE_SPEED_MPS,
  CUSHION_CONTACT_TIME_EXPONENT,
  CUSHION_HEIGHT_M,
  CUSHION_MAX_SPIN_MAGNITUDE,
  CUSHION_MAX_THROW_ANGLE_DEG,
  CUSHION_RESTITUTION,
  MAX_BALL_SPEED_MPS,
  TABLE_HEIGHT_M,
  TABLE_WIDTH_M,
} from '../../../../packages/physics-core/src/constants.ts';
import { computeSquirtAngleRad } from '../../../../packages/physics-core/src/squirt.ts';

const ROOM_SNAPSHOT_BROADCAST_INTERVAL_MS = 50;
const TURN_DURATION_MS = 10_000;
const DISCONNECT_GRACE_MS = 10_000;
const PHYSICS_DT_SEC = ROOM_SNAPSHOT_BROADCAST_INTERVAL_MS / 1000;
const PHYSICS_SUBSTEPS = 4;
const STREAM_HEARTBEAT_INTERVAL_MS = 15_000;
const REDIS_STATE_VERSION = 1;
const REDIS_LOBBY_STATE_KEY = process.env.UPSTASH_LOBBY_STATE_KEY || 'bhc:lobby:state:v1';
const UPSTASH_REDIS_REST_URL = process.env.UPSTASH_REDIS_REST_URL || '';
const UPSTASH_REDIS_REST_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN || '';

type LobbyRoom = {
  roomId: string;
  title: string;
  state: 'WAITING' | 'IN_GAME' | 'FINISHED';
  playerCount: number;
  createdAt: string;
  hostMemberId: string | null;
  members: Array<{
    memberId: string;
    displayName: string;
    joinedAt: string;
  }>;
  chatMessages: Array<{
    senderMemberId: string;
    message: string;
    sentAt: string;
  }>;
  shotState: ShotLifecycleState;
  scoreBoard: Record<string, number>;
  currentTurnIndex: number;
  turnDeadlineMs: number | null;
  winnerMemberId: string | null;
  memberGameStates: Record<string, 'IN_ROOM' | 'PLAYING' | 'WIN' | 'LOSE' | 'KICKED'>;
  balls: SnapshotBallFrame[];
  shotEndTracker: ShotEndTracker;
};

type LobbyState = {
  nextRoomId: number;
  rooms: LobbyRoom[];
  roomStreamSeqByRoomId: Record<string, number>;
  roomStreamSubscribers: Record<string, Set<ServerResponse>>;
  shotStateResetTimers: Record<string, ReturnType<typeof setTimeout> | null>;
  disconnectGraceTimers: Record<string, ReturnType<typeof setTimeout> | null>;
  userLastChatSentAtByRoomAndMember: UserLastSentAtStore;
};

type CreateRoomResult =
  | { ok: true; room: LobbyRoom }
  | { ok: false; statusCode: 400; errorCode: 'ROOM_TITLE_REQUIRED' | 'ROOM_TITLE_TOO_LONG' };

type JoinRoomResult =
  | { ok: true; room: LobbyRoom }
  | { ok: false; statusCode: 404 | 409; errorCode: 'ROOM_NOT_FOUND' | 'ROOM_FULL' | 'ROOM_IN_GAME' };

type RoomDetailResult = { ok: true; room: LobbyRoom } | { ok: false; statusCode: 404; errorCode: 'ROOM_NOT_FOUND' };
type RoomActionResult =
  | { ok: true; room: LobbyRoom }
  | {
      ok: false;
      statusCode: 400 | 404 | 409;
      errorCode:
        | 'ROOM_NOT_FOUND'
        | 'ROOM_HOST_ONLY'
        | 'ROOM_MEMBER_NOT_FOUND'
        | 'ROOM_CANNOT_KICK_SELF'
        | 'GAME_ALREADY_STARTED'
        | 'GAME_NOT_ENOUGH_PLAYERS';
    };
type RoomChatResult =
  | { ok: true; room: LobbyRoom }
  | {
      ok: false;
      statusCode: 400 | 404 | 429;
      errorCode: 'ROOM_NOT_FOUND' | 'ROOM_MEMBER_NOT_FOUND' | 'CHAT_INVALID_INPUT' | 'CHAT_RATE_LIMITED';
      retryAfterMs?: number;
    };
type ShotSubmitResult =
  | { ok: true; payload: Record<string, unknown> }
  | {
      ok: false;
      statusCode: 400 | 404 | 409;
      errorCode: 'ROOM_NOT_FOUND' | 'ROOM_MEMBER_NOT_FOUND' | 'SHOT_INPUT_SCHEMA_INVALID' | 'SHOT_STATE_CONFLICT';
      errors?: string[];
    };
type RoomStreamOpenResult =
  | {
      ok: true;
      room: LobbyRoom;
      snapshot: {
        roomId: string;
        seq: number;
        serverTimeMs: number;
        state: LobbyRoom['state'];
        turn: { currentMemberId: string | null; turnDeadlineMs: number | null };
        scoreBoard: Record<string, number>;
        balls: Array<{
          id: 'cueBall' | 'objectBall1' | 'objectBall2';
          x: number;
          y: number;
          vx: number;
          vy: number;
          spinX: number;
          spinY: number;
          spinZ: number;
          motionState: 'SLIDING' | 'ROLLING' | 'SPINNING' | 'STATIONARY';
          isPocketed: boolean;
        }>;
      };
    }
  | { ok: false; statusCode: 400 | 403 | 404; errorCode: 'ROOM_NOT_FOUND' | 'ROOM_MEMBER_ID_REQUIRED' | 'ROOM_STREAM_FORBIDDEN' };

type ListRoomsResult = {
  items: LobbyRoom[];
  hasMore: boolean;
  nextOffset: number;
};

type PersistedLobbyState = {
  version: number;
  nextRoomId: number;
  rooms: LobbyRoom[];
  roomStreamSeqByRoomId: Record<string, number>;
  userLastChatSentAtEntries: Array<[string, number]>;
};

let stateHydrationPromise: Promise<void> | null = null;
let pendingPersistState: PersistedLobbyState | null = null;
let persistInFlight = false;

function isRedisPersistenceEnabled(): boolean {
  return UPSTASH_REDIS_REST_URL.length > 0 && UPSTASH_REDIS_REST_TOKEN.length > 0;
}

async function upstashGetRawState(): Promise<string | null> {
  const response = await fetch(
    `${UPSTASH_REDIS_REST_URL}/get/${encodeURIComponent(REDIS_LOBBY_STATE_KEY)}`,
    {
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    },
  );
  if (!response.ok) {
    return null;
  }
  const payload = (await response.json()) as { result?: string | null };
  return typeof payload.result === 'string' ? payload.result : null;
}

async function upstashSetRawState(rawState: string): Promise<void> {
  await fetch(
    `${UPSTASH_REDIS_REST_URL}/set/${encodeURIComponent(REDIS_LOBBY_STATE_KEY)}/${encodeURIComponent(rawState)}`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${UPSTASH_REDIS_REST_TOKEN}`,
      },
    },
  );
}

function snapshotLobbyState(state: LobbyState): PersistedLobbyState {
  return {
    version: REDIS_STATE_VERSION,
    nextRoomId: state.nextRoomId,
    rooms: state.rooms,
    roomStreamSeqByRoomId: state.roomStreamSeqByRoomId,
    userLastChatSentAtEntries: [...state.userLastChatSentAtByRoomAndMember.entries()],
  };
}

function applyPersistedState(state: LobbyState, persisted: PersistedLobbyState): void {
  if (persisted.version !== REDIS_STATE_VERSION) {
    return;
  }
  state.nextRoomId = Number.isInteger(persisted.nextRoomId) ? persisted.nextRoomId : 1;
  state.rooms = Array.isArray(persisted.rooms) ? persisted.rooms : [];
  state.roomStreamSeqByRoomId =
    persisted.roomStreamSeqByRoomId && typeof persisted.roomStreamSeqByRoomId === 'object'
      ? persisted.roomStreamSeqByRoomId
      : {};
  state.userLastChatSentAtByRoomAndMember = new Map(
    Array.isArray(persisted.userLastChatSentAtEntries) ? persisted.userLastChatSentAtEntries : [],
  );
  state.roomStreamSubscribers = {};
  state.shotStateResetTimers = {};
  state.disconnectGraceTimers = {};
  for (const room of state.rooms) {
    room.shotEndTracker = initShotEndTracker();
    room.balls = Array.isArray(room.balls)
      ? room.balls.map((ball) => ({
          ...ball,
          motionState: ball.motionState ?? 'STATIONARY',
        }))
      : createInitialRoomBalls();
    state.roomStreamSubscribers[room.roomId] = new Set<ServerResponse>();
    state.shotStateResetTimers[room.roomId] = null;
  }
}

async function ensureLobbyStateHydrated(state: LobbyState): Promise<void> {
  if (!isRedisPersistenceEnabled()) {
    return;
  }
  if (stateHydrationPromise) {
    await stateHydrationPromise;
    return;
  }
  stateHydrationPromise = (async () => {
    try {
      const rawState = await upstashGetRawState();
      if (!rawState) {
        return;
      }
      const parsed = JSON.parse(rawState) as PersistedLobbyState;
      applyPersistedState(state, parsed);
    } catch {
      // Ignore hydration failure and continue with in-memory defaults.
    }
  })();
  await stateHydrationPromise;
}

async function persistLobbyState(state: LobbyState): Promise<void> {
  if (!isRedisPersistenceEnabled()) {
    return;
  }
  pendingPersistState = snapshotLobbyState(state);
  if (persistInFlight) {
    return;
  }
  persistInFlight = true;
  while (pendingPersistState) {
    const nextState = pendingPersistState;
    pendingPersistState = null;
    try {
      await upstashSetRawState(JSON.stringify(nextState));
    } catch {
      // Ignore persistence failures in PoC mode.
    }
  }
  persistInFlight = false;
}

function readBody(req: IncomingMessage): Promise<string> {
  return new Promise((resolve, reject) => {
    let data = '';
    req.setEncoding('utf8');
    req.on('data', (chunk) => {
      data += chunk;
    });
    req.on('end', () => resolve(data));
    req.on('error', reject);
  });
}

function getCurrentTurnMemberId(room: LobbyRoom): string | null {
  if (room.members.length === 0) {
    return null;
  }
  if (room.currentTurnIndex < 0 || room.currentTurnIndex >= room.members.length) {
    room.currentTurnIndex = 0;
  }
  return room.members[room.currentTurnIndex]?.memberId ?? null;
}

function initializeRoomGameRuntime(room: LobbyRoom): void {
  room.scoreBoard = room.members.reduce<Record<string, number>>((acc, member) => {
    acc[member.memberId] = 0;
    return acc;
  }, {});
  room.currentTurnIndex = 0;
  room.turnDeadlineMs = room.members.length > 0 ? Date.now() + TURN_DURATION_MS : null;
  room.winnerMemberId = null;
  room.memberGameStates = room.members.reduce<Record<string, 'PLAYING'>>((acc, member) => {
    acc[member.memberId] = 'PLAYING';
    return acc;
  }, {});
  room.balls = createInitialRoomBalls();
  room.shotEndTracker = initShotEndTracker();
}

function createInitialRoomBalls(): SnapshotBallFrame[] {
  return [
    {
      id: 'cueBall',
      x: 0.70,
      y: 0.71,
      vx: 0,
      vy: 0,
      spinX: 0,
      spinY: 0,
      spinZ: 0,
      motionState: 'STATIONARY',
      isPocketed: false,
    },
    {
      id: 'objectBall1',
      x: 2.10,
      y: 0.62,
      vx: 0,
      vy: 0,
      spinX: 0,
      spinY: 0,
      spinZ: 0,
      motionState: 'STATIONARY',
      isPocketed: false,
    },
    {
      id: 'objectBall2',
      x: 2.24,
      y: 0.80,
      vx: 0,
      vy: 0,
      spinX: 0,
      spinY: 0,
      spinZ: 0,
      motionState: 'STATIONARY',
      isPocketed: false,
    },
  ];
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

// Server snapshot contract keeps `y`, but runtime physics treats it as table-plane `z`.
function getBallZ(ball: SnapshotBallFrame): number {
  return ball.y;
}

function setBallZ(ball: SnapshotBallFrame, z: number): void {
  ball.y = z;
}

function getBallVz(ball: SnapshotBallFrame): number {
  return ball.vy;
}

function setBallVz(ball: SnapshotBallFrame, vz: number): void {
  ball.vy = vz;
}

function applyShotToRoomBalls(room: LobbyRoom, payload: Record<string, unknown>): void {
  const cueBall = room.balls.find((ball) => ball.id === 'cueBall');
  if (!cueBall) {
    return;
  }
  const directionDeg = Number(payload.shotDirectionDeg);
  const dragPx = Number(payload.dragPx);
  const impactOffsetXRatio = clampNumber(Number(payload.impactOffsetX), -0.9, 0.9);
  const impactOffsetYRatio = clampNumber(Number(payload.impactOffsetY), -0.9, 0.9);
  const impactOffsetX = impactOffsetXRatio * BALL_RADIUS_M;
  const impactOffsetY = impactOffsetYRatio * BALL_RADIUS_M;
  const initialization = computeShotInitialization({
    dragPx,
    impactOffsetX,
    impactOffsetY,
  });

  const directionRad = (directionDeg * Math.PI) / 180;
  const squirtAngleRad = computeSquirtAngleRad({
    impactOffsetX,
    ballRadiusM: BALL_RADIUS_M,
  });
  const finalDirectionRad = directionRad - squirtAngleRad;

  cueBall.vx = Math.cos(finalDirectionRad) * initialization.initialBallSpeedMps;
  // Runtime plane is XZ; `vy` stores z-axis planar velocity in snapshot schema.
  cueBall.vy = Math.sin(finalDirectionRad) * initialization.initialBallSpeedMps;
  cueBall.spinX = initialization.omegaX;
  cueBall.spinY = 0;
  cueBall.spinZ = initialization.omegaZ;
  cueBall.motionState = 'SLIDING';
  room.shotEndTracker = initShotEndTracker();
}

function stepRoomPhysics(room: LobbyRoom): void {
  const substepDtSec = PHYSICS_DT_SEC / PHYSICS_SUBSTEPS;
  for (let step = 0; step < PHYSICS_SUBSTEPS; step += 1) {
    const prevPositions = room.balls.map((ball) => ({ x: ball.x, z: getBallZ(ball) }));
    for (const ball of room.balls) {
      if (ball.isPocketed) {
        continue;
      }
      let x = ball.x;
      let z = getBallZ(ball);
      let vx = ball.vx;
      let vz = getBallVz(ball);
      let spinX = ball.spinX;
      let spinY = ball.spinY;
      let spinZ = ball.spinZ;

      x += vx * substepDtSec;
      z += vz * substepDtSec;

      if (x <= BALL_RADIUS_M || x >= TABLE_WIDTH_M - BALL_RADIUS_M) {
        x = clampNumber(x, BALL_RADIUS_M, TABLE_WIDTH_M - BALL_RADIUS_M);
        const collision = applyCushionContactThrow({
          axis: 'x',
          vx,
          vy: vz,
          spinX,
          spinY,
          spinZ,
          restitution: CUSHION_RESTITUTION,
          contactFriction: CUSHION_CONTACT_FRICTION_COEFFICIENT,
          referenceNormalSpeedMps: CUSHION_CONTACT_REFERENCE_SPEED_MPS,
          contactTimeExponent: CUSHION_CONTACT_TIME_EXPONENT,
          maxSpinMagnitude: CUSHION_MAX_SPIN_MAGNITUDE,
          maxThrowAngleDeg: CUSHION_MAX_THROW_ANGLE_DEG,
          ballMassKg: BALL_MASS_KG,
          ballRadiusM: BALL_RADIUS_M,
          cushionHeightM: CUSHION_HEIGHT_M,
        });
        vx = collision.vx;
        vz = collision.vy;
        spinX = collision.spinX;
        spinY = collision.spinY;
        spinZ = collision.spinZ;
      }
      if (z <= BALL_RADIUS_M || z >= TABLE_HEIGHT_M - BALL_RADIUS_M) {
        z = clampNumber(z, BALL_RADIUS_M, TABLE_HEIGHT_M - BALL_RADIUS_M);
        const collision = applyCushionContactThrow({
          axis: 'y',
          vx,
          vy: vz,
          spinX,
          spinY,
          spinZ,
          restitution: CUSHION_RESTITUTION,
          contactFriction: CUSHION_CONTACT_FRICTION_COEFFICIENT,
          referenceNormalSpeedMps: CUSHION_CONTACT_REFERENCE_SPEED_MPS,
          contactTimeExponent: CUSHION_CONTACT_TIME_EXPONENT,
          maxSpinMagnitude: CUSHION_MAX_SPIN_MAGNITUDE,
          maxThrowAngleDeg: CUSHION_MAX_THROW_ANGLE_DEG,
          ballMassKg: BALL_MASS_KG,
          ballRadiusM: BALL_RADIUS_M,
          cushionHeightM: CUSHION_HEIGHT_M,
        });
        vx = collision.vx;
        vz = collision.vy;
        spinX = collision.spinX;
        spinY = collision.spinY;
        spinZ = collision.spinZ;
      }

      ball.x = x;
      setBallZ(ball, z);
      ball.vx = vx;
      setBallVz(ball, vz);
      ball.spinX = spinX;
      ball.spinY = spinY;
      ball.spinZ = spinZ;
    }

    resolveBallBallCollisions(room.balls, prevPositions, substepDtSec);

    for (const ball of room.balls) {
      if (ball.isPocketed) {
        continue;
      }

      const friction = applyBallSurfaceFriction({
        vx: ball.vx,
        vy: ball.vy,
        spinX: ball.spinX,
        spinY: ball.spinY,
        spinZ: ball.spinZ,
        radiusM: BALL_RADIUS_M,
        dtSec: substepDtSec,
      });
      ball.vx = friction.vx;
      ball.vy = friction.vy;
      ball.spinX = friction.spinX;
      ball.spinY = friction.spinY;
      ball.spinZ = friction.spinZ;
      ball.motionState = friction.motionState;

      const speed = Math.hypot(ball.vx, ball.vy);
      if (speed > MAX_BALL_SPEED_MPS) {
        const ratio = MAX_BALL_SPEED_MPS / speed;
        ball.vx *= ratio;
        ball.vy *= ratio;
      }
      ball.x = clampNumber(ball.x, BALL_RADIUS_M, TABLE_WIDTH_M - BALL_RADIUS_M);
      setBallZ(ball, clampNumber(getBallZ(ball), BALL_RADIUS_M, TABLE_HEIGHT_M - BALL_RADIUS_M));
      ball.vx = Number.isFinite(ball.vx) ? ball.vx : 0;
      ball.vy = Number.isFinite(ball.vy) ? ball.vy : 0;
      ball.spinX = Number.isFinite(ball.spinX) ? ball.spinX : 0;
      ball.spinY = Number.isFinite(ball.spinY) ? ball.spinY : 0;
      ball.spinZ = Number.isFinite(ball.spinZ) ? ball.spinZ : 0;
      if (!ball.motionState) {
        ball.motionState = 'STATIONARY';
      }
    }
  }
}

function resolveBallBallCollisions(
  balls: SnapshotBallFrame[],
  prevPositions: Array<{ x: number; z: number }>,
  substepDtSec: number,
): void {
  const minDistance = BALL_RADIUS_M * 2;
  const minDistanceSq = minDistance * minDistance;
  const epsilon = 1e-8;

  function applyImpulse(first: SnapshotBallFrame, second: SnapshotBallFrame, normalX: number, normalY: number): boolean {
    return applyBallBallCollisionWithSpin({
      first,
      second,
      normalX,
      normalY,
      restitution: BALL_BALL_RESTITUTION,
      ballMassKg: BALL_MASS_KG,
      ballRadiusM: BALL_RADIUS_M,
    }).collided;
  }

  function sweepHitTime(
    firstPrev: { x: number; z: number },
    firstCurr: SnapshotBallFrame,
    secondPrev: { x: number; z: number },
    secondCurr: SnapshotBallFrame,
  ): number | null {
    const startX = secondPrev.x - firstPrev.x;
    const startZ = secondPrev.z - firstPrev.z;
    const endX = secondCurr.x - firstCurr.x;
    const endZ = getBallZ(secondCurr) - getBallZ(firstCurr);
    const moveX = endX - startX;
    const moveZ = endZ - startZ;
    const moveLenSq = moveX * moveX + moveZ * moveZ;
    let t = 0;
    if (moveLenSq > epsilon) {
      t = -((startX * moveX) + (startZ * moveZ)) / moveLenSq;
      t = clampNumber(t, 0, 1);
    }
    const closestX = startX + moveX * t;
    const closestZ = startZ + moveZ * t;
    const closestDistSq = closestX * closestX + closestZ * closestZ;
    if (!Number.isFinite(closestDistSq) || closestDistSq > minDistanceSq) {
      return null;
    }
    return t;
  }

  for (let i = 0; i < balls.length; i += 1) {
    const first = balls[i];
    const firstPrev = prevPositions[i];
    if (!first || first.isPocketed) {
      continue;
    }
    for (let j = i + 1; j < balls.length; j += 1) {
      const second = balls[j];
      const secondPrev = prevPositions[j];
      if (!second || second.isPocketed) {
        continue;
      }
      const deltaX = second.x - first.x;
      const deltaZ = getBallZ(second) - getBallZ(first);
      const distanceSq = deltaX * deltaX + deltaZ * deltaZ;
      if (Number.isFinite(distanceSq) && distanceSq <= minDistanceSq) {
        const distance = Math.sqrt(Math.max(distanceSq, epsilon));
        const normalX = distance > epsilon ? deltaX / distance : 1;
        const normalY = distance > epsilon ? deltaZ / distance : 0;
        applyImpulse(first, second, normalX, normalY);
        const penetration = minDistance - distance;
        if (penetration > 0) {
          const correction = ((penetration - 1e-4 > 0 ? penetration - 1e-4 : 0) / 2) * 0.8;
          first.x -= normalX * correction;
          setBallZ(first, getBallZ(first) - normalY * correction);
          second.x += normalX * correction;
          setBallZ(second, getBallZ(second) + normalY * correction);
        }
        continue;
      }

      if (!firstPrev || !secondPrev) {
        continue;
      }
      const hitTime = sweepHitTime(firstPrev, first, secondPrev, second);
      if (hitTime === null) {
        continue;
      }
      const firstHitX = firstPrev.x + (first.x - firstPrev.x) * hitTime;
      const firstHitZ = firstPrev.z + (getBallZ(first) - firstPrev.z) * hitTime;
      const secondHitX = secondPrev.x + (second.x - secondPrev.x) * hitTime;
      const secondHitZ = secondPrev.z + (getBallZ(second) - secondPrev.z) * hitTime;
      const hitDeltaX = secondHitX - firstHitX;
      const hitDeltaZ = secondHitZ - firstHitZ;
      const hitDistance = Math.hypot(hitDeltaX, hitDeltaZ);
      const normalX = hitDistance > epsilon ? hitDeltaX / hitDistance : 1;
      const normalY = hitDistance > epsilon ? hitDeltaZ / hitDistance : 0;
      const collided = applyImpulse(first, second, normalX, normalY);
      if (!collided) {
        continue;
      }
      first.x = firstHitX;
      setBallZ(first, firstHitZ);
      second.x = secondHitX;
      setBallZ(second, secondHitZ);
      const remainDtSec = substepDtSec * (1 - hitTime);
      first.x += first.vx * remainDtSec;
      setBallZ(first, getBallZ(first) + getBallVz(first) * remainDtSec);
      second.x += second.vx * remainDtSec;
      setBallZ(second, getBallZ(second) + getBallVz(second) * remainDtSec);
    }
  }
}

function areRoomBallsSettled(room: LobbyRoom): boolean {
  let maxLinearSpeed = 0;
  let maxAngularSpeed = 0;
  let activeBallCount = 0;
  for (const ball of room.balls) {
    if (ball.isPocketed) {
      continue;
    }
    activeBallCount += 1;
    const linearSpeed = Math.hypot(ball.vx, ball.vy);
    const angularSpeed = Math.hypot(ball.spinX, ball.spinY, ball.spinZ);
    if (linearSpeed > maxLinearSpeed) {
      maxLinearSpeed = linearSpeed;
    }
    if (angularSpeed > maxAngularSpeed) {
      maxAngularSpeed = angularSpeed;
    }
  }

  if (activeBallCount === 0) {
    room.shotEndTracker = initShotEndTracker();
    return true;
  }

  const evaluation = evaluateShotEndWithFrames(room.shotEndTracker, {
    linearSpeedMps: maxLinearSpeed,
    angularSpeedRadps: maxAngularSpeed,
  });
  room.shotEndTracker = evaluation.tracker;
  return evaluation.isShotEnded;
}

function finalizeShotLifecycle(state: LobbyState, room: LobbyRoom, actorMemberId: string): void {
  room.shotEndTracker = initShotEndTracker();
  const resolved = transitionShotLifecycleState(room.shotState, 'SHOT_RESOLVED');
  if (resolved) {
    room.shotState = resolved;
    const scoreResult = increaseScoreAndCheckGameEnd(room.scoreBoard, actorMemberId);
    let isGameFinished = false;
    if (scoreResult.ok && scoreResult.gameEnded) {
      room.state = 'FINISHED';
      room.winnerMemberId = scoreResult.winnerPlayerId;
      const winnerMemberId = scoreResult.winnerPlayerId;
      room.memberGameStates = room.members.reduce<Record<string, 'WIN' | 'LOSE'>>((acc, member) => {
        acc[member.memberId] = member.memberId === winnerMemberId ? 'WIN' : 'LOSE';
        return acc;
      }, {});
      isGameFinished = true;
    }
    broadcastRoomEvent(state, room.roomId, 'shot_resolved', {
      roomId: room.roomId,
      shotState: room.shotState,
      state: room.state,
      scoreBoard: room.scoreBoard,
      winnerMemberId: room.winnerMemberId,
      serverTimeMs: Date.now(),
    });
    if (isGameFinished) {
      const resetAfterResolve = transitionShotLifecycleState(room.shotState, 'TURN_CHANGED');
      if (resetAfterResolve) {
        room.shotState = resetAfterResolve;
      }
      broadcastRoomEvent(state, room.roomId, 'game_finished', {
        roomId: room.roomId,
        winnerMemberId: room.winnerMemberId,
        memberGameStates: room.memberGameStates,
        scoreBoard: room.scoreBoard,
        serverTimeMs: Date.now(),
      });
      state.shotStateResetTimers[room.roomId] = null;
      void persistLobbyState(state);
      return;
    }
  }
  const turnChanged = transitionShotLifecycleState(room.shotState, 'TURN_CHANGED');
  if (turnChanged) {
    room.shotState = turnChanged;
    if (room.members.length > 0) {
      room.currentTurnIndex = (room.currentTurnIndex + 1) % room.members.length;
    } else {
      room.currentTurnIndex = 0;
    }
    room.turnDeadlineMs = room.members.length > 0 ? Date.now() + TURN_DURATION_MS : null;
    broadcastRoomEvent(state, room.roomId, 'turn_changed', {
      roomId: room.roomId,
      currentMemberId: getCurrentTurnMemberId(room),
      turnDeadlineMs: room.turnDeadlineMs,
      scoreBoard: room.scoreBoard,
      serverTimeMs: Date.now(),
    });
  }
  state.shotStateResetTimers[room.roomId] = null;
  void persistLobbyState(state);
}

function getDisconnectTimerKey(roomId: string, memberId: string): string {
  return `${roomId}:${memberId}`;
}

function clearDisconnectGraceTimer(state: LobbyState, roomId: string, memberId: string): void {
  const key = getDisconnectTimerKey(roomId, memberId);
  const timer = state.disconnectGraceTimers[key];
  if (timer) {
    clearTimeout(timer);
  }
  state.disconnectGraceTimers[key] = null;
}

function settleSingleSurvivorWin(state: LobbyState, room: LobbyRoom): void {
  if (room.state !== 'IN_GAME' || room.members.length !== 1) {
    return;
  }
  const winner = room.members[0]?.memberId ?? null;
  if (!winner) {
    return;
  }
  room.state = 'FINISHED';
  room.winnerMemberId = winner;
  room.memberGameStates[winner] = 'WIN';
  broadcastRoomEvent(state, room.roomId, 'game_finished', {
    roomId: room.roomId,
    winnerMemberId: room.winnerMemberId,
    memberGameStates: room.memberGameStates,
    scoreBoard: room.scoreBoard,
    serverTimeMs: Date.now(),
  });
}

export function applyDisconnectForfeit(state: LobbyState, roomId: string, memberId: string): void {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room || room.state !== 'IN_GAME') {
    return;
  }
  const stillMember = room.members.some((member) => member.memberId === memberId);
  if (!stillMember) {
    return;
  }
  room.memberGameStates[memberId] = 'LOSE';
  const left = leaveRoomMember(state, roomId, memberId);
  if (!left.ok) {
    return;
  }
  settleSingleSurvivorWin(state, left.room);
  void persistLobbyState(state);
}

function scheduleDisconnectGraceTimer(state: LobbyState, roomId: string, memberId: string): void {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room || room.state !== 'IN_GAME') {
    return;
  }
  clearDisconnectGraceTimer(state, roomId, memberId);
  const key = getDisconnectTimerKey(roomId, memberId);
  state.disconnectGraceTimers[key] = setTimeout(() => {
    applyDisconnectForfeit(state, roomId, memberId);
    state.disconnectGraceTimers[key] = null;
  }, DISCONNECT_GRACE_MS);
}

function removeMemberFromRoom(
  state: LobbyState,
  room: LobbyRoom,
  memberId: string,
  mode: 'leave' | 'kick',
): boolean {
  const targetIndex = room.members.findIndex((member) => member.memberId === memberId);
  if (targetIndex < 0) {
    return false;
  }

  const wasHost = room.hostMemberId === memberId;
  clearDisconnectGraceTimer(state, room.roomId, memberId);
  if (mode === 'kick') {
    room.memberGameStates[memberId] = 'KICKED';
  } else if (room.state === 'IN_GAME') {
    room.memberGameStates[memberId] = 'LOSE';
  } else {
    delete room.memberGameStates[memberId];
  }
  room.members.splice(targetIndex, 1);
  room.playerCount = room.members.length;
  delete room.scoreBoard[memberId];
  if (wasHost) {
    const previousHostMemberId = room.hostMemberId;
    room.hostMemberId = room.members[0]?.memberId ?? null;
    if (room.hostMemberId && room.hostMemberId !== previousHostMemberId) {
      broadcastRoomEvent(state, room.roomId, 'host_delegated', {
        roomId: room.roomId,
        previousHostMemberId,
        nextHostMemberId: room.hostMemberId,
        serverTimeMs: Date.now(),
      });
    }
  }

  if (room.members.length === 0) {
    room.currentTurnIndex = 0;
    room.turnDeadlineMs = null;
  } else {
    room.currentTurnIndex = Math.min(room.currentTurnIndex, room.members.length - 1);
    if (room.state === 'IN_GAME') {
      room.turnDeadlineMs = Date.now() + TURN_DURATION_MS;
    }
  }
  settleSingleSurvivorWin(state, room);
  return true;
}

function writeJson(res: ServerResponse, statusCode: number, payload: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(payload));
}

function applyCorsHeaders(req: IncomingMessage, res: ServerResponse): void {
  const origin = typeof req.headers.origin === 'string' ? req.headers.origin : '*';
  res.setHeader('access-control-allow-origin', origin);
  res.setHeader('vary', 'Origin');
  res.setHeader('access-control-allow-methods', 'GET,POST,OPTIONS');
  res.setHeader('access-control-allow-headers', 'Content-Type,Accept');
}

async function parseJsonBody(req: IncomingMessage, res: ServerResponse): Promise<Record<string, unknown> | null> {
  try {
    const rawBody = await readBody(req);
    return JSON.parse(rawBody || '{}') as Record<string, unknown>;
  } catch {
    writeJson(res, 400, { errorCode: 'ROOM_INVALID_JSON' });
    return null;
  }
}

export function createRoom(state: LobbyState, input: { title: unknown }): CreateRoomResult {
  const validated = validateRoomTitle(input.title);
  if (!validated.ok) {
    return { ok: false, statusCode: 400, errorCode: validated.errorCode };
  }

  const room: LobbyRoom = {
    roomId: `room-${state.nextRoomId}`,
    title: validated.normalizedTitle,
    state: 'WAITING',
    playerCount: 0,
    createdAt: new Date().toISOString(),
    hostMemberId: null,
    members: [],
    chatMessages: [],
    shotState: 'idle',
    scoreBoard: {},
    currentTurnIndex: 0,
    turnDeadlineMs: null,
    winnerMemberId: null,
    memberGameStates: {},
    balls: createInitialRoomBalls(),
    shotEndTracker: initShotEndTracker(),
  };

  state.nextRoomId += 1;
  state.rooms.push(room);
  state.roomStreamSeqByRoomId[room.roomId] = 0;
  state.roomStreamSubscribers[room.roomId] = new Set<ServerResponse>();
  state.shotStateResetTimers[room.roomId] = null;

  return { ok: true, room };
}

async function handleCreateRoom(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const result = createRoom(state, { title: body.title });
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }

  void persistLobbyState(state);
  writeJson(res, 201, { room: result.room });
}

function parseNumber(value: string | null, fallback: number): number {
  if (value === null || value.trim() === '') {
    return fallback;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) {
    return fallback;
  }
  return Math.floor(parsed);
}

export function listRooms(state: LobbyState, input: { offset?: number; limit?: number }): ListRoomsResult {
  const safeOffset = Math.max(0, input.offset ?? 0);
  const safeLimit = Math.max(1, input.limit ?? 20);
  const sorted = [...state.rooms].sort(compareRoomsForLobby);
  return paginateRooms(sorted, safeOffset, safeLimit);
}

function handleListRooms(req: IncomingMessage, res: ServerResponse, state: LobbyState): void {
  const url = new URL(req.url ?? '/lobby/rooms', 'http://localhost');
  const offset = parseNumber(url.searchParams.get('offset'), 0);
  const limit = parseNumber(url.searchParams.get('limit'), 20);
  const page = listRooms(state, { offset, limit });
  writeJson(res, 200, page);
}

export function joinRoom(state: LobbyState, roomId: string, member: { memberId: string; displayName: string }): JoinRoomResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const decision = evaluateRoomJoin({
    currentPlayerCount: room.playerCount,
    roomState: room.state,
  });
  if (!decision.ok) {
    return { ok: false, statusCode: 409, errorCode: decision.errorCode };
  }

  room.playerCount += 1;
  room.members.push({
    memberId: member.memberId,
    displayName: member.displayName,
    joinedAt: new Date().toISOString(),
  });
  room.scoreBoard[member.memberId] = room.scoreBoard[member.memberId] ?? 0;
  room.memberGameStates[member.memberId] = room.memberGameStates[member.memberId] ?? 'IN_ROOM';
  if (!room.hostMemberId) {
    room.hostMemberId = member.memberId;
  }

  return { ok: true, room };
}

async function handleJoinRoom(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/join$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const memberIdRaw = typeof body.memberId === 'string' ? body.memberId.trim() : '';
  const displayNameRaw = typeof body.displayName === 'string' ? body.displayName.trim() : '';
  const room = state.rooms.find((item) => item.roomId === roomId);
  const fallbackMemberNo = (room?.members.length ?? 0) + 1;
  const memberId = memberIdRaw.length > 0 ? memberIdRaw : `member-${fallbackMemberNo}`;
  const displayName = displayNameRaw.length > 0 ? displayNameRaw : memberId;

  const result = joinRoom(state, roomId, { memberId, displayName });
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }

  void persistLobbyState(state);
  writeJson(res, 200, { room: result.room });
}

function requireHost(room: LobbyRoom, actorMemberId: string): RoomActionResult | null {
  if (!room.hostMemberId || actorMemberId !== room.hostMemberId) {
    return { ok: false, statusCode: 409, errorCode: 'ROOM_HOST_ONLY' };
  }
  return null;
}

export function startRoomGame(state: LobbyState, roomId: string, actorMemberId: string): RoomActionResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const startResult = startGameRequest({
    roomState: room.state,
    hostMemberId: room.hostMemberId,
    actorMemberId,
    playerIds: room.members.map((member) => member.memberId),
  });
  if (!startResult.ok) {
    return { ok: false, statusCode: 409, errorCode: startResult.errorCode };
  }

  room.state = startResult.nextRoomState;
  initializeRoomGameRuntime(room);
  return { ok: true, room };
}

export function rematchRoomGame(state: LobbyState, roomId: string, actorMemberId: string): RoomActionResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const permission = requireHost(room, actorMemberId);
  if (permission) {
    return permission;
  }

  if (room.members.length < 2) {
    return { ok: false, statusCode: 409, errorCode: 'GAME_NOT_ENOUGH_PLAYERS' };
  }

  room.state = 'IN_GAME';
  initializeRoomGameRuntime(room);
  return { ok: true, room };
}

export function kickRoomMember(
  state: LobbyState,
  roomId: string,
  actorMemberId: string,
  targetMemberId: string,
): RoomActionResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const permission = requireHost(room, actorMemberId);
  if (permission) {
    return permission;
  }

  if (actorMemberId === targetMemberId) {
    return { ok: false, statusCode: 409, errorCode: 'ROOM_CANNOT_KICK_SELF' };
  }

  const targetIndex = room.members.findIndex((member) => member.memberId === targetMemberId);
  if (targetIndex < 0) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_MEMBER_NOT_FOUND' };
  }

  removeMemberFromRoom(state, room, targetMemberId, 'kick');
  return { ok: true, room };
}

export function leaveRoomMember(state: LobbyState, roomId: string, actorMemberId: string): RoomActionResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const targetIndex = room.members.findIndex((member) => member.memberId === actorMemberId);
  if (targetIndex < 0) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_MEMBER_NOT_FOUND' };
  }

  removeMemberFromRoom(state, room, actorMemberId, 'leave');
  return { ok: true, room };
}

export function sendRoomChatMessage(
  state: LobbyState,
  roomId: string,
  senderMemberId: string,
  message: string,
): RoomChatResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const senderExists = room.members.some((member) => member.memberId === senderMemberId);
  if (!senderExists) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_MEMBER_NOT_FOUND' };
  }

  const normalizedMessage = message.trim();
  if (normalizedMessage.length === 0) {
    return { ok: false, statusCode: 400, errorCode: 'CHAT_INVALID_INPUT' };
  }

  const rateLimitKey = `${roomId}:${senderMemberId}`;
  const nowMs = Date.now();
  const rateLimited = evaluateChatRateLimit(state.userLastChatSentAtByRoomAndMember, rateLimitKey, nowMs);
  if (!rateLimited.ok) {
    return {
      ok: false,
      statusCode: 429,
      errorCode: rateLimited.errorCode,
      retryAfterMs: rateLimited.retryAfterMs,
    };
  }

  recordLastChatSentAt(state.userLastChatSentAtByRoomAndMember, rateLimitKey, nowMs);
  room.chatMessages.push({
    senderMemberId,
    message: normalizedMessage,
    sentAt: new Date().toISOString(),
  });
  if (room.chatMessages.length > 50) {
    room.chatMessages = room.chatMessages.slice(-50);
  }
  return { ok: true, room };
}

async function handleStartRoom(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/start$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const result = startRoomGame(state, roomId, actorMemberId);
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }
  void persistLobbyState(state);
  writeJson(res, 200, { room: result.room });
}

async function handleRematchRoom(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/rematch$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const result = rematchRoomGame(state, roomId, actorMemberId);
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }
  void persistLobbyState(state);
  writeJson(res, 200, { room: result.room });
}

async function handleKickRoomMember(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/kick$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const targetMemberId = typeof body.targetMemberId === 'string' ? body.targetMemberId : '';
  const result = kickRoomMember(state, roomId, actorMemberId, targetMemberId);
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }
  void persistLobbyState(state);
  writeJson(res, 200, { room: result.room });
}

async function handleLeaveRoom(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/leave$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const result = leaveRoomMember(state, roomId, actorMemberId);
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }
  void persistLobbyState(state);
  writeJson(res, 200, { room: result.room });
}

function handleGetRoomChat(req: IncomingMessage, res: ServerResponse, state: LobbyState): void {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/chat$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  writeJson(res, 200, { items: room.chatMessages });
}

async function handleSendRoomChat(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/chat$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const senderMemberId = typeof body.senderMemberId === 'string' ? body.senderMemberId : '';
  const message = typeof body.message === 'string' ? body.message : '';
  const result = sendRoomChatMessage(state, roomId, senderMemberId, message);
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode, retryAfterMs: result.retryAfterMs ?? null });
    return;
  }
  void persistLobbyState(state);
  writeJson(res, 201, { item: result.room.chatMessages[result.room.chatMessages.length - 1] });
}

export function submitRoomShot(state: LobbyState, roomId: string, actorMemberId: string, payload: unknown): ShotSubmitResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const actorExists = room.members.some((member) => member.memberId === actorMemberId);
  if (!actorExists) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_MEMBER_NOT_FOUND' };
  }

  const validated = handleShotInputEntry(payload);
  if (!validated.ok) {
    return { ok: false, statusCode: validated.statusCode, errorCode: validated.errorCode, errors: validated.errors };
  }

  const nextOnSubmit = transitionShotLifecycleState(room.shotState, 'SHOT_SUBMITTED');
  if (!nextOnSubmit) {
    return { ok: false, statusCode: 409, errorCode: 'SHOT_STATE_CONFLICT' };
  }
  room.shotState = nextOnSubmit;
  applyShotToRoomBalls(room, validated.payload);
  broadcastRoomEvent(state, room.roomId, 'shot_started', {
    roomId: room.roomId,
    playerId: actorMemberId,
    serverTimeMs: Date.now(),
  });
  const previousTimer = state.shotStateResetTimers[room.roomId];
  if (previousTimer) {
    clearInterval(previousTimer);
  }
  state.shotStateResetTimers[room.roomId] = setInterval(() => {
    stepRoomPhysics(room);
    if (areRoomBallsSettled(room)) {
      const timer = state.shotStateResetTimers[room.roomId];
      if (timer) {
        clearInterval(timer);
      }
      finalizeShotLifecycle(state, room, actorMemberId);
    }
  }, ROOM_SNAPSHOT_BROADCAST_INTERVAL_MS);

  return { ok: true, payload: validated.payload };
}

async function handleSubmitRoomShot(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/shot$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const payload = body.payload;
  const result = submitRoomShot(state, roomId, actorMemberId, payload);
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode, errors: result.errors ?? [] });
    return;
  }

  void persistLobbyState(state);
  writeJson(res, 200, { accepted: true, payload: result.payload });
}

export function getRoomDetail(state: LobbyState, roomId: string): RoomDetailResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  return { ok: true, room };
}

function nextRoomSnapshotSeq(state: LobbyState, roomId: string): number {
  const previous = state.roomStreamSeqByRoomId[roomId] ?? 0;
  const next = previous + 1;
  state.roomStreamSeqByRoomId[roomId] = next;
  return next;
}

function broadcastRoomEvent(state: LobbyState, roomId: string, eventName: string, payload: unknown): void {
  const subscribers = state.roomStreamSubscribers[roomId];
  if (!subscribers || subscribers.size === 0) {
    return;
  }
  for (const subscriber of [...subscribers]) {
    if (subscriber.writableEnded || subscriber.destroyed) {
      subscribers.delete(subscriber);
      continue;
    }
    subscriber.write(`event: ${eventName}\n`);
    subscriber.write(`data: ${JSON.stringify(payload)}\n\n`);
  }
}

function writeSseEvent(subscriber: ServerResponse, eventName: string, payload: unknown): void {
  subscriber.write(`event: ${eventName}\n`);
  subscriber.write(`data: ${JSON.stringify(payload)}\n\n`);
}

function buildRoomSnapshot(state: LobbyState, room: LobbyRoom) {
  return serializeRoomSnapshot({
    roomId: room.roomId,
    seq: nextRoomSnapshotSeq(state, room.roomId),
    serverTimeMs: Date.now(),
    state: room.state,
    currentMemberId: getCurrentTurnMemberId(room),
    turnDeadlineMs: room.turnDeadlineMs,
    scoreBoard: room.scoreBoard,
    balls: room.balls,
  });
}

export function openRoomSnapshotStream(state: LobbyState, roomId: string, memberIdRaw: string): RoomStreamOpenResult {
  const room = state.rooms.find((item) => item.roomId === roomId);
  if (!room) {
    return { ok: false, statusCode: 404, errorCode: 'ROOM_NOT_FOUND' };
  }

  const memberId = memberIdRaw.trim();
  if (memberId.length === 0) {
    return { ok: false, statusCode: 400, errorCode: 'ROOM_MEMBER_ID_REQUIRED' };
  }
  clearDisconnectGraceTimer(state, roomId, memberId);

  const isMember = room.members.some((member) => member.memberId === memberId);
  if (!isMember) {
    return { ok: false, statusCode: 403, errorCode: 'ROOM_STREAM_FORBIDDEN' };
  }

  return {
    ok: true,
    room,
    snapshot: buildRoomSnapshot(state, room),
  };
}

function handleRoomSnapshotStream(req: IncomingMessage, res: ServerResponse, state: LobbyState): void {
  const url = new URL(req.url ?? '/lobby/rooms', 'http://localhost');
  const match = url.pathname.match(/^\/lobby\/rooms\/([^/?#]+)\/stream$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const memberId = url.searchParams.get('memberId') ?? '';
  const opened = openRoomSnapshotStream(state, roomId, memberId);
  if (!opened.ok) {
    writeJson(res, opened.statusCode, { errorCode: opened.errorCode });
    return;
  }

  res.statusCode = 200;
  res.setHeader('content-type', 'text/event-stream; charset=utf-8');
  res.setHeader('cache-control', 'no-cache, no-transform');
  res.setHeader('connection', 'keep-alive');
  state.roomStreamSubscribers[roomId] = state.roomStreamSubscribers[roomId] ?? new Set<ServerResponse>();
  state.roomStreamSubscribers[roomId].add(res);
  writeSseEvent(res, 'room_snapshot', opened.snapshot);

  const snapshotTicker = setInterval(() => {
    if (res.writableEnded) {
      return;
    }
    const heartbeatSnapshot = buildRoomSnapshot(state, opened.room);
    writeSseEvent(res, 'room_snapshot', heartbeatSnapshot);
  }, ROOM_SNAPSHOT_BROADCAST_INTERVAL_MS);
  const heartbeatTicker = setInterval(() => {
    if (res.writableEnded) {
      return;
    }
    writeSseEvent(res, 'heartbeat', { serverTimeMs: Date.now() });
  }, STREAM_HEARTBEAT_INTERVAL_MS);

  const cleanup = () => {
    clearInterval(snapshotTicker);
    clearInterval(heartbeatTicker);
    state.roomStreamSubscribers[roomId]?.delete(res);
    scheduleDisconnectGraceTimer(state, roomId, memberId);
  };
  req.on('close', cleanup);
  res.on('close', cleanup);
}

function handleGetRoomDetail(req: IncomingMessage, res: ServerResponse, state: LobbyState): void {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/?#]+)$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }

  const result = getRoomDetail(state, roomId);
  if (!result.ok) {
    writeJson(res, result.statusCode, { errorCode: result.errorCode });
    return;
  }

  writeJson(res, 200, { room: result.room });
}

export function createLobbyHttpServer() {
  const state: LobbyState = {
    nextRoomId: 1,
    rooms: [],
    roomStreamSeqByRoomId: {},
    roomStreamSubscribers: {},
    shotStateResetTimers: {},
    disconnectGraceTimers: {},
    userLastChatSentAtByRoomAndMember: new Map(),
  };

  const requestHandler = createLobbyRequestHandler(state);
  const server = createServer((req, res) => {
    void requestHandler(req, res);
  });

  return {
    state,
    server,
  };
}

export function createLobbyRequestHandler(state: LobbyState) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    applyCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    await ensureLobbyStateHydrated(state);

    if (req.method === 'GET' && req.url?.startsWith('/lobby/rooms/') && req.url.includes('/stream')) {
      handleRoomSnapshotStream(req, res, state);
      return;
    }

    if (req.method === 'GET' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/chat')) {
      handleGetRoomChat(req, res, state);
      return;
    }

    if (req.method === 'GET' && req.url?.startsWith('/lobby/rooms/')) {
      handleGetRoomDetail(req, res, state);
      return;
    }

    if (req.method === 'GET' && req.url?.startsWith('/lobby/rooms')) {
      handleListRooms(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url === '/lobby/rooms') {
      await handleCreateRoom(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/join')) {
      await handleJoinRoom(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/start')) {
      await handleStartRoom(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/rematch')) {
      await handleRematchRoom(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/kick')) {
      await handleKickRoomMember(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/leave')) {
      await handleLeaveRoom(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/chat')) {
      await handleSendRoomChat(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/shot')) {
      await handleSubmitRoomShot(req, res, state);
      return;
    }

    writeJson(res, 404, { errorCode: 'NOT_FOUND' });
  };
}
