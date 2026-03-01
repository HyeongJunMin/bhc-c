import type { TestScenario } from '../types';

/**
 * spin-english: 좌 잉글리시(사이드스핀)를 가한 샷.
 * throw 효과, 경로 편향, squirt 검증.
 */
export const spinEnglish: TestScenario = {
  id: 'spin-english',
  name: '좌 잉글리시',
  description: '좌 잉글리시(사이드스핀) 샷. throw 효과, 경로 편향, squirt 검증.',
  balls: {
    cueBall:     { x: 0.80, z: 0.711 },
    objectBall1: { x: 2.10, z: 0.711 },
    objectBall2: { x: 2.24, z: 0.80 },
  },
  shot: {
    directionDeg: 0,
    dragPx: 200,
    impactOffsetX: -0.02,  // 좌측 당점 (좌 잉글리시)
    impactOffsetY: 0,
  },
  tags: ['spin', 'cushion'],
};
