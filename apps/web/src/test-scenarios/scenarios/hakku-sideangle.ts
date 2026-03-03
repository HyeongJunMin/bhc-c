import type { TestScenario } from '../types';

/**
 * hakku_sideangle: 하꾸 사이드 앵글 배치.
 */
export const hakkuSideangle: TestScenario = {
  id: 'hakku_sideangle',
  name: '하꾸 사이드앵글',
  description: '하꾸 사이드 앵글 배치 테스트',
  balls: {
    cueBall: { x: 1.84675, z: 0.69475 },
    objectBall1: { x: 0.17875, z: 0.11775 },
    objectBall2: { x: 1.89675, z: 0.24475 },
  },
  shot: {
    directionDeg: 280,
    dragPx: 187,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['cushion', '3-cushion'],
};
