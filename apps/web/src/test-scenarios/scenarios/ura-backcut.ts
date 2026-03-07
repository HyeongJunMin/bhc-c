import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'ura-backcut',
  name: 'Back Cut (Ura)',
  description: '역각(우라) 컷 샷: 절단각으로 적구를 맞히면 큐볼이 역방향으로 튐',
  tags: ['cut', 'angle'],
  balls: [
    { id: 'cueBall', x: 1.39075, y: 0.43075 },
    { id: 'objectBall1', x: 2.07075, y: 0.47075 },
    { id: 'objectBall2', x: 0.09075, y: 0.10075 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 90,
    dragPx: 115,
    impactOffsetX: 0.003475,
    impactOffsetY: 0.003475,
  },
};

export default scenario;
