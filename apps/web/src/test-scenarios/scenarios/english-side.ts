import type { TestScenario } from '../types';

/**
 * 영어 (English) 사이드 스핀 활용
 * 수구: 좌측 하단 → 좌측 장쿠션(옆스핀) → 우측 장쿠션 → 제1적구
 * 
 * [3쿠션 교본] 사이드 스핀으로 반사각 조절
 * 검증 포인트: side spin의 쿠션 반사각 변화, throw effect
 */
export const englishSide: TestScenario = {
  id: 'english-side',
  name: '영어 (English) - 사이드 스핀',
  description: '좌측 장쿠션(사이드) → 우측 장쿠션 → 적구. 스핀 반사각 조절.',
  balls: {
    cueBall:     { x: 0.50, z: 0.40 },   // 좌측 하단
    objectBall1: { x: 2.00, z: 0.60 },   // 우측 하단 (목표)
    objectBall2: { x: 1.50, z: 1.10 },   // 중앙 상단
  },
  shot: {
    directionDeg: 80,      // 거의 수직으로 장쿠션
    dragPx: 250,
    impactOffsetX: 0.012,  // 오른쪽 사이드 (최대치의 약 60%)
    impactOffsetY: 0,
  },
  tags: ['spin', 'english', 'cushion', '3-cushion'],
};
