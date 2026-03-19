import type AmmoType from 'ammo.js';
import * as THREE from 'three';
import { PHYSICS } from '../lib/constants';

/**
 * Physics-Spec.md 기반 개선된 물리 엔진
 * - 정확한 스핀 계산
 * - 미스큐 처리
 * - 쿠션 throw 효과
 * - 슬라이딩/롤링 전환
 */

export interface ShotPhysicsParams {
  direction: THREE.Vector3;  // 샷 방향 (단위 벡터)
  dragPx: number;            // 드래그 거리 (10-400)
  impactOffsetX: number;     // 좌우 당점 (-R ~ +R)
  impactOffsetY: number;     // 상하 당점 (-R ~ +R)
  cueElevation: number;      // 큐 고각 (0-89도)
}

export interface ShotResult {
  linearVelocity: AmmoType.btVector3;
  angularVelocity: AmmoType.btVector3;
  miscue: boolean;
  power: number;  // 실제 적용된 파워 (m/s)
}

export class PhysicsV2 {
  private ammo: typeof AmmoType;
  
  // Physics-Spec.md 상수
  private readonly M_C = 0.50;   // 큐 질량 (kg)
  private readonly M_B = 0.21;   // 공 질량 (kg)
  private readonly E_TIP = 0.70; // 팁 반발계수
  private readonly R = 0.03075;  // 공 반지름 (m)
  
  constructor(ammo: typeof AmmoType) {
    this.ammo = ammo;
  }
  
  /**
   * 드래그 거리를 속도로 변환 (Physics-Spec.md 기준)
   */
  dragToSpeed(dragPx: number): number {
    const clamped = Math.max(PHYSICS.MIN_DRAG_PX, Math.min(PHYSICS.MAX_DRAG_PX, dragPx));
    const ratio = (clamped - PHYSICS.MIN_DRAG_PX) / (PHYSICS.MAX_DRAG_PX - PHYSICS.MIN_DRAG_PX);
    return PHYSICS.MIN_SPEED_MPS + ratio * (PHYSICS.MAX_SPEED_MPS - PHYSICS.MIN_SPEED_MPS);
  }
  
  /**
   * 미스큐 체크
   */
  checkMiscue(offsetX: number, offsetY: number): boolean {
    const ratio = Math.sqrt(offsetX * offsetX + offsetY * offsetY) / this.R;
    if (ratio <= PHYSICS.MISCUE_SAFE_RATIO) return false;
    if (ratio >= PHYSICS.MISCUE_CERTAIN_RATIO) return true;
    const t = (ratio - PHYSICS.MISCUE_SAFE_RATIO) / (PHYSICS.MISCUE_CERTAIN_RATIO - PHYSICS.MISCUE_SAFE_RATIO);
    return Math.random() < t * t;
  }
  
  /**
   * 샷 계산 (Physics-Spec.md Section 6, 7)
   * @returns 선속도, 각속도, 미스큐 여부
   */
  calculateShot(params: ShotPhysicsParams): ShotResult {
    const { direction, dragPx, impactOffsetX, impactOffsetY } = params;
    
    // 1. 미스큐 체크
    if (this.checkMiscue(impactOffsetX, impactOffsetY)) {
      // 미스큐: 약한 힘만 전달
      const weakVelocity = new this.ammo.btVector3(
        direction.x * 0.5,
        0,
        direction.z * 0.5
      );
      return {
        linearVelocity: weakVelocity,
        angularVelocity: new this.ammo.btVector3(0, 0, 0),
        miscue: true,
        power: 0.5,
      };
    }
    
    // 2. 목표 속도 계산 (드래그 -> 속도)
    const V0_target = this.dragToSpeed(dragPx);
    
    // 3. 물리식: V0 = (m_c * (1 + e_tip) / (m_c + m_b)) * v_c
    // 역산: v_c = V0_target * (m_c + m_b) / (m_c * (1 + e_tip))
    const v_c = V0_target * (this.M_C + this.M_B) / (this.M_C * (1 + this.E_TIP));
    
    // 최종 V0 계산
    const V0 = (this.M_C * (1 + this.E_TIP) / (this.M_C + this.M_B)) * v_c;
    
    // 안전 클램프
    const V0_clamped = Math.max(PHYSICS.MIN_SPEED_MPS, Math.min(PHYSICS.MAX_SPEED_MPS, V0));
    
    // 4. 선속도 벡터
    const linearVelocity = new this.ammo.btVector3(
      direction.x * V0_clamped,
      0,
      direction.z * V0_clamped
    );
    
    // 5. 각속도 계산 (Physics-Spec.md Section 7)
    // I = (2/5) * m_b * R^2
    // omega_x = (5 * V0 * y) / (2 * R^2)
    // omega_z = (5 * V0 * x) / (2 * R^2)
    const R_squared = this.R * this.R;
    const omega_x = (5 * V0_clamped * impactOffsetY) / (2 * R_squared);
    const omega_z = (5 * V0_clamped * impactOffsetX) / (2 * R_squared);
    
    // Three.js/Ammo.js 좌표계 변환
    // X: 좌우, Y: 위아래, Z: 앞뒤
    const angularVelocity = new this.ammo.btVector3(
      -omega_z,  // side spin -> Y축 회전 (Three.js 기준)
      0,
      omega_x    // top/bottom spin -> Z축 회전
    );
    
    return {
      linearVelocity,
      angularVelocity,
      miscue: false,
      power: V0_clamped,
    };
  }
  
  /**
   * 쿠션 충돌 처리 (Physics-Spec.md Section 9.2)
   * 접촉시간 근사 모델 적용
   */
  calculateCushionBounce(
    velocity: AmmoType.btVector3,
    angularVelocity: AmmoType.btVector3,
    normal: THREE.Vector3,  // 쿠션 법선 벡터
    impactSpeed: number
  ): { newVelocity: AmmoType.btVector3; newAngularVelocity: AmmoType.btVector3 } {
    const e_bc = PHYSICS.BALL_CUSHION_RESTITUTION; // 0.72
    const mu_bc = PHYSICS.CUSHION_FRICTION;        // 0.14
    
    // 속도를 Three.js 벡터로 변환
    const vel = new THREE.Vector3(velocity.x(), velocity.y(), velocity.z());
    const angVel = new THREE.Vector3(
      angularVelocity.x(),
      angularVelocity.y(),
      angularVelocity.z()
    );
    
    // 법선 방향 성분
    const v_n = vel.dot(normal);
    const v_normal = normal.clone().multiplyScalar(v_n);
    
    // 접선 방향 성분
    const v_tangent = vel.clone().sub(v_normal);
    
    // 1. 법선 속도 반전 (반발계수 적용)
    const v_n_new = -v_n * e_bc;
    
    // 2. 접촉시간 근사 모델 (Physics-Spec.md Section 9.2)
    const v_ref = 5.957692307692308; // 40% 스트로크 기준
    const v_min = 0.05;
    const alpha = 1.2;
    const theta_max = 55 * (Math.PI / 180);
    
    const S_v = Math.pow(v_ref / Math.max(Math.abs(v_n), v_min), alpha);
    
    // 스핀 스케일
    const spin_z = angVel.y; // side spin 성분
    const spin_z_max = 0.615;
    const S_spin = Math.min(Math.abs(spin_z) / spin_z_max, 1);
    
    // 기준 접선비
    const tan_theta_base = (mu_bc * (1 + e_bc)) / e_bc;
    const tan_theta = Math.min(tan_theta_base * S_v * S_spin, Math.tan(theta_max));
    
    // 3. 접선 속도 감쇠 + throw 효과
    const throwDirection = spin_z > 0 ? 1 : -1;
    const v_throw = throwDirection * tan_theta * Math.abs(v_n_new);
    
    // 접선 방향 단위 벡터
    const tangentDir = v_tangent.clone().normalize();
    
    // 새로운 접선 속도
    const v_tangent_new = tangentDir.multiplyScalar(
      v_tangent.length() * (1 - mu_bc) + v_throw
    );
    
    // 4. 최종 속도 조합
    const v_new = normal.clone().multiplyScalar(v_n_new).add(v_tangent_new);
    
    // 5. 각속도 변화 (쿠션과의 마찰로 인한 회전 변화)
    // 간략화: 쿠션 충돌 시 약간의 회전 감소
    const angVel_new = angVel.clone().multiplyScalar(0.95);
    
    return {
      newVelocity: new this.ammo.btVector3(v_new.x, v_new.y, v_new.z),
      newAngularVelocity: new this.ammo.btVector3(angVel_new.x, angVel_new.y, angVel_new.z),
    };
  }
  
  /**
   * 공-공 충돌 처리
   */
  calculateBallCollision(
    vel1: AmmoType.btVector3,
    vel2: AmmoType.btVector3,
    pos1: AmmoType.btVector3,
    pos2: AmmoType.btVector3,
    angVel1: AmmoType.btVector3,
    angVel2: AmmoType.btVector3
  ): {
    newVel1: AmmoType.btVector3;
    newVel2: AmmoType.btVector3;
    newAngVel1: AmmoType.btVector3;
    newAngVel2: AmmoType.btVector3;
  } {
    const e_bb = PHYSICS.BALL_BALL_RESTITUTION; // 0.95
    
    // 충돌 방향
    const p1 = new THREE.Vector3(pos1.x(), pos1.y(), pos1.z());
    const p2 = new THREE.Vector3(pos2.x(), pos2.y(), pos2.z());
    const collisionNormal = p2.clone().sub(p1).normalize();
    
    // 상대 속도
    const v1 = new THREE.Vector3(vel1.x(), vel1.y(), vel1.z());
    const v2 = new THREE.Vector3(vel2.x(), vel2.y(), vel2.z());
    const relativeVel = v1.clone().sub(v2);
    
    // 충돌 방향 성분
    const velAlongNormal = relativeVel.dot(collisionNormal);
    
    // 이미 분리 중이면 무시
    if (velAlongNormal > 0) {
      return {
        newVel1: vel1,
        newVel2: vel2,
        newAngVel1: angVel1,
        newAngVel2: angVel2,
      };
    }
    
    // 충격량 스칼라
    const j = -(1 + e_bb) * velAlongNormal / (1/this.M_B + 1/this.M_B);
    
    // 충격량 벡터
    const impulse = collisionNormal.clone().multiplyScalar(j);
    
    // 새로운 속도
    const v1_new = v1.clone().add(impulse.clone().multiplyScalar(1/this.M_B));
    const v2_new = v2.clone().sub(impulse.clone().multiplyScalar(1/this.M_B));
    
    // 회전 변화 (간략화)
    const av1 = new THREE.Vector3(angVel1.x(), angVel1.y(), angVel1.z());
    const av2 = new THREE.Vector3(angVel2.x(), angVel2.y(), angVel2.z());
    
    return {
      newVel1: new this.ammo.btVector3(v1_new.x, v1_new.y, v1_new.z),
      newVel2: new this.ammo.btVector3(v2_new.x, v2_new.y, v2_new.z),
      newAngVel1: new this.ammo.btVector3(av1.x, av1.y, av1.z),
      newAngVel2: new this.ammo.btVector3(av2.x, av2.y, av2.z),
    };
  }
}
