import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'hakku-sideangle',
  name: 'Hakku Side Angle',
  description: '측각 박쿠: 측면에서 쿠션을 경유하는 3쿠션 샷 패턴',
  tags: ['cushion', 'angle', 'three-cushion'],
  balls: [
    { id: 'cueBall', x: 0.7, y: 0.6 },
    { id: 'objectBall1', x: 2.0, y: 0.35 },
    { id: 'objectBall2', x: 1.4, y: 1.1 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 55,
    dragPx: 220,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
};

export default scenario;
