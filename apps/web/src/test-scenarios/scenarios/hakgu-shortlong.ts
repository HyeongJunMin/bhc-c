import type { TestScenario } from '../types';

/**
 * 학구 (鶴拘) - 단장 패턴  
 * 수구: 우측 하단 → 좌측 단쿠션 → 상단 장쿠션 → 제1적구
 * 
 * [3쿠션 교본] 짧은 단쿠션으로 각도 만들어 긴 장쿠션으로 복귀
 * 검증 포인트: 단쿠션->장쿠션 전환 시 spin throw, 장쿠션 반사각
 */
export const hakguShortLong: TestScenario = {
  id: 'hakgu-shortlong',
  name: '학구 (鶴拘) - 단장',
  description: '좌측 단쿠션 → 상단 장쿠션 → 적구. 단쿠션 각도에서 장쿠션으로 복귀.',
  balls: {
    cueBall:     { x: 2.50, z: 0.30 },   // 우측 하단
    objectBall1: { x: 1.20, z: 1.15 },   // 상단 좌측 (목표)
    objectBall2: { x: 0.50, z: 0.711 },  // 중앙 좌측
  },
  shot: {
    directionDeg: 105,     // 좌상향 (단쿠션 향함)
    dragPx: 240,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['cushion', '3-cushion'],
};
