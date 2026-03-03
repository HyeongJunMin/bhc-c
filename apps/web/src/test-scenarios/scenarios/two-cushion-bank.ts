import type { TestScenario } from '../types';

/**
 * 투쿠션 뱅크 (2-cushion bank)
 * 수구: 좌측 하단 → 우측 장쿠션 → 하단 단쿠션 → 제1적구
 * 
 * [3쿠션 교본] 장단 패턴의 기본. 뱅크 샷의 정석
 * 검증 포인트: 장쿠션->단쿠션 전환, 뱅크 각도 계산
 */
export const twoCushionBank: TestScenario = {
  id: 'two-cushion-bank',
  name: '투쿠션 뱅크 (장단)',
  description: '우측 장쿠션 → 하단 단쿠션 → 적구. 뱅크 샷 기본 패턴.',
  balls: {
    cueBall:     { x: 0.55, z: 0.50 },   // 좌측 하단
    objectBall1: { x: 1.50, z: 0.35 },   // 중앙 하단 (목표)
    objectBall2: { x: 2.10, z: 1.00 },   // 우측 상단
  },
  shot: {
    directionDeg: 18,      // 낮은 우상향
    dragPx: 240,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['cushion'],
};
