import type { TestScenario } from '../types.ts';

const scenario: TestScenario = {
  id: 'fah-pos50',
  name: '파이브앤하프: 목표 50',
  description: 'Five-and-a-Half 다이아몬드 시스템: 똥창 출발 → top 50번(1.03575) → 우측 → 하단',
  tags: ['five-and-a-half', 'diamond', 'cue-only'],
  physicsProfile: 'fahTest' as const,
  balls: [{ id: 'cueBall', x: 0.03075, y: 1.39125 }],
  shot: {
    cueBallId: 'cueBall',
    directionDeg: 306.4,
    dragPx: 70,
    impactOffsetX: 0.007,
    impactOffsetY: 0.007,
  },
  expected: {
    cushionSequence: ['top', 'right', 'bottom'],
  },
};

export default scenario;
