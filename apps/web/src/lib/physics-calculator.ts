import { PHYSICS } from './constants';
import { AngularVelocity } from '../types';

/**
 * 샷 물리 계산 (packages/physics-core 포팅)
 */

/**
 * 드래그 거리를 목표 속도로 변환 (m/s)
 */
export function dragToTargetSpeed(dragPx: number): number {
  const clampedDrag = Math.max(PHYSICS.MIN_DRAG_PX, Math.min(PHYSICS.MAX_DRAG_PX, dragPx));
  const t = (clampedDrag - PHYSICS.MIN_DRAG_PX) / (PHYSICS.MAX_DRAG_PX - PHYSICS.MIN_DRAG_PX);
  return PHYSICS.MIN_SPEED_MPS + t * (PHYSICS.MAX_SPEED_MPS - PHYSICS.MIN_SPEED_MPS);
}

/**
 * 목표 속도에서 큐 속도 역산
 */
export function solveCueSpeed(targetBallSpeed: number): number {
  const { CUE_MASS, BALL_MASS, TIP_RESTITUTION } = PHYSICS;
  return (targetBallSpeed * (CUE_MASS + BALL_MASS)) / (CUE_MASS * (1 + TIP_RESTITUTION));
}

/**
 * 초기 선속도 계산
 */
export function computeInitialBallSpeed(cueSpeed: number): number {
  const { CUE_MASS, BALL_MASS, TIP_RESTITUTION } = PHYSICS;
  return ((CUE_MASS * (1 + TIP_RESTITUTION)) / (CUE_MASS + BALL_MASS)) * cueSpeed;
}

/**
 * 초기 각속도 계산 (스핀)
 */
export function computeInitialAngularVelocity(
  initialBallSpeed: number,
  impactOffsetX: number,
  impactOffsetY: number
): AngularVelocity {
  const radius = PHYSICS.BALL_RADIUS;
  const denominator = 2 * radius * radius;

  return {
    omegaX: (5 * initialBallSpeed * impactOffsetY) / denominator,
    omegaZ: (5 * initialBallSpeed * impactOffsetX) / denominator,
  };
}

/**
 * 미스큐 판정
 */
export function isMiscue(impactOffsetX: number, impactOffsetY: number): boolean {
  const offsetDistance = Math.hypot(impactOffsetX, impactOffsetY);
  return offsetDistance > PHYSICS.MISCUE_THRESHOLD_RATIO * PHYSICS.BALL_RADIUS;
}

/**
 * 방향 벡터 계산 (수평 각도 + 수직 각도)
 */
export function computeShotDirection(
  directionDeg: number,
  elevationDeg: number
): { x: number; y: number; z: number } {
  const horizontalRad = (directionDeg * Math.PI) / 180;
  const verticalRad = (elevationDeg * Math.PI) / 180;

  // 수평 성분
  const cosElev = Math.cos(verticalRad);
  const x = Math.sin(horizontalRad) * cosElev;
  const z = Math.cos(horizontalRad) * cosElev;
  
  // 수직 성분 (테이블 면에 투영)
  const y = -Math.sin(verticalRad);

  return { x, y, z };
}

/**
 * 샷 실행 - 최종 속도 벡터 계산
 */
export function computeShotVelocity(
  directionDeg: number,
  elevationDeg: number,
  dragPx: number
): { x: number; y: number; z: number } {
  const targetSpeed = dragToTargetSpeed(dragPx);
  const cueSpeed = solveCueSpeed(targetSpeed);
  const ballSpeed = computeInitialBallSpeed(cueSpeed);
  
  // 파워 100% (원래대로)
  const dir = computeShotDirection(directionDeg, elevationDeg);
  
  return {
    x: dir.x * ballSpeed,
    y: dir.y * ballSpeed,
    z: dir.z * ballSpeed,
  };
}
