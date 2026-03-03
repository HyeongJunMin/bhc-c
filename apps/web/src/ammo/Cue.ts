import type AmmoType from 'ammo.js';
import * as THREE from 'three';

/**
 * 큐 히트 파라미터
 */
export interface CueHitParams {
  direction: { x: number; y: number; z: number };
  force: number;
  impactOffset: { x: number; y: number };
}

/**
 * 당점 보정 테이블 (Throw 계수)
 */
export const SPIN_CORRECTION = {
  // EF-2 (상단) - 뒤당김 보정
  ef2Top: {
    correctionAngle: -0.08,
    throwFactor: 0.15,
  },
  // EF-2 (하단) - 앞당김 보정
  ef2Bottom: {
    correctionAngle: 0.12,
    throwFactor: -0.1,
  },
  // 사이드 스핀
  sideSpin: {
    correctionAngle: 0.05,
    throwFactor: 0.2,
  },
};

/**
 * 큐 컨트롤러
 * - 당점에 따른 회전 및 속도 계산
 * - EF-2, 사이드 스핀 구현
 */
export class CueController {
  private ammo: typeof AmmoType;

  constructor(ammo: typeof AmmoType) {
    this.ammo = ammo;
  }

  /**
   * 큐 히트 적용
   * @param body 대상 공의 RigidBody
   * @param params 히트 파라미터
   */
  applyCueHit(body: AmmoType.btRigidBody, params: CueHitParams): void {
    const { direction, force, impactOffset } = params;

    // 1. 선형 속도 (중심 충격)
    const linearImpulse = new this.ammo.btVector3(
      direction.x * force,
      direction.y * force,
      direction.z * force
    );
    body.applyCentralImpulse(linearImpulse);

    // 2. 각속도 (회전) - 당점에 따른 토크
    const angularVelocity = this.calculateAngularVelocity(
      direction,
      impactOffset,
      force
    );
    body.setAngularVelocity(angularVelocity);

    // 3. 활성화 (움직이지 않던 공도 반응하도록)
    body.activate();
  }

  /**
   * 당점에 따른 각속도 계산
   * @param direction 샷 방향
   * @param impactOffset 당점 오프셋 (-1 ~ 1)
   * @param force 힘의 크기
   */
  private calculateAngularVelocity(
    direction: { x: number; y: number; z: number },
    impactOffset: { x: number; y: number },
    force: number
  ): AmmoType.btVector3 {
    // 당구공 반지름 (단위: 10cm)
    const ballRadius = 0.615;

    // 회전 축 계산 (방향 벡터와 수직)
    const forward = new THREE.Vector3(direction.x, direction.y, direction.z);
    const up = new THREE.Vector3(0, 1, 0);
    const right = new THREE.Vector3().crossVectors(forward, up).normalize();

    // 당점에 따른 회전량
    const topSpin = impactOffset.y * force * 0.5; // 위/아래 당점
    const sideSpin = impactOffset.x * force * 0.3; // 좌/우 당점

    // 각속도 벡터
    const angularVel = new THREE.Vector3()
      .addScaledVector(right, topSpin / ballRadius)
      .addScaledVector(up, sideSpin / ballRadius);

    return new this.ammo.btVector3(
      angularVel.x,
      angularVel.y,
      angularVel.z
    );
  }

  /**
   * EF-2 각속도 계산 (하프 시스템용)
 * @param ammo Ammo.js 모듈
   * @param direction 샷 방향
   * @param impactOffsetY 수직 당점 (-0.5 = EF-2 top, 0.5 = EF-2 bottom)
   * @param power 힘 (0-100)
   */
  calculateEf2AngularVelocity(
    ammo: typeof AmmoType,
    direction: THREE.Vector3,
    impactOffsetY: number,
    power: number
  ): AmmoType.btVector3 {
    const magnitude = Math.abs(impactOffsetY) * power * 0.5;
    
    // 회전 축 (진행 방향과 수직)
    const axis = new ammo.btVector3(-direction.z, 0, direction.x);
    axis.normalize();
    
    // 회전 방향 (상단/하단)
    if (impactOffsetY > 0) {
      axis.op_mul(-1);
    }
    
    return axis.op_mul(magnitude * 10);
  }

  /**
   * 하프 시스템 궤적 보정
   * - EF-2에 따른 도착점 보정
   */
  calculateHalfSystemCorrection(
    firstCushion: number,
    ef2Offset: number,
    tableCondition: 'fast' | 'normal' | 'slow'
  ): number {
    // 테이블 상태별 보정 계수
    const conditionFactors = {
      fast: 0.8,
      normal: 1.0,
      slow: 1.2,
    };

    const factor = conditionFactors[tableCondition];
    
    // EF-2에 따른 보정
    // EF-2 top: 짧게 떨어짐 (+보정 필요)
    // EF-2 bottom: 길게 떨어짐 (-보정 필요)
    const ef2Correction = ef2Offset * 0.3 * factor;

    return firstCushion + ef2Correction;
  }
}
