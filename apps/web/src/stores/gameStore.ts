import { create } from 'zustand';
import { Vector3 } from 'three';
import { PHYSICS, RULES } from '../lib/constants';
import { AIM_CONTROL_CONTRACT, type AimControlMode } from '../../../../packages/shared-types/src/aim-control.ts';

export type GamePhase = 'AIMING' | 'SHOOTING' | 'SIMULATING' | 'SCORING';

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
  currentPlayer: string;
  players: string[];
  scores: Record<string, number>;
  cushionContacts: number;
  objectBallsHit: Set<string>;
  turnMessage: string;
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
}

// 3쿠션 초구 세팅
const headSpotX = -PHYSICS.TABLE_WIDTH * 0.25;
const footSpotX = PHYSICS.TABLE_WIDTH * 0.25;
const AIM_MODE_STORAGE_KEY = 'bhc.aimControlMode';

function readInitialAimControlMode(): AimControlMode {
  if (typeof window === 'undefined') {
    return AIM_CONTROL_CONTRACT.defaultMode;
  }
  const raw = window.sessionStorage.getItem(AIM_MODE_STORAGE_KEY);
  return raw === 'MANUAL_AIM' || raw === 'AUTO_SYNC' ? raw : AIM_CONTROL_CONTRACT.defaultMode;
}

const createInitialBalls = (): BallState[] => [
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
  currentPlayer: 'player1',
  players: ['player1', 'player2'],
  scores: { player1: 0, player2: 0 },
  cushionContacts: 0,
  objectBallsHit: new Set(),
  turnMessage: '',
  turnEvents: [],

  // 기본 액션
  setPhase: (phase) => set({ phase }),
  
  updateBall: (id, updates) => set((state) => ({
    balls: state.balls.map((b) => 
      b.id === id ? { ...b, ...updates } : b
    ),
  })),
  
  resetBalls: () => set({ balls: createInitialBalls() }),
  
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
  })),
  
  resetGame: () => set(() => ({
    phase: 'AIMING',
    balls: createInitialBalls(),
    scores: { player1: 0, player2: 0 },
    currentPlayer: 'player1',
    turnMessage: '',
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
    const cushionCount = state.turnEvents.filter(e => e.type === 'cushion').length;
    const hitBalls = new Set(
      state.turnEvents
        .filter((e): e is { type: 'ball'; ballId: string; timestamp: number } => e.type === 'ball')
        .map(e => e.ballId)
    );
    
    return cushionCount >= 3 && hitBalls.has('objectBall1') && hitBalls.has('objectBall2');
  },

  handleTurnEnd: () => {
    const state = get();
    const scored = state.checkThreeCushionScore();
    
    if (scored) {
      const currentScore = (state.scores[state.currentPlayer] || 0) + 1;
      const newScores = { ...state.scores, [state.currentPlayer]: currentScore };
      
      // 10점 체크
      if (currentScore >= RULES.WINNING_SCORE) {
        set({ 
          scores: newScores,
          phase: 'SCORING',
          turnMessage: `${state.currentPlayer.toUpperCase()} WINS!`,
          turnEvents: [],
          cushionContacts: 0,
          objectBallsHit: new Set(),
        });
        return;
      }
      
      // 득점 시 턴 유지
      set({ 
        scores: newScores,
        turnMessage: 'SCORE! +1 Point',
        phase: 'AIMING',
        turnEvents: [],
        cushionContacts: 0,
        objectBallsHit: new Set(),
      });
    } else {
      // 실패 시 턴 전환
      const currentIndex = state.players.indexOf(state.currentPlayer);
      const nextPlayer = state.players[(currentIndex + 1) % state.players.length];
      set({ 
        currentPlayer: nextPlayer,
        turnMessage: 'MISS - Turn Over',
        phase: 'AIMING',
        turnEvents: [],
        cushionContacts: 0,
        objectBallsHit: new Set(),
      });
    }
  },
}));
