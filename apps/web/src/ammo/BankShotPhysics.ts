import type AmmoType from 'ammo.js';
import * as THREE from 'three';

/**
 * 뱅크샷(Bank Shot) 물리 시뮬레이션
 * 
 * 특징:
 * 1. 쿠션 반발 시 회전이 급격히 변함 (Friction에 의한 커브)
 * 2. 플러스 투 시스템에서 주로 발생
 * 3. 사이드 스핀이 강하게 작용
 */

export interface BankShotParams {
  // 초기 속도
  initialVelocity: THREE.Vector3;
  // 초기 회전 (각속도)
  initialSpin: THREE.Vector3;
  // 쿠션 반발 계수
  restitution: number;
  // 마찰 계수
  friction: number;
}

export interface BankShotResult {
  // 반사 후 속도
  reflectedVelocity: THREE.Vector3;
  // 반사 후 회전
  reflectedSpin: THREE.Vector3;
  // throw 각도 (옆으로 밀림)
  throwAngle: number;
}

/**
 * 뱅크샷 커브 시뮬레이터
 * 
 * 쿠션과 충돌 시 발생하는 물리 현상:
 * 1. 법선 방향 반발 (Restitution)
 * 2. 접선 방향 마찰 (Friction) → 회전 변화
 * 3. 스핀에 의한 throw 효과
 */
export class BankShotSimulator {
  private ammo: typeof AmmoType;

  // 뱅크샷 물리 상수
  static readonly BANK_SHOT_CONSTANTS = {
    // 쿠션 반발 시 회전 변화 계수
    spinChangeFactor: 0.6,
    // throw 효과 계수
    throwMultiplier: 0.4,
    // 마찰로 인한 속도 감소
    frictionDecay: 0.85,
    // 회전 감쇠
    spinDamping: 0.7,
  };

  constructor(ammo: typeof AmmoType) {
    this.ammo = ammo;
  }

  /**
   * 쿠션 충돌 시 뱅크샷 물리 계산
   * 
   * @param incomingVelocity 입사 속도
   * @param incomingSpin 입사 회전 (각속도)
   * @param normal 쿠션 법선 벡터
   * @param isHorizontalCushion 가로/세로 쿠션 여부
   */
  calculateBankCollision(
    incomingVelocity: THREE.Vector3,
    incomingSpin: THREE.Vector3,
    normal: THREE.Vector3,
    isHorizontalCushion: boolean
  ): BankShotResult {
    const constants = BankShotSimulator.BANK_SHOT_CONSTANTS;

    // 1. 법선 방향 반발
    const velocityAlongNormal = incomingVelocity.dot(normal);
    const reflectedVelocity = incomingVelocity.clone();
    
    if (velocityAlongNormal < 0) {
      // 반발 (Restitution ~0.75)
      const restitution = 0.75;
      const vReflected = velocityAlongNormal * -restitution;
      reflectedVelocity.add(normal.clone().multiplyScalar(vReflected - velocityAlongNormal));
    }

    // 2. 접선 방향 마찰 (회전과 상호작용)
    const tangent = new THREE.Vector3(-normal.z, 0, normal.x).normalize();
    const velocityAlongTangent = incomingVelocity.dot(tangent);
    const spinAlongTangent = isHorizontalCushion 
      ? incomingSpin.z  // 좌우 스핀
      : incomingSpin.x; // 상하 스핀

    // 마찰력 계산 (Coulomb friction) - velocityAlongTangent 사용
    const frictionEffect = Math.abs(velocityAlongTangent) * constants.frictionDecay;
    const spinEffect = spinAlongTangent * 0.3; // 스핀이 마찰에 미치는 영향

    // 접선 방향 속도 수정 (frictionEffect 변수 사용)
    const tangentFriction = (velocityAlongTangent + spinEffect) * frictionEffect / Math.abs(velocityAlongTangent);
    reflectedVelocity.add(tangent.clone().multiplyScalar(tangentFriction - velocityAlongTangent));

    // 3. throw 각도 계산 (회전에 의한 옆 밀림)
    const throwAngle = Math.atan2(
      spinAlongTangent * constants.throwMultiplier,
      Math.abs(velocityAlongNormal)
    ) * (180 / Math.PI);

    // 4. 반사 후 회전 계산
    const reflectedSpin = incomingSpin.clone();
    
    if (isHorizontalCushion) {
      // 가로 쿠션: 좌우 스핀 변화
      reflectedSpin.z *= constants.spinDamping;
      reflectedSpin.z += velocityAlongNormal * 0.05; // 반작용 스핀
    } else {
      // 세로 쿠션: 상하 스핀 변화
      reflectedSpin.x *= constants.spinDamping;
      reflectedSpin.x += velocityAlongNormal * 0.05;
    }

    return {
      reflectedVelocity,
      reflectedSpin,
      throwAngle,
    };
  }

  /**
   * 뱅크샷 예측 (다중 쿠션 반발)
   * 
   * @param startPos 시작 위치
   * @param initialVelocity 초기 속도
   * @param initialSpin 초기 회전
   * @param bounces 반발 횟수
   */
  predictBankShot(
    startPos: THREE.Vector3,
    initialVelocity: THREE.Vector3,
    initialSpin: THREE.Vector3,
    bounces: number = 2
  ): Array<{ position: THREE.Vector3; velocity: THREE.Vector3; spin: THREE.Vector3 }> {
    const trajectory: Array<{ position: THREE.Vector3; velocity: THREE.Vector3; spin: THREE.Vector3 }> = [];
    
    let pos = startPos.clone();
    let vel = initialVelocity.clone();
    let spin = initialSpin.clone();

    trajectory.push({ position: pos.clone(), velocity: vel.clone(), spin: spin.clone() });

    const { width, height } = { width: 28.4, height: 14.2 };
    const ballRadius = 0.3075;

    for (let i = 0; i < bounces; i++) {
      // 다음 충독 지점 계산
      const bounds = {
        minX: ballRadius,
        maxX: width - ballRadius,
        minZ: ballRadius,
        maxZ: height - ballRadius,
      };

      let tMin = Infinity;
      let collisionNormal = new THREE.Vector3();

      // X 방향 충돌
      if (vel.x > 0) {
        const t = (bounds.maxX - pos.x) / vel.x;
        if (t > 0.001 && t < tMin) {
          tMin = t;
          collisionNormal.set(-1, 0, 0);
        }
      } else if (vel.x < 0) {
        const t = (bounds.minX - pos.x) / vel.x;
        if (t > 0.001 && t < tMin) {
          tMin = t;
          collisionNormal.set(1, 0, 0);
        }
      }

      // Z 방향 충돌
      if (vel.z > 0) {
        const t = (bounds.maxZ - pos.z) / vel.z;
        if (t > 0.001 && t < tMin) {
          tMin = t;
          collisionNormal.set(0, 0, -1);
        }
      } else if (vel.z < 0) {
        const t = (bounds.minZ - pos.z) / vel.z;
        if (t > 0.001 && t < tMin) {
          tMin = t;
          collisionNormal.set(0, 0, 1);
        }
      }

      if (tMin === Infinity) break;

      // 충독 지점
      pos.add(vel.clone().multiplyScalar(tMin));

      // 뱅크샷 물리 적용
      const isHorizontal = Math.abs(collisionNormal.x) > 0.5;
      const result = this.calculateBankCollision(vel, spin, collisionNormal, isHorizontal);

      vel = result.reflectedVelocity;
      spin = result.reflectedSpin;

      trajectory.push({ position: pos.clone(), velocity: vel.clone(), spin: spin.clone() });
    }

    return trajectory;
  }

  /**
   * Ammo.js RigidBody에 뱅크샷 물리 적용
   * 
   * 쿠션 충돌 콜백에서 호출
   */
  applyBankPhysics(
    body: AmmoType.btRigidBody,
    cushionNormal: AmmoType.btVector3,
    isHorizontalCushion: boolean
  ): void {
    const velocity = body.getLinearVelocity();
    const spin = body.getAngularVelocity();

    // Three.js Vector3로 변환
    const vel = new THREE.Vector3(velocity.x(), velocity.y(), velocity.z());
    const angVel = new THREE.Vector3(spin.x(), spin.y(), spin.z());
    const normal = new THREE.Vector3(cushionNormal.x(), cushionNormal.y(), cushionNormal.z());

    // 뱅크샷 계산
    const result = this.calculateBankCollision(vel, angVel, normal, isHorizontalCushion);

    // Ammo.js에 적용
    body.setLinearVelocity(new this.ammo.btVector3(
      result.reflectedVelocity.x,
      result.reflectedVelocity.y,
      result.reflectedVelocity.z
    ));

    body.setAngularVelocity(new this.ammo.btVector3(
      result.reflectedSpin.x,
      result.reflectedSpin.y,
      result.reflectedSpin.z
    ));

    console.log('[BankShot] Applied curve physics:', {
      throwAngle: result.throwAngle.toFixed(2) + '°',
      spinChange: {
        before: { x: angVel.x.toFixed(2), z: angVel.z.toFixed(2) },
        after: { x: result.reflectedSpin.x.toFixed(2), z: result.reflectedSpin.z.toFixed(2) },
      },
    });
  }
}

/**
 * Predictive Linear Velocity (예측 선형 속도)
 * 
 * 뱅크샷에서 회전이 미래 경로에 미치는 영향을 예측
 */
export class PredictiveVelocity {
  /**
   * 회전을 고려한 예상 도착 지점 계산
   * 
   * @param currentPos 현재 위치
   * @param currentVel 현재 속도
   * @param currentSpin 현재 회전
   * @param time 예측 시간 (초)
   */
  static predictPosition(
    currentPos: THREE.Vector3,
    currentVel: THREE.Vector3,
    currentSpin: THREE.Vector3,
    time: number
  ): THREE.Vector3 {
    const futurePos = currentPos.clone();
    const predictedVel = currentVel.clone();

    // 회전에 의한 속도 변화 (Magnus effect)
    const spinEffect = new THREE.Vector3(
      -currentSpin.z * 0.1, // 좌우 스핀이 Z축 이동에 영향
      0,
      currentSpin.x * 0.1   // 상하 스핀이 X축 이동에 영향
    );

    predictedVel.add(spinEffect);
    futurePos.add(predictedVel.multiplyScalar(time));

    return futurePos;
  }

  /**
   * 플러스 투 뱅크샷 최적 각도 계산
   * 
   * 커브를 고려하여 실제로 도달할 수 있는 각도 계산
   */
  static calculateOptimalBankAngle(
    cueBallPos: THREE.Vector3,
    targetPos: THREE.Vector3,
    cushionPoint: THREE.Vector3,
    spinAmount: number
  ): number {
    // 기본 반사 각도
    const incoming = new THREE.Vector3().subVectors(cushionPoint, cueBallPos).normalize();
    const outgoing = new THREE.Vector3().subVectors(targetPos, cushionPoint).normalize();
    
    // 스핀에 따른 보정 각도
    const spinCorrection = spinAmount * 2; // 1도당 2도 보정 (대략적)

    // 기본 반사 법칙: 입사각 = 반사각
    const idealAngle = Math.atan2(incoming.z, incoming.x);
    const outgoingAngle = Math.atan2(outgoing.z, outgoing.x);

    // 스핀 보정 적용
    const correctedAngle = outgoingAngle + (spinCorrection * Math.PI / 180);

    return correctedAngle;
  }
}

/**
 * 뱅크샷 디버깅 시각화
 */
export class BankShotVisualizer {
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * throw 각도 시각화
   */
  visualizeThrowAngle(
    position: THREE.Vector3,
    throwAngle: number,
    direction: THREE.Vector3
  ): void {
    const arrowLength = 1.0;
    const angleRad = throwAngle * (Math.PI / 180);

    // throw 방향 계산
    const throwDir = new THREE.Vector3(
      direction.x * Math.cos(angleRad) - direction.z * Math.sin(angleRad),
      0,
      direction.x * Math.sin(angleRad) + direction.z * Math.cos(angleRad)
    );

    const arrowHelper = new THREE.ArrowHelper(
      throwDir,
      position,
      arrowLength,
      0xff00ff, // 마젠타색
      0.3,
      0.2
    );

    this.scene.add(arrowHelper);

    // 3초 후 제거
    setTimeout(() => {
      this.scene.remove(arrowHelper);
    }, 3000);
  }

  /**
   * 회전 벡터 시각화
   */
  visualizeSpin(
    position: THREE.Vector3,
    spin: THREE.Vector3,
    color: number = 0x00ffff
  ): void {
    const arrowHelper = new THREE.ArrowHelper(
      spin.clone().normalize(),
      position,
      spin.length() * 2,
      color,
      0.3,
      0.2
    );

    this.scene.add(arrowHelper);

    setTimeout(() => {
      this.scene.remove(arrowHelper);
    }, 3000);
  }
}

// Export constants separately (classes are already exported above)
export const BANK_SHOT_CONSTANTS = BankShotSimulator.BANK_SHOT_CONSTANTS;

// Default export
export default {
  BankShotSimulator,
  PredictiveVelocity,
  BankShotVisualizer,
  BANK_SHOT_CONSTANTS,
};
