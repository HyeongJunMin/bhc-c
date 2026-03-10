import type { TestScenario } from '../types.ts';

// TABLE: 2.844 x 1.422 m, center = (1.422, 0.711)
const scenario: TestScenario = {
  id: 'straight-right',
  name: 'Straight Right',
  description: '큐볼이 우측 방향으로 직진하여 적구를 정면 충돌',
  tags: ['basic', 'direct'],
  balls: [
    { id: 'cueBall', x: 0.5, y: 0.711 },
    { id: 'objectBall1', x: 1.9, y: 0.711 },
    { id: 'objectBall2', x: 2.5, y: 0.711 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 90,
    dragPx: 200,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
};

export default scenario;
