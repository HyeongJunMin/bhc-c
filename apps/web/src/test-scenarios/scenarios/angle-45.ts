import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'angle-45',
  name: '45-Degree Angle Shot',
  description: '45도 각도 샷으로 적구에 맞고 쿠션으로 향함',
  tags: ['angle', 'basic'],
  balls: [
    { id: 'cueBall', x: 0.5, y: 0.4 },
    { id: 'objectBall1', x: 1.5, y: 1.0 },
    { id: 'objectBall2', x: 2.2, y: 0.4 },
  ],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 45,
    dragPx: 200,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
};

export default scenario;
