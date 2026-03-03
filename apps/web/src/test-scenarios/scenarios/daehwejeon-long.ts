import type { TestScenario } from '../types';

/**
 * 대회전 (大回轉) - 대각선 장장장
 * 수구: 좌측 하단 → 우측 장쿠션 → 좌측 장쿠션 → 우측 장쿠션 → 제1적구
 * 
 * [3쿠션 교본] 테이블 전체를 가로지르는 긴 회전
 * 검증 포인트: 장거리 이동 시 속도 감쇠, 다중 쿠션 spin 누적
 */
export const daehwejeonLong: TestScenario = {
  id: 'daehwejeon-long',
  name: '대회전 (大回轉) - 장장장',
  description: '우측 장쿠션 → 좌측 장쿠션 → 우측 장쿠션 → 적구. 테이블 전체를 도는 긴 회전.',
  balls: {
    cueBall:     { x: 0.40, z: 0.35 },   // 좌측 하단
    objectBall1: { x: 2.20, z: 0.60 },   // 우측 하단 쪽 (목표)
    objectBall2: { x: 1.50, z: 1.00 },   // 중앙 상단
  },
  shot: {
    directionDeg: 20,      // 평탄한 우상향
    dragPx: 320,           // 강한 파워 (장거리)
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['cushion', '3-cushion'],
};
