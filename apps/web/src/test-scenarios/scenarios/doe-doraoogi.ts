import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'doe-doraoogi',
  name: '되돌아오기',
  description: '수구가 OB1을 맞힌 뒤 쿠션에 반사되어 되돌아와 OB2에 도달하는 패턴',
  tags: ['three-cushion', 'doe-doraoogi', 'pattern'],
  balls: [
    { id: 'cueBall', x: 1.40, y: 0.50 },
    { id: 'objectBall1', x: 1.40, y: 1.10 },
    { id: 'objectBall2', x: 1.00, y: 0.70 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 0,
    dragPx: 170,
    impactOffsetX: 0.007,
    impactOffsetY: -0.006,
  },
  expected: {
    mustHitBalls: ['objectBall1', 'objectBall2'],
    minCushionHitsBeforeLastBall: 3,
  },
};

export default scenario;
