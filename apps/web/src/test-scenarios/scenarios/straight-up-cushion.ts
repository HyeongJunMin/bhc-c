import type { TestScenario } from '../types';

/**
 * straight-up-cushion: 수구가 +Z 방향으로 직진하여 위쪽 쿠션에 수직 입사.
 * throw=0 확인, 쿠션 반발계수 검증.
 */
export const straightUpCushion: TestScenario = {
  id: 'straight-up-cushion',
  name: '직선 + 쿠션 반사',
  description: '수구가 +Z 방향으로 직진, 위쪽 쿠션에 수직 입사 후 반사. throw=0 확인.',
  balls: {
    cueBall:     { x: 1.422, z: 0.40 },
    objectBall1: { x: 2.10,  z: 0.62 },
    objectBall2: { x: 2.24,  z: 0.80 },
  },
  shot: {
    directionDeg: 90,
    dragPx: 180,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['straight', 'cushion'],
};
