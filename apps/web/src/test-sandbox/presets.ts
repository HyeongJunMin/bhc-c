import type { SandboxInput, SandboxPreset } from './types';

export const DEFAULT_SANDBOX_INPUT: SandboxInput = {
  balls: {
    cueBall: { x: 0.7, z: 0.711 },
    objectBall1: { x: 2.1, z: 0.711 },
    objectBall2: { x: 2.24, z: 0.9 },
  },
  shot: {
    directionDeg: 0,
    dragPx: 200,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
};

export const SANDBOX_PRESETS: SandboxPreset[] = [
  {
    id: 'straight-right',
    name: '직선 히트',
    description: '정면 충돌 기본값',
    input: DEFAULT_SANDBOX_INPUT,
  },
  {
    id: 'straight-up-cushion',
    name: '상단 쿠션',
    description: '수구를 +Z 방향으로 쿠션 충돌',
    input: {
      balls: {
        cueBall: { x: 1.2, z: 0.35 },
        objectBall1: { x: 2.3, z: 0.95 },
        objectBall2: { x: 2.4, z: 1.18 },
      },
      shot: {
        directionDeg: 90,
        dragPx: 180,
        impactOffsetX: 0,
        impactOffsetY: 0,
      },
    },
  },
  {
    id: 'angle-45',
    name: '45도 각도',
    description: '중간 파워의 대각 진행',
    input: {
      balls: {
        cueBall: { x: 0.65, z: 0.32 },
        objectBall1: { x: 1.74, z: 1.06 },
        objectBall2: { x: 2.26, z: 0.37 },
      },
      shot: {
        directionDeg: 45,
        dragPx: 220,
        impactOffsetX: 0,
        impactOffsetY: 0,
      },
    },
  },
  {
    id: 'cushion-bounce',
    name: '쿠션 바운스',
    description: '쿠션 반사 후 목적구 접근',
    input: {
      balls: {
        cueBall: { x: 1.05, z: 0.54 },
        objectBall1: { x: 2.35, z: 0.56 },
        objectBall2: { x: 2.3, z: 0.95 },
      },
      shot: {
        directionDeg: 16,
        dragPx: 240,
        impactOffsetX: 0,
        impactOffsetY: 0,
      },
    },
  },
  {
    id: 'spin-english',
    name: '잉글리시 스핀',
    description: '당점 오프셋을 포함한 샷',
    input: {
      balls: {
        cueBall: { x: 0.74, z: 0.56 },
        objectBall1: { x: 1.85, z: 0.82 },
        objectBall2: { x: 2.3, z: 0.6 },
      },
      shot: {
        directionDeg: 24,
        dragPx: 260,
        impactOffsetX: 0.012,
        impactOffsetY: -0.006,
      },
    },
  },
];
