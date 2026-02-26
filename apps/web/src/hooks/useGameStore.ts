import { create } from 'zustand';
import { Vector3 } from 'three';
import { BallState, GamePhase, ShotInput } from '../types';
import { PHYSICS } from '../lib/constants';

interface GameStore {
  // 게임 상태
  phase: GamePhase;
  setPhase: (phase: GamePhase) => void;
  
  // 공 상태
  balls: BallState[];
  updateBall: (id: string, updates: Partial<BallState>) => void;
  resetBalls: () => void;
  
  // 큐 입력
  shotInput: ShotInput;
  setShotDirection: (deg: number) => void;
  setCueElevation: (deg: number) => void;
  setDragPower: (px: number) => void;
  setImpactOffset: (x: number, y: number) => void;
  
  // 드래그 상태 (침대 고정용)
  isDragging: boolean;
  setIsDragging: (dragging: boolean) => void;
  
  // 게임 로직
  currentPlayer: string;
  players: string[];
  scores: Record<string, number>;
  cushionContacts: number;
  objectBallsHit: Set<string>;
  turnMessage: string;
  
  // 액션
  addScore: (player: string) => void;
  nextPlayer: () => void;
  setTurnMessage: (message: string) => void;
  executeShot: () => void;
  resetShot: () => void;
  resetGame: () => void;
}

/**
 * 3쿠션 초구 세팅 (이미지 기준)
 * - 당구대: 2844mm(가로) x 1422mm(세로)
 * - X축: 가로(좌우), Z축: 세로(위아래)
 * 
 * 이미지 배치:
 * - 왼쪽(Head): 노란공(제2적구) 위쪽, 수구 아래쪽
 * - 오른쪽(Foot): 빨간공(제1적구)
 */
// Head Spot (왼쪽 1/4)과 Foot Spot (오른쪽 1/4) 위치
const headSpotX = -PHYSICS.TABLE_WIDTH * 0.25;
const footSpotX = PHYSICS.TABLE_WIDTH * 0.25;

/**
 * 3쿠션 초구 세팅 (이미지 기준)
 * - 당구대: 2844mm(가로) x 1422mm(세로)
 * - X축: 가로(좌우), Z축: 세로(위아래)
 * 
 * 이미지 배치:
 * - 왼쪽(Head): 노란공(제2적구) 위쪽, 수구 아래쪽
 * - 오른쪽(Foot): 빨간공(제1적구)
 */
const initialBallPositions = {
  // 수구 (흰 공): Head Spot에서 아래쪽(Z-)으로 15.24cm
  cueBall: new Vector3(headSpotX, PHYSICS.BALL_RADIUS, -0.1524),
  
  // 제2적구 (노란 공): Head Spot (위쪽)
  objectBall2: new Vector3(headSpotX, PHYSICS.BALL_RADIUS, 0),
  
  // 제1적구 (빨간 공): Foot Spot (오른쪽 멀리)
  objectBall1: new Vector3(footSpotX, PHYSICS.BALL_RADIUS, 0),
};

const createInitialBalls = (): BallState[] => [
  {
    id: 'cueBall',
    position: initialBallPositions.cueBall.clone(),
    velocity: new Vector3(0, 0, 0),
    angularVelocity: new Vector3(0, 0, 0),
    isPocketed: false,
  },
  {
    id: 'objectBall1',
    position: initialBallPositions.objectBall1.clone(),
    velocity: new Vector3(0, 0, 0),
    angularVelocity: new Vector3(0, 0, 0),
    isPocketed: false,
  },
  {
    id: 'objectBall2',
    position: initialBallPositions.objectBall2.clone(),
    velocity: new Vector3(0, 0, 0),
    angularVelocity: new Vector3(0, 0, 0),
    isPocketed: false,
  },
];

export const useGameStore = create<GameStore>((set) => ({
  // 초기 상태 - direction: 90° = +X (왼쪽→오른쪽)
  phase: 'AIMING',
  balls: createInitialBalls(),
  shotInput: {
    shotDirectionDeg: 90,  // 90° = +X 방향 (가로)
    cueElevationDeg: 0,
    dragPx: 10,
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

  // 액션
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
  
  setCueElevation: (deg) => set((state) => ({
    shotInput: { ...state.shotInput, cueElevationDeg: deg },
  })),
  
  setDragPower: (px) => set((state) => ({
    shotInput: { ...state.shotInput, dragPx: px },
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
    set({ phase: 'SHOOTING', turnMessage: '', isDragging: false });
  },
  
  resetShot: () => set(() => ({
    phase: 'AIMING',
    shotInput: {
      shotDirectionDeg: 0,  // 0° = +Z 방향
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
    shotInput: {
      shotDirectionDeg: 0,  // 0° = +Z 방향
      cueElevationDeg: 0,
      dragPx: 10,
      impactOffsetX: 0,
      impactOffsetY: 0,
    },
  })),
}));
