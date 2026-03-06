import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'cushion-bounce',
  name: 'Cushion Bounce',
  description: '우측 쿠션 바운스 후 적구 맞히기',
  tags: ['cushion', 'angle'],
  balls: [
    { id: 'cueBall', x: 0.7, y: 0.711 },
    { id: 'objectBall1', x: 2.1, y: 0.3 },
    { id: 'objectBall2', x: 1.0, y: 1.2 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 60,
    dragPx: 250,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
};

export default scenario;
