import type { TestScenario } from '../types';

/**
 * straight-right: 수구가 +X 방향으로 직진하여 제1적구 정면 충돌.
 * 스핀 없음. ball-ball 충돌 속도 전달 및 반발계수 검증.
 */
export const straightRight: TestScenario = {
  id: 'straight-right',
  name: '직선 히트 (+X)',
  description: '수구가 +X 방향으로 직진하여 제1적구 정면 충돌. 스핀 없음.',
  balls: {
    cueBall:     { x: 0.70, z: 0.711 },
    objectBall1: { x: 2.10, z: 0.711 },
    objectBall2: { x: 2.24, z: 0.900 },
  },
  shot: {
    directionDeg: 0,
    dragPx: 200,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['straight', 'ball-ball'],
};
