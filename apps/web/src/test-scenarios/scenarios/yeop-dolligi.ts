import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'yeop-dolligi',
  name: '옆돌리기',
  description: '수구가 OB1을 맞힌 뒤 짧은 쿠션 방향으로 돌아 OB2에 도달하는 옆돌리기 패턴',
  tags: ['three-cushion', 'yeop-dolligi', 'pattern'],
  balls: [
    { id: 'cueBall', x: 1.00, y: 0.70 },
    { id: 'objectBall1', x: 1.00, y: 1.10 },
    { id: 'objectBall2', x: 2.00, y: 0.30 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 350,
    dragPx: 190,
    impactOffsetX: -0.007,
    impactOffsetY: 0,
  },
  expected: {
    mustHitBalls: ['objectBall1', 'objectBall2'],
    minCushionHitsBeforeLastBall: 3,
  },
};

export default scenario;
