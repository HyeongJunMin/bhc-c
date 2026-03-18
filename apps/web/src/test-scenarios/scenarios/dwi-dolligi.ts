import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'dwi-dolligi',
  name: '뒤돌리기',
  description: '수구가 쿠션을 먼저 친 뒤 OB1, OB2를 순서대로 맞히는 뒤돌리기 패턴',
  tags: ['three-cushion', 'dwi-dolligi', 'pattern'],
  balls: [
    { id: 'cueBall', x: 0.70, y: 0.35 },
    { id: 'objectBall1', x: 1.40, y: 0.20 },
    { id: 'objectBall2', x: 1.80, y: 0.40 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 250,
    dragPx: 220,
    impactOffsetX: -0.008,
    impactOffsetY: 0.006,
  },
  expected: {
    mustHitBalls: ['objectBall1', 'objectBall2'],
    minCushionHitsBeforeLastBall: 3,
  },
};

export default scenario;
