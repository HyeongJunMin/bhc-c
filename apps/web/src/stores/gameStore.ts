import { create } from 'zustand';
import { Vector3 } from 'three';
import { PHYSICS, RULES } from '../lib/constants';
import { AIM_CONTROL_CONTRACT, type AimControlMode } from '../../../../packages/shared-types/src/aim-control.ts';
import { isValidThreeCushionScore } from '../../../../packages/physics-core/src/three-cushion-model.ts';

export type GamePhase = 'AIMING' | 'SHOOTING' | 'SIMULATING' | 'REPLAY_READY' | 'REPLAYING' | 'SCORING';
export type CueBallId = 'cueBall' | 'objectBall2';

export interface ReplayFrame {
  balls: Array<{ id: string; x: number; y: number }>;
}

export interface ReplayFrameData {
  frames: ReplayFrame[];
  activeCueBallId: CueBallId;
}

export interface ReplayHistoryEntry {
  frameData: ReplayFrameData;
  scorerName: string;
  shotNumber: number;
  scoreAtTime: string;
}

export interface BallState {
  id: 'cueBall' | 'objectBall1' | 'objectBall2';
  position: Vector3;
  velocity: Vector3;
  angularVelocity: Vector3;
  isPocketed: boolean;
}

export interface ShotInput {
  aimControlMode: AimControlMode;
  shotDirectionDeg: number;
  cueElevationDeg: number;
  dragPx: number;
  impactOffsetX: number;
  impactOffsetY: number;
}

export type SystemMode = 'half' | 'fiveAndHalf' | 'plusTwo';

export type TurnEvent = 
  | { type: 'cushion'; railId: string; timestamp: number }
  | { type: 'ball'; ballId: string; timestamp: number };

interface GameStore {
  // 게임 상태
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;
  
  // 공 상태
  balls: BallState[];
  updateBall: (id: string, updates: Partial<BallState>) => void;
  resetBalls: () => void;
  
  // 샷 입력
  shotInput: ShotInput;
  setShotDirection: (deg: number) => void;
  setAimControlMode: (mode: AimControlMode) => void;
  setCueElevation: (deg: number) => void;
  setDragPower: (px: number) => void;
  setImpactOffset: (x: number, y: number) => void;
  
  // 드래그 상태
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  
  // 게임 로직
  systemMode: SystemMode;
  setSystemMode: (mode: SystemMode) => void;
  currentPlayer: string;
  activeCueBallId: CueBallId;
  players: string[];
  scores: Record<string, number>;
  cushionContacts: number;
  objectBallsHit: Set<string>;
  turnMessage: string;
  turnStartedAtMs: number;
  turnEvents: TurnEvent[];
  
  // 액션
  addScore: (player: string) => void;
  nextPlayer: () => void;
  setTurnMessage: (message: string) => void;
  executeShot: () => void;
  resetShot: () => void;
  resetGame: () => void;
  
  // 3쿠션 이벤트 추적
  addCushionContact: (railId: string) => void;
  addBallCollision: (ballId: string) => void;
  resetTurnEvents: () => void;
  checkThreeCushionScore: () => boolean;
  handleTurnEnd: () => void;

  // 잔상 표시
  showBallTrail: boolean;
  toggleBallTrail: () => void;

  // 시점고정모드
  fixedViewMode: boolean;
  toggleFixedViewMode: () => void;

  // 리플레이
  replayFrameData: ReplayFrameData | null;
  replayCurrentFrame: number;
  replayIsPlaying: boolean;
  replayRemainingCount: number;
  replayHistory: ReplayHistoryEntry[];
  selectedHistoryReplayIndex: number | null;
  replayScorerMemberId: string | null;
  shotCount: number;
  saveReplayFrameData: (frameData: ReplayFrameData) => void;
  addToReplayHistory: (entry: ReplayHistoryEntry) => void;
  startReplay: () => void;
  startHistoryReplay: (index: number) => void;
  finishReplaySimulation: () => void;
  finishReplay: () => void;
  finishHistoryReplay: () => void;
  setReplayCurrentFrame: (frame: number) => void;
  toggleReplayPlaying: () => void;

  // 멀티플레이어
  multiplayerContext: {
    roomId: string;
    memberId: string;
    members: Array<{ memberId: string; displayName: string }>;
  } | null;
  setMultiplayerContext: (ctx: {
    roomId: string;
    memberId: string;
    members: Array<{ memberId: string; displayName: string }>;
  } | null) => void;
  isMyTurn: boolean;
  setIsMyTurn: (v: boolean) => void;
  canRequestVAR: boolean;
  varPhase: {
    stage: 'VOTE_REPLAY' | 'REPLAYING' | 'VOTE_SCORE';
    requesterMemberId: string;
    votesReceived: number;
    totalVoters: number;
    myVote: boolean | null;
  } | null;
  setCanRequestVAR: (can: boolean) => void;
  applyVarVoteStarted: (data: { stage: 'VOTE_REPLAY' | 'REPLAYING' | 'VOTE_SCORE'; requesterMemberId: string; totalVoters: number }) => void;
  applyVarVoteUpdate: (data: { votesReceived: number; totalVoters: number }) => void;
  applyVarReplayStart: (data: { frames: Array<{ balls: Array<{ id: string; x: number; y: number }> }>; activeCueBallId: 'cueBall' | 'objectBall2' }) => void;
  applyVarDismissed: (data: { currentMemberId: string | null; turnDeadlineMs: number | null; activeCueBallId?: CueBallId }) => void;
  applyVarScoreAwarded: (data: { scoreBoard: Record<string, number>; currentMemberId: string | null; turnDeadlineMs: number | null; activeCueBallId?: CueBallId; balls?: Array<{ id: string; x: number; y: number; vx: number; vy: number; spinX: number; spinY: number; spinZ: number; isPocketed: boolean }> }) => void;
  setMyVarVote: (vote: boolean) => void;
  applyServerTurnChanged: (data: { currentMemberId: string | null; turnDeadlineMs: number | null; activeCueBallId?: CueBallId }) => void;
  applyServerGameFinished: (data: { winnerMemberId: string | null; memberGameStates: Record<string, string> }) => void;
}

// 3쿠션 초구 세팅
const headSpotX = -PHYSICS.TABLE_WIDTH * 0.25;
const footSpotX = PHYSICS.TABLE_WIDTH * 0.25;
const AIM_MODE_STORAGE_KEY = 'bhc.aimControlMode';
const FIXED_VIEW_MODE_STORAGE_KEY = 'bhc.fixedViewMode';

function readInitialAimControlMode(): AimControlMode {
  if (typeof window === 'undefined') {
    return AIM_CONTROL_CONTRACT.defaultMode;
  }
  const raw = window.sessionStorage.getItem(AIM_MODE_STORAGE_KEY);
  return raw === 'MANUAL_AIM' || raw === 'AUTO_SYNC' ? raw : AIM_CONTROL_CONTRACT.defaultMode;
}

function readInitialFixedViewMode(): boolean {
  if (typeof window === 'undefined') return false;
  return window.sessionStorage.getItem(FIXED_VIEW_MODE_STORAGE_KEY) === 'true';
}

const createInitialBalls = (): BallState[] => {
  return [
    {
      id: 'cueBall',
      position: new Vector3(headSpotX, PHYSICS.BALL_RADIUS, -0.1524),
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      isPocketed: false,
    },
    {
      id: 'objectBall1',
      position: new Vector3(footSpotX, PHYSICS.BALL_RADIUS, 0),
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      isPocketed: false,
    },
    {
      id: 'objectBall2',
      position: new Vector3(headSpotX, PHYSICS.BALL_RADIUS, 0),
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      isPocketed: false,
    },
  ];
};

export const useGameStore = create<GameStore>((set, get) => ({
  // 초기 상태
  phase: 'AIMING',
  balls: createInitialBalls(),
  shotInput: {
    aimControlMode: readInitialAimControlMode(),
    shotDirectionDeg: 90,
    cueElevationDeg: 0,
    dragPx: 10 as number,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  isDragging: false,
  systemMode: 'half',
  setSystemMode: (mode) => set({ systemMode: mode }),
  currentPlayer: 'player1',
  activeCueBallId: 'cueBall',
  players: ['player1', 'player2'],
  scores: { player1: 0, player2: 0 },
  cushionContacts: 0,
  objectBallsHit: new Set(),
  turnMessage: '',
  turnStartedAtMs: Date.now(),
  turnEvents: [],
  showBallTrail: false,
  toggleBallTrail: () => set((state) => ({ showBallTrail: !state.showBallTrail })),

  fixedViewMode: readInitialFixedViewMode(),
  toggleFixedViewMode: () => {
    const next = !get().fixedViewMode;
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(FIXED_VIEW_MODE_STORAGE_KEY, String(next));
    }
    set({ fixedViewMode: next });
  },

  // 리플레이 초기 상태
  replayFrameData: null,
  replayCurrentFrame: 0,
  replayIsPlaying: false,
  replayRemainingCount: 0,
  replayHistory: [],
  selectedHistoryReplayIndex: null,
  replayScorerMemberId: null,
  shotCount: 0,

  saveReplayFrameData: (frameData) => set({ replayFrameData: frameData }),

  addToReplayHistory: (entry) => set((state) => ({
    replayHistory: [...state.replayHistory, entry],
  })),

  startReplay: () => set({ phase: 'REPLAYING', turnMessage: 'REPLAY', replayCurrentFrame: 0, replayIsPlaying: true }),

  startHistoryReplay: (index) => set((state) => ({
    selectedHistoryReplayIndex: index,
    replayFrameData: state.replayHistory[index]?.frameData ?? null,
    phase: 'REPLAYING',
    replayCurrentFrame: 0,
    replayIsPlaying: true,
  })),

  finishReplaySimulation: () => {
    const state = get();
    if (state.multiplayerContext) {
      // 멀티플레이어: 항상 REPLAY_READY로 (서버가 remainingReplays 관리, GameScene에서 auto-end 처리)
      set({ phase: 'REPLAY_READY' });
    } else {
      // 로컬: 카운트가 0이 되면 자동 종료
      const newCount = state.replayRemainingCount - 1;
      if (newCount <= 0) {
        set({
          replayRemainingCount: 0,
          phase: 'AIMING',
          replayFrameData: null,
          replayCurrentFrame: 0,
          replayIsPlaying: false,
          turnMessage: 'SCORE! +1 Point',
          turnStartedAtMs: Date.now(),
        });
      } else {
        set({ replayRemainingCount: newCount, phase: 'REPLAY_READY' });
      }
    }
  },

  finishReplay: () => set({
    phase: 'AIMING',
    replayFrameData: null,
    replayCurrentFrame: 0,
    replayIsPlaying: false,
    replayRemainingCount: 0,
    replayScorerMemberId: null,
    turnMessage: 'SCORE! +1 Point',
    turnStartedAtMs: Date.now(),
  }),

  finishHistoryReplay: () => set({
    phase: 'SCORING',
    selectedHistoryReplayIndex: null,
    replayIsPlaying: false,
  }),

  setReplayCurrentFrame: (frame) => set({ replayCurrentFrame: frame }),
  toggleReplayPlaying: () => set((state) => ({ replayIsPlaying: !state.replayIsPlaying })),

  multiplayerContext: null,
  setMultiplayerContext: (ctx) => {
    if (!ctx) {
      set({ multiplayerContext: null });
      return;
    }
    const players = ctx.members.map((m) => m.displayName);
    const scores = ctx.members.reduce<Record<string, number>>((acc, m) => {
      acc[m.displayName] = 0;
      return acc;
    }, {});
    set({ multiplayerContext: ctx, players, scores, isMyTurn: false });
  },
  isMyTurn: false,
  setIsMyTurn: (v) => set({ isMyTurn: v }),
  canRequestVAR: false,
  varPhase: null,
  setCanRequestVAR: (can) => set({ canRequestVAR: can }),
  applyVarVoteStarted: (data) => set({
    varPhase: {
      stage: data.stage,
      requesterMemberId: data.requesterMemberId,
      votesReceived: 0,
      totalVoters: data.totalVoters,
      myVote: null,
    },
  }),
  applyVarVoteUpdate: (data) => set((state) => ({
    varPhase: state.varPhase ? { ...state.varPhase, votesReceived: data.votesReceived, totalVoters: data.totalVoters } : null,
  })),
  applyVarReplayStart: (data) => set({
    phase: 'REPLAYING',
    replayFrameData: { frames: data.frames, activeCueBallId: data.activeCueBallId },
    replayCurrentFrame: 0,
    replayIsPlaying: true,
    varPhase: (get().varPhase) ? { ...get().varPhase!, stage: 'REPLAYING' } : null,
  }),
  applyVarDismissed: (data) => {
    const ctx = get().multiplayerContext;
    if (!ctx) {
      set({ varPhase: null, canRequestVAR: false });
      return;
    }
    const currentMember = ctx.members.find((m) => m.memberId === data.currentMemberId);
    set({
      varPhase: null,
      canRequestVAR: false,
      currentPlayer: currentMember?.displayName ?? data.currentMemberId ?? '',
      isMyTurn: data.currentMemberId === ctx.memberId,
      activeCueBallId: data.activeCueBallId ?? get().activeCueBallId,
      phase: 'AIMING',
      turnStartedAtMs: Date.now(),
    });
  },
  applyVarScoreAwarded: (data) => {
    const state = get();
    const ctx = state.multiplayerContext;
    if (!ctx) return;
    const newScores: Record<string, number> = {};
    for (const member of ctx.members) {
      newScores[member.displayName] = data.scoreBoard[member.memberId] ?? 0;
    }
    const isMyTurn = data.currentMemberId === ctx.memberId;
    set({
      scores: newScores,
      varPhase: null,
      canRequestVAR: false,
      currentPlayer: ctx.members.find((m) => m.memberId === data.currentMemberId)?.displayName ?? data.currentMemberId ?? '',
      isMyTurn,
      activeCueBallId: data.activeCueBallId ?? 'cueBall',
      phase: 'AIMING',
      turnStartedAtMs: Date.now(),
    });
  },
  setMyVarVote: (vote) => set((state) => ({
    varPhase: state.varPhase ? { ...state.varPhase, myVote: vote } : null,
  })),

  applyServerTurnChanged: (data) => {
    const state = get();
    const ctx = state.multiplayerContext;
    if (!ctx) return;
    const currentMemberId = data.currentMemberId;
    const isMyTurn = currentMemberId === ctx.memberId;
    const currentMember = ctx.members.find((m) => m.memberId === currentMemberId);
    const currentPlayerDisplay = currentMember?.displayName ?? currentMemberId ?? '';
    set({
      currentPlayer: currentPlayerDisplay,
      isMyTurn,
      phase: 'AIMING',
      activeCueBallId: data.activeCueBallId ?? 'cueBall',
      turnStartedAtMs: Date.now(),
      turnEvents: [],
      cushionContacts: 0,
      objectBallsHit: new Set(),
      replayScorerMemberId: null,
      replayRemainingCount: 0,
      shotInput: {
        ...state.shotInput,
        dragPx: 10,
        impactOffsetX: 0,
        impactOffsetY: 0,
      },
    });
  },

  applyServerGameFinished: (data) => {
    const ctx = get().multiplayerContext;
    const winnerMember = ctx?.members.find((m) => m.memberId === data.winnerMemberId);
    const winnerName = winnerMember?.displayName ?? data.winnerMemberId ?? 'Unknown';
    set({ phase: 'SCORING', turnMessage: `${winnerName} WINS!` });
  },

  // 기본 액션
  setPhase: (phase) => set({ phase }),
  
  updateBall: (id, updates) => set((state) => ({
    balls: state.balls.map((b) => 
      b.id === id ? { ...b, ...updates } : b
    ),
  })),
  
  resetBalls: () => set(() => ({ balls: createInitialBalls() })),
  
  setShotDirection: (deg) => set((state) => ({
    shotInput: { ...state.shotInput, shotDirectionDeg: deg },
  })),

  setAimControlMode: (mode) => {
    if (typeof window !== 'undefined') {
      window.sessionStorage.setItem(AIM_MODE_STORAGE_KEY, mode);
    }
    set((state) => ({
      shotInput: { ...state.shotInput, aimControlMode: mode },
    }));
  },
  
  setCueElevation: (deg) => set((state) => ({
    shotInput: { ...state.shotInput, cueElevationDeg: deg },
  })),
  
  setDragPower: (px: number) => set((state) => ({
    shotInput: { ...state.shotInput, dragPx: px as number },
  })),
  
  setImpactOffset: (x, y) => set((state) => ({
    shotInput: { ...state.shotInput, impactOffsetX: x, impactOffsetY: y },
  })),
  
  setIsDragging: (dragging) => set({ isDragging: dragging }),
  
  addScore: (player) => set((state) => ({
    scores: { ...state.scores, [player]: (state.scores[player] || 0) + 1 },
  })),
  
  nextPlayer: () => set((state) => {
    const currentIndex = state.players.indexOf(state.currentPlayer);
    const nextIndex = (currentIndex + 1) % state.players.length;
    return { currentPlayer: state.players[nextIndex] };
  }),
  
  setTurnMessage: (message) => set({ turnMessage: message }),
  
  executeShot: () => {
    set({ 
      phase: 'SHOOTING', 
      turnMessage: '', 
      isDragging: false,
      turnEvents: [],
      cushionContacts: 0,
      objectBallsHit: new Set(),
    });
  },
  
  resetShot: () => set(() => ({
    phase: 'AIMING',
    shotInput: {
      aimControlMode: AIM_CONTROL_CONTRACT.defaultMode,
      shotDirectionDeg: 90,
      cueElevationDeg: 0,
      dragPx: 10,
      impactOffsetX: 0,
      impactOffsetY: 0,
    },
    isDragging: false,
    turnMessage: '',
    turnStartedAtMs: Date.now(),
  })),
  
  resetGame: () => set(() => ({
    phase: 'AIMING',
    balls: createInitialBalls(),
    scores: { player1: 0, player2: 0 },
    currentPlayer: 'player1',
    activeCueBallId: 'cueBall',
    systemMode: 'half',
    turnMessage: '',
    turnStartedAtMs: Date.now(),
    isDragging: false,
    turnEvents: [],
    cushionContacts: 0,
    objectBallsHit: new Set(),
    shotInput: {
      aimControlMode: AIM_CONTROL_CONTRACT.defaultMode,
      shotDirectionDeg: 90,
      cueElevationDeg: 0,
      dragPx: 10,
      impactOffsetX: 0,
      impactOffsetY: 0,
    },
    replayFrameData: null,
    replayCurrentFrame: 0,
    replayIsPlaying: false,
    replayRemainingCount: 0,
    replayHistory: [],
    selectedHistoryReplayIndex: null,
    replayScorerMemberId: null,
    shotCount: 0,
  })),

  // 3쿠션 이벤트 추적
  addCushionContact: (railId) => set((state) => {
    const newEvents = [...state.turnEvents, { 
      type: 'cushion' as const, 
      railId, 
      timestamp: Date.now() 
    }];
    const cushionCount = newEvents.filter(e => e.type === 'cushion').length;
    return { 
      turnEvents: newEvents,
      cushionContacts: cushionCount,
    };
  }),
  
  addBallCollision: (ballId) => set((state) => {
    const newEvents = [...state.turnEvents, { 
      type: 'ball' as const, 
      ballId, 
      timestamp: Date.now() 
    }];
    const newSet = new Set(state.objectBallsHit);
    newSet.add(ballId);
    return { 
      turnEvents: newEvents,
      objectBallsHit: newSet,
    };
  }),
  
  resetTurnEvents: () => set({ 
    turnEvents: [],
    cushionContacts: 0, 
    objectBallsHit: new Set() 
  }),
  
  checkThreeCushionScore: () => {
    const state = get();
    const cueBallId = state.activeCueBallId;
    const objectBallIds: [string, string] = cueBallId === 'cueBall'
      ? ['objectBall1', 'objectBall2']
      : ['objectBall1', 'cueBall'];

    const events = state.turnEvents.map((e) => {
      if (e.type === 'cushion') {
        return { type: 'CUSHION_COLLISION' as const, atMs: e.timestamp, sourceBallId: cueBallId, cushionId: e.railId };
      } else {
        return { type: 'BALL_COLLISION' as const, atMs: e.timestamp, sourceBallId: cueBallId, targetBallId: e.ballId };
      }
    });

    return isValidThreeCushionScore({ cueBallId, objectBallIds, events });
  },

  handleTurnEnd: () => {
    const state = get();
    // 멀티플레이어: 서버가 턴/스코어를 관리하므로 로컬 처리 스킵
    if (state.multiplayerContext) {
      return;
    }
    const scored = state.checkThreeCushionScore();
    const newShotCount = state.shotCount + 1;

    if (scored) {
      const currentScore = (state.scores[state.currentPlayer] || 0) + 1;
      const newScores = { ...state.scores, [state.currentPlayer]: currentScore };

      // 히스토리에 리플레이 추가
      if (state.replayFrameData) {
        const scoreAtTime = Object.entries(newScores)
          .map(([p, s]) => s)
          .join('-');
        get().addToReplayHistory({
          frameData: state.replayFrameData,
          scorerName: state.currentPlayer,
          shotNumber: newShotCount,
          scoreAtTime,
        });
      }

      // 10점 체크
      if (currentScore >= RULES.WINNING_SCORE) {
        set({
          scores: newScores,
          phase: 'SCORING',
          turnMessage: `${state.currentPlayer.toUpperCase()} WINS!`,
          turnEvents: [],
          cushionContacts: 0,
          objectBallsHit: new Set(),
          shotCount: newShotCount,
        });
        return;
      }

      // 득점 시 리플레이 대기 (프레임 데이터 있을 때)
      if (state.replayFrameData) {
        set({
          scores: newScores,
          currentPlayer: state.currentPlayer,
          activeCueBallId: state.activeCueBallId,
          turnMessage: 'SCORE! +1 Point',
          phase: 'REPLAY_READY',
          replayRemainingCount: 3,
          turnEvents: [],
          cushionContacts: 0,
          objectBallsHit: new Set(),
          shotCount: newShotCount,
          shotInput: {
            ...state.shotInput,
            dragPx: 10,
            impactOffsetX: 0,
            impactOffsetY: 0,
          },
        });
      } else {
        set({
          scores: newScores,
          currentPlayer: state.currentPlayer,
          activeCueBallId: state.activeCueBallId,
          turnMessage: 'SCORE! +1 Point',
          phase: 'AIMING',
          turnStartedAtMs: Date.now(),
          turnEvents: [],
          cushionContacts: 0,
          objectBallsHit: new Set(),
          shotCount: newShotCount,
          shotInput: {
            ...state.shotInput,
            dragPx: 10,
            impactOffsetX: 0,
            impactOffsetY: 0,
          },
        });
      }
      return;
    } else {
      // 실패 시 턴 전환
      const currentIndex = state.players.indexOf(state.currentPlayer);
      const nextPlayer = state.players[(currentIndex + 1) % state.players.length];
      const nextCueBallId: CueBallId = state.activeCueBallId === 'cueBall' ? 'objectBall2' : 'cueBall';
      set({
        currentPlayer: nextPlayer,
        activeCueBallId: nextCueBallId,
        turnMessage: 'MISS - Turn Over',
        phase: 'AIMING',
        turnStartedAtMs: Date.now(),
        turnEvents: [],
        cushionContacts: 0,
        objectBallsHit: new Set(),
        replayFrameData: null,
        replayCurrentFrame: 0,
        replayIsPlaying: false,
        shotCount: newShotCount,
        shotInput: {
          ...state.shotInput,
          dragPx: 10,
          impactOffsetX: 0,
          impactOffsetY: 0,
        },
      });
    }
  },
}));
