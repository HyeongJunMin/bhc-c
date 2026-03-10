import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'straight-up-cushion',
  name: 'Straight Up Cushion',
  description: '큐볼이 상단 쿠션에 정면 충돌 후 반사',
  tags: ['cushion', 'basic'],
  balls: [
    { id: 'cueBall', x: 1.422, y: 0.5 },
    { id: 'objectBall1', x: 0.7, y: 1.2 },
    { id: 'objectBall2', x: 2.1, y: 1.2 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 0,
    dragPx: 200,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
};

export default scenario;
