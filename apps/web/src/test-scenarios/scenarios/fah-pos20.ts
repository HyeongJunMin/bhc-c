import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'fah-pos20',
  name: '파이브앤하프: 목표 20',
  description: 'Five-and-a-Half 다이아몬드 시스템: 똥창 출발 → top 20번(2.10225) → 우측 → 하단',
  tags: ['five-and-a-half', 'diamond', 'cue-only'],
  physicsProfile: 'fahTest' as const,
  balls: [{ id: 'cueBall', x: 0.03075, y: 1.39125 }],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 326.7,
    dragPx: 70,
    impactOffsetX: 0.007,
    impactOffsetY: 0.007,
  },
  expected: {
    cushionSequence: ['top', 'right', 'bottom'],
  },
};

export default scenario;
