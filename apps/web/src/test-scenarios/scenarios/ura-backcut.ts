import type { TestScenario } from '../types';

/**
 * ura_backcut: 우라 계열 백컷 배치.
 */
export const uraBackcut: TestScenario = {
  id: 'ura_backcut',
  name: '우라 백컷',
  description: '우라 백컷 배치 테스트',
  balls: {
    cueBall: { x: 0.52675, z: 0.39175 },
    objectBall1: { x: 1.77365, z: 0.40075 },
    objectBall2: { x: 0.44475, z: 0.26975 },
  },
  shot: {
    directionDeg: 0,
    dragPx: 199,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['cushion', '3-cushion'],
};
