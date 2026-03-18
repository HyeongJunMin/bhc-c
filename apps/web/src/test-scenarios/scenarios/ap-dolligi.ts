import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'ap-dolligi',
  name: '앞돌리기',
  description: '수구가 OB1을 먼저 맞힌 뒤 3쿠션을 거쳐 OB2에 도달하는 앞돌리기 패턴',
  tags: ['three-cushion', 'ap-dolligi', 'pattern'],
  balls: [
    { id: 'cueBall', x: 0.50, y: 0.35 },
    { id: 'objectBall1', x: 0.85, y: 0.60 },
    { id: 'objectBall2', x: 2.10, y: 1.10 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 35,
    dragPx: 200,
    impactOffsetX: 0.005,
    impactOffsetY: 0,
  },
  expected: {
    mustHitBalls: ['objectBall1', 'objectBall2'],
    minCushionHitsBeforeLastBall: 3,
  },
};

export default scenario;
