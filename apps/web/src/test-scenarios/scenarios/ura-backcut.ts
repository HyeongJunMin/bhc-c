import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'ura-backcut',
  name: 'Back Cut (Ura)',
  description: '역각(우라) 컷 샷: 절단각으로 적구를 맞히면 큐볼이 역방향으로 튐',
  tags: ['cut', 'angle'],
  balls: [
    { id: 'cueBall', x: 0.5, y: 0.711 },
    { id: 'objectBall1', x: 1.5, y: 0.35 },
    { id: 'objectBall2', x: 2.3, y: 1.0 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 70,
    dragPx: 200,
    impactOffsetX: 0,
    impactOffsetY: -0.015,
  },
};

export default scenario;
