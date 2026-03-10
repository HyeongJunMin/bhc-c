import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'spin-english',
  name: 'Right English (Side Spin)',
  description: '우측 사이드 스핀으로 쿠션 반사 각도 변화 확인',
  tags: ['spin', 'cushion'],
  balls: [
    { id: 'cueBall', x: 1.422, y: 0.711 },
    { id: 'objectBall1', x: 2.844, y: 1.422 },
    { id: 'objectBall2', x: 0.0, y: 0.0 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 180,
    dragPx: 200,
    impactOffsetX: 0.021525,
    impactOffsetY: 0,
  },
};

export default scenario;
