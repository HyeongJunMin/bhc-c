import type { TestScenario } from '../types';

/**
 * angle-45: 수구가 45° 대각선 방향으로 진행 후 쿠션 충돌.
 * 입사각≈반사각, 마찰 감속 패턴 검증.
 */
export const angle45: TestScenario = {
  id: 'angle-45',
  name: '45° 대각선',
  description: '수구가 45° 대각선으로 진행 후 쿠션 충돌. 입사각≈반사각, 마찰 감속 검증.',
  balls: {
    cueBall:     { x: 0.80, z: 0.40 },
    objectBall1: { x: 2.10, z: 0.62 },
    objectBall2: { x: 2.24, z: 0.80 },
  },
  shot: {
    directionDeg: 45,
    dragPx: 220,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['cushion'],
};
