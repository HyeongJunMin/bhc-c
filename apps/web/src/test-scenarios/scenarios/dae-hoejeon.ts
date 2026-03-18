import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'dae-hoejeon',
  name: '대회전',
  description: '수구가 OB1을 빗겨치기로 맞힌 뒤 테이블을 크게 돌아 OB2에 도달하는 대회전 패턴',
  tags: ['three-cushion', 'dae-hoejeon', 'pattern'],
  balls: [
    { id: 'cueBall', x: 0.50, y: 0.35 },
    { id: 'objectBall1', x: 1.40, y: 1.10 },
    { id: 'objectBall2', x: 2.30, y: 0.70 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 5,
    dragPx: 300,
    impactOffsetX: 0.018,
    impactOffsetY: 0.010,
  },
  expected: {
    mustHitBalls: ['objectBall1', 'objectBall2'],
    minCushionHitsBeforeLastBall: 3,
  },
};

export default scenario;
