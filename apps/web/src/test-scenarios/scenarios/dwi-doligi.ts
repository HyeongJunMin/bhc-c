import type { TestScenario } from '../types';

/**
 * 뒤돌리기 (뒤쪽 장쿠션 활용)
 * 수구: 좌측 중앙 → 우측 장쿠션 → 좌측 장쿠션(뒤로) → 제1적구
 * 
 * [3쿠션 교본] 출발점 쪽으로 돌아오는 뒤돌리기
 * 검증 포인트: 역방향 진행, spin 방향 전환
 */
export const dwiDoligi: TestScenario = {
  id: 'dwi-doligi',
  name: '뒤돌리기 - 역방향 복귀',
  description: '우측 장쿠션 → 좌측 장쿠션 → 다시 좌측 방향으로 적구. 출발점 쪽으로 회전.',
  balls: {
    cueBall:     { x: 0.80, z: 0.711 },  // 좌측 중앙
    objectBall1: { x: 0.45, z: 0.40 },   // 좌측 하단 (목표, 출발점 근처)
    objectBall2: { x: 2.20, z: 0.90 },   // 우측 상단
  },
  shot: {
    directionDeg: 10,      // 거의 수평으로
    dragPx: 250,
    impactOffsetX: 0,
    impactOffsetY: 0,
  },
  tags: ['cushion', '3-cushion'],
};
