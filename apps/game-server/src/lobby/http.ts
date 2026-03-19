import { createServer, type IncomingMessage, type ServerResponse } from 'node:http';

import { paginateRooms } from './pagination.ts';
import { compareRoomsForLobby } from './sort-rooms.ts';
import { validateRoomTitle } from './validate-room-title.ts';
import { evaluateRoomJoin } from '../room/join-policy.ts';
import { startGameRequest } from '../game/start-policy.ts';
import { transitionShotLifecycleState, type ShotLifecycleState } from '../game/shot-state-machine.ts';
import { serializeRoomSnapshot, type SnapshotBallFrame } from '../game/snapshot-serializer.ts';
import { handleShotInputEntry } from '../input/shot-input-entry.ts';
import { evaluateChatRateLimit, recordLastChatSentAt, type UserLastSentAtStore } from '../chat/rate-limit.ts';
import { increaseScoreAndCheckGameEnd } from '../game/score-policy.ts';
import type { PhysicsEvent } from '../../../../packages/physics-core/src/physics-events.ts';
import { adaptPhysicsEventsToScore } from '../../../../packages/physics-core/src/score-adapter.ts';
import {
  ROOM_SNAPSHOT_BROADCAST_INTERVAL_MS,
  createRoomPhysicsStepConfig,
} from '../../../../packages/physics-core/src/room-physics-config.ts';
import { stepRoomPhysicsWorld } from '../../../../packages/physics-core/src/room-physics-step.ts';
import { computeShotInitialization } from '../../../../packages/physics-core/src/shot-init.ts';
import { startTurnTimer, type TurnTimer } from '../game/turn-timer.ts';
import { initShotEndTracker, evaluateShotEndWithFrames } from '../../../../packages/physics-core/src/shot-end.ts';
import type { PhysicsBallState } from '../../../../packages/physics-core/src/room-physics-step.ts';

const TURN_DURATION_MS = 20_000;
const DISCONNECT_GRACE_MS = 10_000;
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
    senderDisplayName: string;
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
  activeCueBallId: 'cueBall' | 'objectBall2';
  shotEvents: PhysicsEvent[];
  lastBroadcastedEventIndex: number;
  shotStartedAtMs: number | null;
  nextShotId: number;
  replayFrames: Array<{ balls: Array<{ id: string; x: number; y: number }> }>;
  replayPhase: {
    scorerMemberId: string;
    remainingReplays: number;
    frames: Array<{ balls: Array<{ id: string; x: number; y: number }> }>;
    activeCueBallId: 'cueBall' | 'objectBall2';
  } | null;
  lastMissReplayData: {
    requesterMemberId: string;
    frames: Array<{ balls: Array<{ id: string; x: number; y: number }> }>;
    activeCueBallId: 'cueBall' | 'objectBall2';
    previousTurnIndex: number;
    previousActiveCueBallId: 'cueBall' | 'objectBall2';
  } | null;
  varPhase: {
    requesterMemberId: string;
    stage: 'VOTE_REPLAY' | 'REPLAYING' | 'VOTE_SCORE';
    votes: Record<string, boolean>;
    ballPositionsBeforeVAR: SnapshotBallFrame[];
    previousTurnIndex: number;
    previousActiveCueBallId: 'cueBall' | 'objectBall2';
    replayFrames: Array<{ balls: Array<{ id: string; x: number; y: number }> }>;
    replayActiveCueBallId: 'cueBall' | 'objectBall2';
  } | null;
  activeShotDiagnostics: {
    shotId: string;
    tickCount: number;
    maxObservedSpeedMps: number;
    nanGuardTriggered: boolean;
    maxPositiveEnergyDeltaJ: number;
    maxPositiveEnergyDeltaRatioPct: number;
    kineticEnergyStartJ: number;
    kineticEnergyEndJ: number;
    kineticEnergyDeltaJ: number;
    kineticEnergyDeltaRatioPct: number;
    reasonCounts: Record<'BOUNDARY_X' | 'BOUNDARY_Y' | 'POSITION_RECLAMP' | 'SPEED_CAP' | 'NAN_GUARD', number>;
  } | null;
};

type LobbyState = {
  nextRoomId: number;
  rooms: LobbyRoom[];
  roomStreamSeqByRoomId: Record<string, number>;
  roomStreamSubscribers: Record<string, Set<ServerResponse>>;
  shotStateResetTimers: Record<string, ReturnType<typeof setTimeout> | null>;
  disconnectGraceTimers: Record<string, ReturnType<typeof setTimeout> | null>;
  turnTimers: Record<string, TurnTimer | null>;
  roomHeartbeatTimers: Record<string, ReturnType<typeof setInterval> | null>;
  userLastChatSentAtByRoomAndMember: UserLastSentAtStore;
  lobbyChatMessages: Array<{ senderMemberId: string; senderDisplayName: string; message: string; sentAt: string }>;
  userLastLobbyChatSentAt: UserLastSentAtStore;
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
      errorCode: 'ROOM_NOT_FOUND' | 'ROOM_MEMBER_NOT_FOUND' | 'SHOT_INPUT_SCHEMA_INVALID' | 'SHOT_STATE_CONFLICT' | 'VAR_IN_PROGRESS' | 'NOT_YOUR_TURN';
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
  lobbyChatMessages?: Array<{ senderMemberId: string; senderDisplayName: string; message: string; sentAt: string }>;
  userLastLobbyChatSentAtEntries?: Array<[string, number]>;
};

let stateHydrationPromise: Promise<void> | null = null;
let pendingPersistState: PersistedLobbyState | null = null;
let persistInFlight = false;
const roomPhysicsConfigBase = createRoomPhysicsStepConfig();
const ROOM_PHYSICS_RECOVERY_FALLBACK_ENV_RAW = process.env.ROOM_PHYSICS_RECOVERY_FALLBACK_ENABLED;
export function resolveRecoveryFallbackEnabled(envRaw: string | undefined, fallback: boolean): boolean {
  if (envRaw === undefined) {
    return fallback;
  }
  const normalized = envRaw.trim().toLowerCase();
  if (normalized.length === 0) {
    return fallback;
  }
  if (normalized === '0' || normalized === 'false' || normalized === 'off' || normalized === 'no') {
    return false;
  }
  if (normalized === '1' || normalized === 'true' || normalized === 'on' || normalized === 'yes') {
    return true;
  }
  return fallback;
}
const ROOM_PHYSICS_RECOVERY_FALLBACK_ENABLED = resolveRecoveryFallbackEnabled(
  ROOM_PHYSICS_RECOVERY_FALLBACK_ENV_RAW,
  roomPhysicsConfigBase.recoveryFallbackEnabled,
);
const ROOM_PHYSICS_STEP_CONFIG = {
  ...roomPhysicsConfigBase,
  recoveryFallbackEnabled: ROOM_PHYSICS_RECOVERY_FALLBACK_ENABLED,
};
if (!ROOM_PHYSICS_STEP_CONFIG.recoveryFallbackEnabled) {
  console.warn(
    `[room-physics] recovery fallback disabled (${ROOM_PHYSICS_RECOVERY_FALLBACK_ENV_RAW ?? 'unset'}). ` +
      'POSITION_RECLAMP/NAN_GUARD auto-recovery will not apply.',
  );
}

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
    lobbyChatMessages: state.lobbyChatMessages,
    userLastLobbyChatSentAtEntries: [...state.userLastLobbyChatSentAt.entries()],
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
  state.lobbyChatMessages = Array.isArray(persisted.lobbyChatMessages) ? persisted.lobbyChatMessages : [];
  state.userLastLobbyChatSentAt = new Map(
    Array.isArray(persisted.userLastLobbyChatSentAtEntries) ? persisted.userLastLobbyChatSentAtEntries : [],
  );
  state.roomStreamSubscribers = {};
  state.shotStateResetTimers = {};
  state.disconnectGraceTimers = {};
  state.turnTimers = {};
  state.roomHeartbeatTimers = {};
  for (const room of state.rooms) {
    room.shotEvents = Array.isArray(room.shotEvents) ? room.shotEvents : [];
    room.shotStartedAtMs = typeof room.shotStartedAtMs === 'number' ? room.shotStartedAtMs : null;
    room.nextShotId = Number.isInteger(room.nextShotId) ? room.nextShotId : 1;
    room.replayFrames = Array.isArray(room.replayFrames) ? room.replayFrames : [];
    room.activeShotDiagnostics = room.activeShotDiagnostics && typeof room.activeShotDiagnostics === 'object'
      ? room.activeShotDiagnostics
      : null;
    state.roomStreamSubscribers[room.roomId] = new Set<ServerResponse>();
    state.shotStateResetTimers[room.roomId] = null;
    state.turnTimers[room.roomId] = null;
    state.roomHeartbeatTimers[room.roomId] = null;
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

function cancelRoomTurnTimer(state: LobbyState, roomId: string): void {
  const timer = state.turnTimers[roomId];
  if (timer) {
    timer.cancel();
    state.turnTimers[roomId] = null;
  }
}

function startRoomTurnTimer(state: LobbyState, room: LobbyRoom): void {
  cancelRoomTurnTimer(state, room.roomId);
  if (room.members.length === 0 || room.state !== 'IN_GAME') {
    room.turnDeadlineMs = null;
    return;
  }
  room.turnDeadlineMs = Date.now() + TURN_DURATION_MS;
  state.turnTimers[room.roomId] = startTurnTimer(() => {
    if (room.shotState !== 'idle' || room.members.length === 0 || room.state !== 'IN_GAME') {
      return;
    }
    room.currentTurnIndex = (room.currentTurnIndex + 1) % room.members.length;
    room.activeCueBallId = room.activeCueBallId === 'cueBall' ? 'objectBall2' : 'cueBall';
    room.turnDeadlineMs = Date.now() + TURN_DURATION_MS;
    broadcastRoomEvent(state, room.roomId, 'turn_changed', {
      roomId: room.roomId,
      currentMemberId: getCurrentTurnMemberId(room),
      turnDeadlineMs: room.turnDeadlineMs,
      scoreBoard: room.scoreBoard,
      serverTimeMs: Date.now(),
      activeCueBallId: room.activeCueBallId,
    });
    startRoomTurnTimer(state, room);
  }, TURN_DURATION_MS);
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
  room.shotEvents = [];
  room.lastBroadcastedEventIndex = 0;
  room.shotStartedAtMs = null;
  room.nextShotId = Number.isInteger(room.nextShotId) ? room.nextShotId : 1;
  room.activeShotDiagnostics = null;
  room.lastMissReplayData = null;
  room.varPhase = null;
  console.info(
    `[room-physics-config] ${JSON.stringify({
      roomId: room.roomId,
      state: room.state,
      tickIntervalMs: ROOM_SNAPSHOT_BROADCAST_INTERVAL_MS,
      stepConfig: ROOM_PHYSICS_STEP_CONFIG,
    })}`,
  );
}

function createInitialRoomBalls(): SnapshotBallFrame[] {
  return [
    { id: 'cueBall', x: 0.70, y: 0.71, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall1', x: 2.10, y: 0.62, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
    { id: 'objectBall2', x: 2.24, y: 0.80, vx: 0, vy: 0, spinX: 0, spinY: 0, spinZ: 0, isPocketed: false },
  ];
}

function clampNumber(value: number, min: number, max: number): number {
  if (!Number.isFinite(value)) {
    return min;
  }
  return Math.max(min, Math.min(max, value));
}

function applyShotToRoomBalls(room: LobbyRoom, payload: Record<string, unknown>): void {
  const cueBall = room.balls.find((ball) => ball.id === room.activeCueBallId);
  if (!cueBall) {
    return;
  }
  const directionDeg = Number(payload.shotDirectionDeg);
  const dragPx = Number(payload.dragPx);
  const impactOffsetX = clampNumber(Number(payload.impactOffsetX), -0.9, 0.9);
  const impactOffsetY = clampNumber(Number(payload.impactOffsetY), -0.9, 0.9);
  const directionRad = (directionDeg * Math.PI) / 180;
  const shotInit = computeShotInitialization({
    dragPx,
    impactOffsetX,
    impactOffsetY,
  });
  const forwardX = Math.cos(directionRad);
  const forwardY = Math.sin(directionRad);
  cueBall.vx = forwardX * shotInit.initialBallSpeedMps;
  cueBall.vy = forwardY * shotInit.initialBallSpeedMps;
  cueBall.spinX = shotInit.omegaX * forwardY;
  cueBall.spinY = -shotInit.omegaX * forwardX;
  cueBall.spinZ = shotInit.omegaZ;
}

function getCurrentShotAtMs(room: LobbyRoom): number {
  if (room.shotStartedAtMs === null) {
    return 0;
  }
  return Math.max(0, Date.now() - room.shotStartedAtMs);
}

function appendShotEvent(room: LobbyRoom, event: Omit<PhysicsEvent, 'atMs'>): void {
  room.shotEvents.push({
    ...event,
    atMs: getCurrentShotAtMs(room),
  });
}

function appendCueBallCollisionEvent(room: LobbyRoom, first: SnapshotBallFrame, second: SnapshotBallFrame): void {
  const cueBallId = room.activeCueBallId;
  if (first.id === cueBallId && second.id !== cueBallId) {
    appendShotEvent(room, {
      type: 'BALL_COLLISION',
      sourceBallId: cueBallId,
      targetBallId: second.id,
    });
    return;
  }
  if (second.id === cueBallId && first.id !== cueBallId) {
    appendShotEvent(room, {
      type: 'BALL_COLLISION',
      sourceBallId: cueBallId,
      targetBallId: first.id,
    });
  }
}

function updateShotEnergyReport(room: LobbyRoom): void {
  if (!room.activeShotDiagnostics) {
    return;
  }
  const startJ = room.activeShotDiagnostics.kineticEnergyStartJ;
  const endJ = room.activeShotDiagnostics.kineticEnergyEndJ;
  const deltaJ = endJ - startJ;
  const deltaRatioPct = startJ > 0 ? (deltaJ / startJ) * 100 : 0;
  const maxPositiveRatioPct = startJ > 0 ? (room.activeShotDiagnostics.maxPositiveEnergyDeltaJ / startJ) * 100 : 0;
  room.activeShotDiagnostics.kineticEnergyDeltaJ = deltaJ;
  room.activeShotDiagnostics.kineticEnergyDeltaRatioPct = deltaRatioPct;
  room.activeShotDiagnostics.maxPositiveEnergyDeltaRatioPct = maxPositiveRatioPct;
}

function stepRoomPhysics(room: LobbyRoom): void {
  const stats = stepRoomPhysicsWorld(room.balls, ROOM_PHYSICS_STEP_CONFIG, {
    onCushionCollision: (ball, cushionId) => {
      appendShotEvent(room, {
        type: 'CUSHION_COLLISION',
        sourceBallId: ball.id,
        cushionId,
      });
    },
    onBallCollision: (first, second) => {
      appendCueBallCollisionEvent(room, first, second);
    },
  });
  // 리플레이용 프레임 녹화
  room.replayFrames.push({
    balls: room.balls.map((b) => ({ id: b.id, x: b.x, y: b.y })),
  });
  if (room.activeShotDiagnostics) {
    if (room.activeShotDiagnostics.tickCount === 0) {
      room.activeShotDiagnostics.kineticEnergyStartJ = stats.kineticEnergyStartJ;
    }
    room.activeShotDiagnostics.tickCount += 1;
    room.activeShotDiagnostics.maxObservedSpeedMps = Math.max(
      room.activeShotDiagnostics.maxObservedSpeedMps,
      stats.maxObservedSpeedMps,
    );
    room.activeShotDiagnostics.nanGuardTriggered =
      room.activeShotDiagnostics.nanGuardTriggered || stats.nanGuardTriggered;
    room.activeShotDiagnostics.maxPositiveEnergyDeltaJ = Math.max(
      room.activeShotDiagnostics.maxPositiveEnergyDeltaJ,
      stats.maxPositiveEnergyDeltaJ,
    );
    room.activeShotDiagnostics.kineticEnergyEndJ = stats.kineticEnergyEndJ;
    updateShotEnergyReport(room);
    room.activeShotDiagnostics.reasonCounts.BOUNDARY_X += stats.reasonCounts.BOUNDARY_X;
    room.activeShotDiagnostics.reasonCounts.BOUNDARY_Y += stats.reasonCounts.BOUNDARY_Y;
    room.activeShotDiagnostics.reasonCounts.POSITION_RECLAMP += stats.reasonCounts.POSITION_RECLAMP;
    room.activeShotDiagnostics.reasonCounts.SPEED_CAP += stats.reasonCounts.SPEED_CAP;
    room.activeShotDiagnostics.reasonCounts.NAN_GUARD += stats.reasonCounts.NAN_GUARD;
  }
}

function areRoomBallsSettled(room: LobbyRoom): boolean {
  const ANGULAR_THRESHOLD = 0.2;
  for (const ball of room.balls) {
    if (ball.isPocketed) {
      continue;
    }
    if (Math.hypot(ball.vx, ball.vy) >= ROOM_PHYSICS_STEP_CONFIG.shotEndLinearSpeedThresholdMps) {
      return false;
    }
    if (Math.hypot(ball.spinX, ball.spinY, ball.spinZ) >= ANGULAR_THRESHOLD) {
      return false;
    }
  }
  return true;
}

function finalizeShotLifecycle(
  state: LobbyState,
  room: LobbyRoom,
  actorMemberId: string,
  endReason: 'BALLS_SETTLED',
): void {
  let scoredAtShotEnd = false;
  const resolved = transitionShotLifecycleState(room.shotState, 'SHOT_RESOLVED');
  if (resolved) {
    room.shotState = resolved;
    const scoreEvaluation = adaptPhysicsEventsToScore({
      cueBallId: room.activeCueBallId,
      objectBallIds: room.activeCueBallId === 'cueBall' ? ['objectBall1', 'objectBall2'] : ['cueBall', 'objectBall1'],
      events: [
        ...room.shotEvents,
        {
          type: 'SHOT_END',
          atMs: getCurrentShotAtMs(room),
        },
      ],
    });
    const scoreResult = scoreEvaluation.scored
      ? increaseScoreAndCheckGameEnd(room.scoreBoard, actorMemberId)
      : null;
    scoredAtShotEnd = scoreEvaluation.scored;
    // Save miss replay data for VAR
    if (!scoreEvaluation.scored) {
      room.lastMissReplayData = {
        requesterMemberId: actorMemberId,
        frames: [...room.replayFrames],
        activeCueBallId: room.activeCueBallId,
        previousTurnIndex: room.currentTurnIndex,
        previousActiveCueBallId: room.activeCueBallId,
      };
    } else {
      room.lastMissReplayData = null;
    }
    const shouldSwitchTurn = !scoreEvaluation.scored;
    let isGameFinished = false;
    if (scoreResult?.ok && scoreResult.gameEnded) {
      room.lastMissReplayData = null; // scored (game over) clears miss data
      room.state = 'FINISHED';
      room.winnerMemberId = scoreResult.winnerPlayerId;
      const winnerMemberId = scoreResult.winnerPlayerId;
      room.memberGameStates = room.members.reduce<Record<string, 'WIN' | 'LOSE'>>((acc, member) => {
        acc[member.memberId] = member.memberId === winnerMemberId ? 'WIN' : 'LOSE';
        return acc;
      }, {});
      isGameFinished = true;
    }
    const replayAvailable = scoredAtShotEnd && !isGameFinished;
    broadcastRoomEvent(state, room.roomId, 'shot_resolved', {
      roomId: room.roomId,
      shotState: room.shotState,
      state: room.state,
      scoreBoard: room.scoreBoard,
      scored: scoreEvaluation.scored,
      winnerMemberId: room.winnerMemberId,
      serverTimeMs: Date.now(),
      replayAvailable,
      scorerMemberId: replayAvailable ? actorMemberId : undefined,
      missedByMemberId: !scoreEvaluation.scored ? actorMemberId : undefined,
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
      cancelRoomTurnTimer(state, room.roomId);
      void persistLobbyState(state);
      room.shotEvents = [];
      room.lastBroadcastedEventIndex = 0;
      room.shotStartedAtMs = null;
      room.replayFrames = [];
      if (room.activeShotDiagnostics) {
        const fallbackRecoveryTriggered =
          room.activeShotDiagnostics.reasonCounts.POSITION_RECLAMP > 0 || room.activeShotDiagnostics.reasonCounts.NAN_GUARD > 0;
        console.info(
          `[shot-diagnostics] ${JSON.stringify({
            roomId: room.roomId,
            playerId: actorMemberId,
            shotId: room.activeShotDiagnostics.shotId,
            tickCount: room.activeShotDiagnostics.tickCount,
            maxObservedSpeedMps: room.activeShotDiagnostics.maxObservedSpeedMps,
            nanGuardTriggered: room.activeShotDiagnostics.nanGuardTriggered,
            maxPositiveEnergyDeltaJ: room.activeShotDiagnostics.maxPositiveEnergyDeltaJ,
            maxPositiveEnergyDeltaRatioPct: room.activeShotDiagnostics.maxPositiveEnergyDeltaRatioPct,
            kineticEnergyStartJ: room.activeShotDiagnostics.kineticEnergyStartJ,
            kineticEnergyEndJ: room.activeShotDiagnostics.kineticEnergyEndJ,
            kineticEnergyDeltaJ: room.activeShotDiagnostics.kineticEnergyDeltaJ,
            kineticEnergyDeltaRatioPct: room.activeShotDiagnostics.kineticEnergyDeltaRatioPct,
            reasonCounts: room.activeShotDiagnostics.reasonCounts,
            fallbackRecoveryEnabled: ROOM_PHYSICS_STEP_CONFIG.recoveryFallbackEnabled,
            fallbackRecoveryTriggered,
            endReason,
            scored: scoreEvaluation.scored,
            gameFinished: true,
          })}`,
        );
        if (fallbackRecoveryTriggered && ROOM_PHYSICS_STEP_CONFIG.recoveryFallbackEnabled) {
          console.warn(
            `[shot-fallback-recovery] ${JSON.stringify({
              roomId: room.roomId,
              shotId: room.activeShotDiagnostics.shotId,
              reasonCounts: room.activeShotDiagnostics.reasonCounts,
              fallbackRecoveryEnabled: ROOM_PHYSICS_STEP_CONFIG.recoveryFallbackEnabled,
            })}`,
          );
        } else if (fallbackRecoveryTriggered) {
          console.warn(
            `[shot-fallback-risk] ${JSON.stringify({
              roomId: room.roomId,
              shotId: room.activeShotDiagnostics.shotId,
              reasonCounts: room.activeShotDiagnostics.reasonCounts,
              fallbackRecoveryEnabled: ROOM_PHYSICS_STEP_CONFIG.recoveryFallbackEnabled,
            })}`,
          );
        }
      }
      room.activeShotDiagnostics = null;
      return;
    }
    // If scored and not game finished: enter replay phase (defer turn_changed)
    if (scoredAtShotEnd && !isGameFinished && room.replayFrames.length > 0) {
      room.replayPhase = {
        scorerMemberId: actorMemberId,
        remainingReplays: 3,
        frames: room.replayFrames,
        activeCueBallId: room.activeCueBallId,
      };
      room.replayFrames = [];
    } else {
      const turnChanged = transitionShotLifecycleState(room.shotState, 'TURN_CHANGED');
      if (turnChanged) {
        room.shotState = turnChanged;
        if (room.members.length > 0 && shouldSwitchTurn) {
          room.currentTurnIndex = (room.currentTurnIndex + 1) % room.members.length;
          room.activeCueBallId = room.activeCueBallId === 'cueBall' ? 'objectBall2' : 'cueBall';
        } else if (room.members.length === 0) {
          room.currentTurnIndex = 0;
        }
        startRoomTurnTimer(state, room);
        broadcastRoomEvent(state, room.roomId, 'turn_changed', {
          roomId: room.roomId,
          currentMemberId: getCurrentTurnMemberId(room),
          turnDeadlineMs: room.turnDeadlineMs,
          scoreBoard: room.scoreBoard,
          serverTimeMs: Date.now(),
          activeCueBallId: room.activeCueBallId,
        });
      }
    }
  }
  room.shotEvents = [];
  room.lastBroadcastedEventIndex = 0;
  room.shotStartedAtMs = null;
  room.replayFrames = [];
  if (room.activeShotDiagnostics) {
    const fallbackRecoveryTriggered =
      room.activeShotDiagnostics.reasonCounts.POSITION_RECLAMP > 0 || room.activeShotDiagnostics.reasonCounts.NAN_GUARD > 0;
    console.info(
      `[shot-diagnostics] ${JSON.stringify({
        roomId: room.roomId,
        playerId: actorMemberId,
        shotId: room.activeShotDiagnostics.shotId,
        tickCount: room.activeShotDiagnostics.tickCount,
        maxObservedSpeedMps: room.activeShotDiagnostics.maxObservedSpeedMps,
        nanGuardTriggered: room.activeShotDiagnostics.nanGuardTriggered,
        maxPositiveEnergyDeltaJ: room.activeShotDiagnostics.maxPositiveEnergyDeltaJ,
        maxPositiveEnergyDeltaRatioPct: room.activeShotDiagnostics.maxPositiveEnergyDeltaRatioPct,
        kineticEnergyStartJ: room.activeShotDiagnostics.kineticEnergyStartJ,
        kineticEnergyEndJ: room.activeShotDiagnostics.kineticEnergyEndJ,
        kineticEnergyDeltaJ: room.activeShotDiagnostics.kineticEnergyDeltaJ,
        kineticEnergyDeltaRatioPct: room.activeShotDiagnostics.kineticEnergyDeltaRatioPct,
        reasonCounts: room.activeShotDiagnostics.reasonCounts,
        fallbackRecoveryEnabled: ROOM_PHYSICS_STEP_CONFIG.recoveryFallbackEnabled,
        fallbackRecoveryTriggered,
        endReason,
        scored: scoredAtShotEnd,
        gameFinished: false,
      })}`,
    );
    if (fallbackRecoveryTriggered && ROOM_PHYSICS_STEP_CONFIG.recoveryFallbackEnabled) {
      console.warn(
        `[shot-fallback-recovery] ${JSON.stringify({
          roomId: room.roomId,
          shotId: room.activeShotDiagnostics.shotId,
          reasonCounts: room.activeShotDiagnostics.reasonCounts,
          fallbackRecoveryEnabled: ROOM_PHYSICS_STEP_CONFIG.recoveryFallbackEnabled,
        })}`,
      );
    } else if (fallbackRecoveryTriggered) {
      console.warn(
        `[shot-fallback-risk] ${JSON.stringify({
          roomId: room.roomId,
          shotId: room.activeShotDiagnostics.shotId,
          reasonCounts: room.activeShotDiagnostics.reasonCounts,
          fallbackRecoveryEnabled: ROOM_PHYSICS_STEP_CONFIG.recoveryFallbackEnabled,
        })}`,
      );
    }
  }
  room.activeShotDiagnostics = null;
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
  cancelRoomTurnTimer(state, room.roomId);
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
    cancelRoomTurnTimer(state, room.roomId);
  } else {
    room.currentTurnIndex = Math.min(room.currentTurnIndex, room.members.length - 1);
    if (room.state === 'IN_GAME') {
      startRoomTurnTimer(state, room);
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
    activeCueBallId: 'cueBall',
    balls: createInitialRoomBalls(),
    shotEvents: [],
    lastBroadcastedEventIndex: 0,
    shotStartedAtMs: null,
    nextShotId: 1,
    replayFrames: [],
    replayPhase: null,
    lastMissReplayData: null,
    varPhase: null,
    activeShotDiagnostics: null,
  };

  state.nextRoomId += 1;
  state.rooms.push(room);
  state.roomStreamSeqByRoomId[room.roomId] = 0;
  state.roomStreamSubscribers[room.roomId] = new Set<ServerResponse>();
  state.shotStateResetTimers[room.roomId] = null;
  state.turnTimers[room.roomId] = null;
  state.roomHeartbeatTimers[room.roomId] = null;

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
  startRoomTurnTimer(state, room);
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
  startRoomTurnTimer(state, room);
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
  const senderMember = room.members.find((m) => m.memberId === senderMemberId);
  room.chatMessages.push({
    senderMemberId,
    senderDisplayName: senderMember?.displayName ?? senderMemberId,
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
  const sentItem = result.room.chatMessages[result.room.chatMessages.length - 1];
  broadcastRoomEvent(state, roomId, 'chat_message', sentItem);
  void persistLobbyState(state);
  writeJson(res, 201, { item: sentItem });
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

  if (room.varPhase) {
    return { ok: false, statusCode: 409, errorCode: 'VAR_IN_PROGRESS' };
  }

  // 턴 소유권 검증 — 버저비터 방지
  const currentTurnMember = getCurrentTurnMemberId(room);
  if (currentTurnMember !== actorMemberId) {
    return { ok: false, statusCode: 409, errorCode: 'NOT_YOUR_TURN' };
  }

  room.lastMissReplayData = null; // New shot expires VAR window

  const nextOnSubmit = transitionShotLifecycleState(room.shotState, 'SHOT_SUBMITTED');
  if (!nextOnSubmit) {
    return { ok: false, statusCode: 409, errorCode: 'SHOT_STATE_CONFLICT' };
  }
  room.shotState = nextOnSubmit;
  cancelRoomTurnTimer(state, room.roomId);
  room.shotEvents = [];
  room.lastBroadcastedEventIndex = 0;
  room.shotStartedAtMs = Date.now();
  const shotId = `${room.roomId}-shot-${room.nextShotId}`;
  room.nextShotId += 1;
  room.activeShotDiagnostics = {
    shotId,
    tickCount: 0,
    maxObservedSpeedMps: 0,
    nanGuardTriggered: false,
    maxPositiveEnergyDeltaJ: 0,
    maxPositiveEnergyDeltaRatioPct: 0,
    kineticEnergyStartJ: 0,
    kineticEnergyEndJ: 0,
    kineticEnergyDeltaJ: 0,
    kineticEnergyDeltaRatioPct: 0,
    reasonCounts: {
      BOUNDARY_X: 0,
      BOUNDARY_Y: 0,
      POSITION_RECLAMP: 0,
      SPEED_CAP: 0,
      NAN_GUARD: 0,
    },
  };
  // 리플레이용 프레임 녹화 초기화 및 첫 프레임(샷 직전 위치) 기록
  room.replayFrames = [];
  room.replayFrames.push({
    balls: room.balls.map((b) => ({ id: b.id, x: b.x, y: b.y })),
  });
  applyShotToRoomBalls(room, validated.payload);
  broadcastRoomEvent(state, room.roomId, 'shot_started', {
    roomId: room.roomId,
    playerId: actorMemberId,
    shotId,
    serverTimeMs: Date.now(),
    activeCueBallId: room.activeCueBallId,
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
      finalizeShotLifecycle(state, room, actorMemberId, 'BALLS_SETTLED');
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

async function handleReplayRequest(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/replay$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }
  const body = await parseJsonBody(req, res);
  if (!body) return;
  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const room = state.rooms.find((r) => r.roomId === roomId);
  if (!room) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }
  if (!room.replayPhase) {
    writeJson(res, 409, { errorCode: 'REPLAY_NOT_ACTIVE' });
    return;
  }
  if (actorMemberId !== room.replayPhase.scorerMemberId) {
    writeJson(res, 403, { errorCode: 'NOT_SCORER' });
    return;
  }
  if (room.replayPhase.remainingReplays <= 0) {
    writeJson(res, 409, { errorCode: 'NO_REPLAYS_REMAINING' });
    return;
  }
  room.replayPhase.remainingReplays -= 1;
  broadcastRoomEvent(state, room.roomId, 'replay_requested', {
    roomId: room.roomId,
    frames: room.replayPhase.frames,
    activeCueBallId: room.replayPhase.activeCueBallId,
    remainingReplays: room.replayPhase.remainingReplays,
    serverTimeMs: Date.now(),
  });
  writeJson(res, 200, { ok: true });
}

async function handleReplayEnd(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/replay-end$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }
  const body = await parseJsonBody(req, res);
  if (!body) return;
  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const room = state.rooms.find((r) => r.roomId === roomId);
  if (!room) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }
  if (!room.replayPhase) {
    writeJson(res, 409, { errorCode: 'REPLAY_NOT_ACTIVE' });
    return;
  }
  if (actorMemberId !== room.replayPhase.scorerMemberId) {
    writeJson(res, 403, { errorCode: 'NOT_SCORER' });
    return;
  }
  room.replayPhase = null;
  // Transition shot state and broadcast turn_changed (scorer keeps turn)
  const turnChanged = transitionShotLifecycleState(room.shotState, 'TURN_CHANGED');
  if (turnChanged) {
    room.shotState = turnChanged;
    startRoomTurnTimer(state, room);
    broadcastRoomEvent(state, room.roomId, 'turn_changed', {
      roomId: room.roomId,
      currentMemberId: getCurrentTurnMemberId(room),
      turnDeadlineMs: room.turnDeadlineMs,
      scoreBoard: room.scoreBoard,
      serverTimeMs: Date.now(),
      activeCueBallId: room.activeCueBallId,
    });
  }
  void persistLobbyState(state);
  writeJson(res, 200, { ok: true });
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
  const fromIdx = room.lastBroadcastedEventIndex;
  const newEvents = room.shotEvents.slice(fromIdx);
  room.lastBroadcastedEventIndex = room.shotEvents.length;

  return serializeRoomSnapshot({
    roomId: room.roomId,
    seq: nextRoomSnapshotSeq(state, room.roomId),
    serverTimeMs: Date.now(),
    state: room.state,
    currentMemberId: getCurrentTurnMemberId(room),
    turnDeadlineMs: room.turnDeadlineMs,
    activeCueBallId: room.activeCueBallId,
    shotState: room.shotState,
    scoreBoard: room.scoreBoard,
    balls: room.balls,
    events: newEvents.length > 0
      ? newEvents.map((e) => {
          if (e.type === 'BALL_COLLISION') {
            return { type: e.type, sourceBallId: e.sourceBallId, targetBallId: e.targetBallId };
          }
          if (e.type === 'CUSHION_COLLISION') {
            return { type: e.type, sourceBallId: e.sourceBallId, cushionId: e.cushionId };
          }
          return { type: e.type, sourceBallId: '' };
        })
      : undefined,
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

function ensureRoomSnapshotHeartbeat(state: LobbyState, room: LobbyRoom): void {
  if (state.roomHeartbeatTimers[room.roomId]) return;
  state.roomHeartbeatTimers[room.roomId] = setInterval(() => {
    const subscribers = state.roomStreamSubscribers[room.roomId];
    if (!subscribers || subscribers.size === 0) {
      clearInterval(state.roomHeartbeatTimers[room.roomId]!);
      state.roomHeartbeatTimers[room.roomId] = null;
      return;
    }
    const snapshot = buildRoomSnapshot(state, room);
    for (const sub of [...subscribers]) {
      if (sub.writableEnded || sub.destroyed) {
        subscribers.delete(sub);
        continue;
      }
      writeSseEvent(sub, 'room_snapshot', snapshot);
    }
  }, ROOM_SNAPSHOT_BROADCAST_INTERVAL_MS);
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

  ensureRoomSnapshotHeartbeat(state, opened.room);

  const heartbeatTicker = setInterval(() => {
    if (res.writableEnded) {
      return;
    }
    writeSseEvent(res, 'heartbeat', { serverTimeMs: Date.now() });
  }, STREAM_HEARTBEAT_INTERVAL_MS);

  const cleanup = () => {
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

function handleGetLobbyChat(_req: IncomingMessage, res: ServerResponse, state: LobbyState): void {
  writeJson(res, 200, { items: state.lobbyChatMessages });
}

async function handleSendLobbyChat(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const body = await parseJsonBody(req, res);
  if (!body) {
    return;
  }

  const senderMemberId = typeof body.senderMemberId === 'string' ? body.senderMemberId : '';
  const senderDisplayName = typeof body.senderDisplayName === 'string' ? body.senderDisplayName : senderMemberId;
  const message = typeof body.message === 'string' ? body.message : '';

  const normalizedMessage = message.trim();
  if (normalizedMessage.length === 0) {
    writeJson(res, 400, { errorCode: 'CHAT_INVALID_INPUT' });
    return;
  }

  const rateLimitKey = senderMemberId;
  const nowMs = Date.now();
  const rateLimited = evaluateChatRateLimit(state.userLastLobbyChatSentAt, rateLimitKey, nowMs);
  if (!rateLimited.ok) {
    writeJson(res, 429, { errorCode: rateLimited.errorCode, retryAfterMs: rateLimited.retryAfterMs });
    return;
  }

  recordLastChatSentAt(state.userLastLobbyChatSentAt, rateLimitKey, nowMs);
  const item = {
    senderMemberId,
    senderDisplayName,
    message: normalizedMessage,
    sentAt: new Date().toISOString(),
  };
  state.lobbyChatMessages.push(item);
  if (state.lobbyChatMessages.length > 50) {
    state.lobbyChatMessages = state.lobbyChatMessages.slice(-50);
  }
  void persistLobbyState(state);
  writeJson(res, 201, { item });
}

export function createLobbyHttpServer() {
  const state: LobbyState = {
    nextRoomId: 1,
    rooms: [],
    roomStreamSeqByRoomId: {},
    roomStreamSubscribers: {},
    shotStateResetTimers: {},
    disconnectGraceTimers: {},
    turnTimers: {},
    roomHeartbeatTimers: {},
    userLastChatSentAtByRoomAndMember: new Map(),
    lobbyChatMessages: [],
    userLastLobbyChatSentAt: new Map(),
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

async function handleVarRequest(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/var-request$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }
  const body = await parseJsonBody(req, res);
  if (!body) return;
  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const room = state.rooms.find((r) => r.roomId === roomId);
  if (!room) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }
  if (!room.lastMissReplayData) {
    writeJson(res, 409, { errorCode: 'VAR_NO_MISS_DATA' });
    return;
  }
  if (room.lastMissReplayData.requesterMemberId !== actorMemberId) {
    writeJson(res, 403, { errorCode: 'VAR_NOT_SHOOTER' });
    return;
  }
  if (room.varPhase !== null) {
    writeJson(res, 409, { errorCode: 'VAR_ALREADY_ACTIVE' });
    return;
  }
  if (room.shotState !== 'idle') {
    writeJson(res, 409, { errorCode: 'SHOT_IN_PROGRESS' });
    return;
  }
  // Cancel turn timer while VAR is in progress
  cancelRoomTurnTimer(state, room.roomId);
  const missData = room.lastMissReplayData;
  room.varPhase = {
    requesterMemberId: actorMemberId,
    stage: 'VOTE_REPLAY',
    votes: {},
    ballPositionsBeforeVAR: room.balls.map((b) => ({ ...b })),
    previousTurnIndex: missData.previousTurnIndex,
    previousActiveCueBallId: missData.previousActiveCueBallId,
    replayFrames: missData.frames,
    replayActiveCueBallId: missData.activeCueBallId,
  };
  // totalVoters = all members except requester
  const totalVoters = room.members.filter((m) => m.memberId !== actorMemberId).length;
  const requesterMember = room.members.find((m) => m.memberId === actorMemberId);
  broadcastRoomEvent(state, room.roomId, 'var_vote_started', {
    roomId: room.roomId,
    requesterMemberId: actorMemberId,
    requesterDisplayName: requesterMember?.displayName ?? actorMemberId,
    stage: 'VOTE_REPLAY',
    totalVoters,
  });
  writeJson(res, 200, { ok: true });
}

async function handleVarVote(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/var-vote$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }
  const body = await parseJsonBody(req, res);
  if (!body) return;
  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const vote = body.vote === true;
  const room = state.rooms.find((r) => r.roomId === roomId);
  if (!room) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }
  if (!room.varPhase) {
    writeJson(res, 409, { errorCode: 'VAR_NOT_ACTIVE' });
    return;
  }
  const varPhase = room.varPhase;
  if (varPhase.stage !== 'VOTE_REPLAY' && varPhase.stage !== 'VOTE_SCORE') {
    writeJson(res, 409, { errorCode: 'VAR_WRONG_STAGE' });
    return;
  }
  if (actorMemberId === varPhase.requesterMemberId) {
    writeJson(res, 403, { errorCode: 'VAR_REQUESTER_CANNOT_VOTE' });
    return;
  }
  if (actorMemberId in varPhase.votes) {
    writeJson(res, 409, { errorCode: 'VAR_ALREADY_VOTED' });
    return;
  }
  varPhase.votes[actorMemberId] = vote;
  const eligibleVoters = room.members.filter((m) => m.memberId !== varPhase.requesterMemberId);
  const totalVoters = eligibleVoters.length;
  const votesReceived = Object.keys(varPhase.votes).length;
  broadcastRoomEvent(state, room.roomId, 'var_vote_update', {
    roomId: room.roomId,
    votesReceived,
    totalVoters,
  });
  // Check if all eligible voters have voted
  if (votesReceived >= totalVoters) {
    const agreeCount = Object.values(varPhase.votes).filter(Boolean).length;
    const majority = agreeCount > totalVoters / 2;
    if (varPhase.stage === 'VOTE_REPLAY') {
      if (majority) {
        varPhase.stage = 'REPLAYING';
        broadcastRoomEvent(state, room.roomId, 'var_replay_start', {
          roomId: room.roomId,
          frames: varPhase.replayFrames,
          activeCueBallId: varPhase.replayActiveCueBallId,
        });
      } else {
        room.varPhase = null;
        room.lastMissReplayData = null;
        startRoomTurnTimer(state, room);
        broadcastRoomEvent(state, room.roomId, 'var_dismissed', {
          roomId: room.roomId,
          currentMemberId: getCurrentTurnMemberId(room),
          turnDeadlineMs: room.turnDeadlineMs,
          activeCueBallId: room.activeCueBallId,
        });
      }
    } else if (varPhase.stage === 'VOTE_SCORE') {
      if (majority) {
        // Grant score: restore turn, apply score
        room.currentTurnIndex = varPhase.previousTurnIndex;
        room.activeCueBallId = varPhase.previousActiveCueBallId;
        // Restore ball positions
        for (const savedBall of varPhase.ballPositionsBeforeVAR) {
          const ball = room.balls.find((b) => b.id === savedBall.id);
          if (ball) {
            Object.assign(ball, savedBall);
          }
        }
        const scoreResult = increaseScoreAndCheckGameEnd(room.scoreBoard, varPhase.requesterMemberId);
        if (scoreResult.ok && scoreResult.gameEnded) {
          room.state = 'FINISHED';
          room.winnerMemberId = scoreResult.winnerPlayerId;
          room.memberGameStates = room.members.reduce<Record<string, 'WIN' | 'LOSE'>>((acc, member) => {
            acc[member.memberId] = member.memberId === scoreResult.winnerPlayerId ? 'WIN' : 'LOSE';
            return acc;
          }, {});
          cancelRoomTurnTimer(state, room.roomId);
        } else {
          startRoomTurnTimer(state, room);
        }
        room.varPhase = null;
        room.lastMissReplayData = null;
        broadcastRoomEvent(state, room.roomId, 'var_score_awarded', {
          roomId: room.roomId,
          scoreBoard: room.scoreBoard,
          currentMemberId: getCurrentTurnMemberId(room),
          turnDeadlineMs: room.turnDeadlineMs,
          activeCueBallId: room.activeCueBallId,
          balls: room.balls,
          gameFinished: scoreResult?.ok && scoreResult.gameEnded ? true : false,
          winnerMemberId: room.winnerMemberId,
        });
        if (scoreResult?.ok && scoreResult.gameEnded) {
          broadcastRoomEvent(state, room.roomId, 'game_finished', {
            roomId: room.roomId,
            winnerMemberId: room.winnerMemberId,
            memberGameStates: room.memberGameStates,
            scoreBoard: room.scoreBoard,
            serverTimeMs: Date.now(),
          });
        }
      } else {
        room.varPhase = null;
        room.lastMissReplayData = null;
        startRoomTurnTimer(state, room);
        broadcastRoomEvent(state, room.roomId, 'var_dismissed', {
          roomId: room.roomId,
          currentMemberId: getCurrentTurnMemberId(room),
          turnDeadlineMs: room.turnDeadlineMs,
          activeCueBallId: room.activeCueBallId,
        });
      }
    }
  }
  writeJson(res, 200, { ok: true });
}

async function handleVarReplayEnd(req: IncomingMessage, res: ServerResponse, state: LobbyState): Promise<void> {
  const match = req.url?.match(/^\/lobby\/rooms\/([^/]+)\/var-replay-end$/);
  const roomId = match?.[1];
  if (!roomId) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }
  const body = await parseJsonBody(req, res);
  if (!body) return;
  const actorMemberId = typeof body.actorMemberId === 'string' ? body.actorMemberId : '';
  const room = state.rooms.find((r) => r.roomId === roomId);
  if (!room) {
    writeJson(res, 404, { errorCode: 'ROOM_NOT_FOUND' });
    return;
  }
  if (!room.varPhase) {
    writeJson(res, 409, { errorCode: 'VAR_NOT_ACTIVE' });
    return;
  }
  if (room.varPhase.stage !== 'REPLAYING') {
    writeJson(res, 409, { errorCode: 'VAR_WRONG_STAGE' });
    return;
  }
  room.varPhase.stage = 'VOTE_SCORE';
  room.varPhase.votes = {};
  const totalVoters = room.members.filter((m) => m.memberId !== room.varPhase!.requesterMemberId).length;
  broadcastRoomEvent(state, room.roomId, 'var_vote_started', {
    roomId: room.roomId,
    requesterMemberId: room.varPhase.requesterMemberId,
    stage: 'VOTE_SCORE',
    totalVoters,
  });
  writeJson(res, 200, { ok: true });
}

const SIMULATE_MAX_FRAMES = 3000;

async function handleSimulate(req: IncomingMessage, res: ServerResponse): Promise<void> {
  const body = await parseJsonBody(req, res);
  if (!body) return;

  const rawBalls = body.balls;
  const rawShot = body.shot;
  if (!Array.isArray(rawBalls) || rawBalls.length === 0 || typeof rawShot !== 'object' || rawShot === null) {
    writeJson(res, 400, { errorCode: 'INVALID_INPUT' });
    return;
  }

  const shot = rawShot as Record<string, unknown>;
  const cueBallId = String(shot.cueBallId ?? 'cueBall');
  const directionDeg = Number(shot.directionDeg);
  const dragPx = Number(shot.dragPx);
  const impactOffsetX = -clampNumber(Number(shot.impactOffsetX), -0.9, 0.9);
  const impactOffsetY = clampNumber(Number(shot.impactOffsetY), -0.9, 0.9);

  const balls: PhysicsBallState[] = (rawBalls as Array<Record<string, unknown>>).map((b) => ({
    id: String(b.id),
    x: Number(b.x),
    y: Number(b.y),
    vx: 0,
    vy: 0,
    spinX: 0,
    spinY: 0,
    spinZ: 0,
    isPocketed: false,
  }));

  // Apply shot — identical to applyShotToRoomBalls
  const cueBall = balls.find((b) => b.id === cueBallId);
  if (!cueBall) {
    writeJson(res, 400, { errorCode: 'CUE_BALL_NOT_FOUND' });
    return;
  }

  const directionRad = (directionDeg * Math.PI) / 180;
  const shotInit = computeShotInitialization({ dragPx, impactOffsetX, impactOffsetY });
  const forwardX = Math.cos(directionRad);
  const forwardY = Math.sin(directionRad);
  cueBall.vx = forwardX * shotInit.initialBallSpeedMps;
  cueBall.vy = forwardY * shotInit.initialBallSpeedMps;
  cueBall.spinX = shotInit.omegaX * forwardY;
  cueBall.spinY = -shotInit.omegaX * forwardX;
  cueBall.spinZ = shotInit.omegaZ;

  type SimFrameBall = {
    id: string; x: number; y: number; vx: number; vy: number;
    spinX: number; spinY: number; spinZ: number; speed: number;
  };
  type SimFrame = { frameIndex: number; timeSec: number; balls: SimFrameBall[] };
  type SimEvent = { type: 'CUSHION' | 'BALL_BALL'; frameIndex: number; timeSec: number; ballId: string; targetId: string };

  const frames: SimFrame[] = [];
  const events: SimEvent[] = [];
  const tracker = initShotEndTracker();

  const captureFrame = (fi: number): void => {
    frames.push({
      frameIndex: fi,
      timeSec: fi * ROOM_PHYSICS_STEP_CONFIG.dtSec,
      balls: balls.map((b) => ({
        id: b.id, x: b.x, y: b.y, vx: b.vx, vy: b.vy,
        spinX: b.spinX, spinY: b.spinY, spinZ: b.spinZ,
        speed: Math.hypot(b.vx, b.vy),
      })),
    });
  };

  captureFrame(0);

  let frameIndex = 0;
  while (frameIndex < SIMULATE_MAX_FRAMES) {
    frameIndex += 1;
    const timeSec = frameIndex * ROOM_PHYSICS_STEP_CONFIG.dtSec;

    stepRoomPhysicsWorld(balls, ROOM_PHYSICS_STEP_CONFIG, {
      onCushionCollision: (ball, cushionId) => {
        events.push({ type: 'CUSHION', frameIndex, timeSec, ballId: ball.id, targetId: cushionId });
      },
      onBallCollision: (first, second) => {
        events.push({ type: 'BALL_BALL', frameIndex, timeSec, ballId: first.id, targetId: second.id });
      },
    });

    captureFrame(frameIndex);

    let maxLinearSpeed = 0;
    let maxAngularSpeed = 0;
    for (const ball of balls) {
      if (!ball.isPocketed) {
        maxLinearSpeed = Math.max(maxLinearSpeed, Math.hypot(ball.vx, ball.vy));
        maxAngularSpeed = Math.max(maxAngularSpeed, Math.hypot(ball.spinX, ball.spinY, ball.spinZ));
      }
    }

    const { isShotEnded } = evaluateShotEndWithFrames(tracker, { linearSpeedMps: maxLinearSpeed, angularSpeedRadps: maxAngularSpeed });
    if (isShotEnded) break;
  }

  writeJson(res, 200, {
    frames,
    events,
    totalTimeSec: frameIndex * ROOM_PHYSICS_STEP_CONFIG.dtSec,
    totalFrames: frameIndex,
  });
}

export function createLobbyRequestHandler(state: LobbyState) {
  return async (req: IncomingMessage, res: ServerResponse): Promise<void> => {
    applyCorsHeaders(req, res);
    if (req.method === 'OPTIONS') {
      res.statusCode = 204;
      res.end();
      return;
    }

    if (req.method === 'POST' && req.url === '/simulate') {
      await handleSimulate(req, res);
      return;
    }

    await ensureLobbyStateHydrated(state);

    if (req.method === 'GET' && req.url === '/lobby/chat') {
      handleGetLobbyChat(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url === '/lobby/chat') {
      await handleSendLobbyChat(req, res, state);
      return;
    }

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

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/replay-end')) {
      await handleReplayEnd(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/replay')) {
      await handleReplayRequest(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/var-request')) {
      await handleVarRequest(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/var-vote')) {
      await handleVarVote(req, res, state);
      return;
    }

    if (req.method === 'POST' && req.url?.startsWith('/lobby/rooms/') && req.url.endsWith('/var-replay-end')) {
      await handleVarReplayEnd(req, res, state);
      return;
    }

    writeJson(res, 404, { errorCode: 'NOT_FOUND' });
  };
}
