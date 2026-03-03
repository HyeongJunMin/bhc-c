import type { TestScenario } from '../types';

/**
 * 우라 (右拉) - 3쿠션 기본 패턴
 * 수구: 좌측 하단 → 우측 장쿠션 → 상단 단쿠션 → 좌측 장쿠션 → 제1적구
 * 
 * [3쿠션 교본] 가장 기본적인 장장단 회전 패턴
 * 검증 포인트: 장쿠션->단쿠션->장쿠션 반사각, 스핀 감쇠
 */
export const ura3Cushion: TestScenario = {
  id: 'ura-3cushion',
  name: '우라 (右拉) - 장장단',
  description: '우측 장쿠션 → 상단 단쿠션 → 좌측 장쿠션 → 적구. 기본 3쿠션 회전 패턴.',
  balls: {
    cueBall:     { x: 0.35, z: 0.25 },   // 좌측 하단 시작
    objectBall1: { x: 2.10, z: 0.711 },  // 중앙 우측 (목표)
    objectBall2: { x: 1.422, z: 1.20 },  // 상단 중앙 (방해구 없음)
  },
  shot: {
    directionDeg: 25,      // 우상향 각도
    dragPx: 260,           // 중간 파워
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['cushion', '3-cushion'],
};
