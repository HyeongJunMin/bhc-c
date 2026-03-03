import type { TestScenario } from '../types';

/**
 * 원쿠션 직접 (1-cushion direct)
 * 수구: 좌측 하단 → 우측 장쿠션 → 직접 제1적구
 * 
 * [3쿠션 교본] 최단 경로 원쿠션. 기울기 샷의 기본
 * 검증 포인트: 1쿠션 후 직진성, 정확한 반사각
 */
export const oneCushionDirect: TestScenario = {
  id: 'one-cushion-direct',
  name: '원쿠션 직접',
  description: '우측 장쿠션 → 직접 적구. 최단 경로 원쿠션 샷.',
  balls: {
    cueBall:     { x: 0.60, z: 0.45 },   // 좌측 하단
    objectBall1: { x: 1.80, z: 0.90 },   // 중앙 우측 상단 (목표)
    objectBall2: { x: 2.20, z: 0.30 },   // 우측 하단
  },
  shot: {
    directionDeg: 35,      // 우상향 각도
    dragPx: 220,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['cushion'],
};
