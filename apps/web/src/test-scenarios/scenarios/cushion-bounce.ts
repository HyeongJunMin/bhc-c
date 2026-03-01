import type { TestScenario } from '../types';

/**
 * cushion-bounce: 수구가 다중 쿠션을 거치는 3쿠션 경로.
 * spin 감쇠 누적, 속도 감소 패턴 검증.
 */
export const cushionBounce: TestScenario = {
  id: 'cushion-bounce',
  name: '3쿠션 경로',
  description: '수구가 다중 쿠션을 거치는 경로. spin 감쇠 누적, 속도 감소 패턴 검증.',
  balls: {
    cueBall:     { x: 0.70, z: 0.711 },
    objectBall1: { x: 2.50, z: 0.30 },
    objectBall2: { x: 2.50, z: 1.10 },
  },
  shot: {
    directionDeg: 30,
    dragPx: 280,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['cushion', '3-cushion'],
};
