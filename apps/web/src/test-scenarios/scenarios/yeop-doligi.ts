import type { TestScenario } from '../types';

/**
 * 옆돌리기 (옆장쿠션 활용)
 * 수구: 좌측 하단 → 우측 장쿠션(옆면) → 우측 장쿠션(다시) → 제1적구
 * 
 * [3쿠션 교본] 같은 장쿠션을 두 번 맞추는 옆돌리기
 * 검증 포인트: 같은 쿠션 연속 반사, spin에 의한 반사각 변화
 */
export const yeopDoligi: TestScenario = {
  id: 'yeop-doligi',
  name: '옆돌리기 - 동일 장쿠션 2회',
  description: '우측 장쿠션 → 다시 우측 장쿠션 → 적구. 같은 장쿠션을 두 번 이용.',
  balls: {
    cueBall:     { x: 0.50, z: 0.40 },   // 좌측 하단
    objectBall1: { x: 1.80, z: 0.30 },   // 우측 하단 (목표)
    objectBall2: { x: 2.00, z: 1.10 },   // 우측 상단
  },
  shot: {
    directionDeg: 15,      // 낮은 각도로 장쿠션
    dragPx: 280,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['cushion', '3-cushion'],
};
