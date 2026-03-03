import type AmmoType from 'ammo.js';
import * as THREE from 'three';

/**
 * 궤적 포인트
 */
export interface TrajectoryPoint {
  position: THREE.Vector3;
  velocity: THREE.Vector3;
  cushionContact?: number;
}

/**
 * 예측 결과
 */
export interface PredictionResult {
  points: TrajectoryPoint[];
  cushionContacts: number;
  estimatedEnd: THREE.Vector3;
}

/**
 * 궤적 예측기
 * - Raycast 기반 3쿠션 경로 예측
 * - Throw 계산 포함
 */
export class TrajectoryPredictor {
  private ammo: typeof AmmoType;
  private world: AmmoType.btDiscreteDynamicsWorld;

  // 테이블 크기 (Unit: 10cm)
  static readonly TABLE_WIDTH = 28.4;
  static readonly TABLE_HEIGHT = 14.2;
  static readonly BALL_RADIUS = 0.615;

  constructor(ammo: typeof AmmoType, world: AmmoType.btDiscreteDynamicsWorld) {
    this.ammo = ammo;
    this.world = world;
  }

  /**
   * 궤적 예측
   * @param startPos 시작 위치
   * @param velocity 초기 속도
   * @param maxCushions 최대 쿠션 횟수
   */
  predict(
    startPos: THREE.Vector3,
    velocity: THREE.Vector3,
    maxCushions: number = 3
  ): PredictionResult {
    const points: TrajectoryPoint[] = [];
    let cushionContacts = 0;
    
    const currentPos = startPos.clone();
    const currentVel = velocity.clone();
    const timeStep = 1 / 60;
    const maxSteps = 600; // 10초 시뮬레이션

    points.push({
      position: currentPos.clone(),
      velocity: currentVel.clone(),
    });

    for (let step = 0; step < maxSteps; step++) {
      // 다음 위치 계산
      const nextPos = currentPos.clone().add(
        currentVel.clone().multiplyScalar(timeStep)
      );

      // 쿠션 충돌 검사
      const { TABLE_WIDTH, TABLE_HEIGHT, BALL_RADIUS } = TrajectoryPredictor;
      const minX = -TABLE_WIDTH / 2 + BALL_RADIUS;
      const maxX = TABLE_WIDTH / 2 - BALL_RADIUS;
      const minZ = -TABLE_HEIGHT / 2 + BALL_RADIUS;
      const maxZ = TABLE_HEIGHT / 2 - BALL_RADIUS;

      let hitCushion = false;

      // 좌우 쿠션
      if (nextPos.x < minX || nextPos.x > maxX) {
        currentVel.x *= -0.95; // 에너지 손실 5%
        nextPos.x = nextPos.x < minX ? minX : maxX;
        hitCushion = true;
      }

      // 상하 쿠션
      if (nextPos.z < minZ || nextPos.z > maxZ) {
        currentVel.z *= -0.95;
        nextPos.z = nextPos.z < minZ ? minZ : maxZ;
        hitCushion = true;
      }

      if (hitCushion) {
        cushionContacts++;
        points.push({
          position: nextPos.clone(),
          velocity: currentVel.clone(),
          cushionContact: cushionContacts,
        });

        if (cushionContacts >= maxCushions) {
          break;
        }
      }

      // 속도 감쇠 (마찰)
      currentVel.multiplyScalar(0.998);

      // 위치 업데이트
      currentPos.copy(nextPos);

      // 속도가 충분히 작아지면 정지
      if (currentVel.length() < 0.01) {
        break;
      }

      // 포인트 저장 (10스텝마다)
      if (step % 10 === 0) {
        points.push({
          position: currentPos.clone(),
          velocity: currentVel.clone(),
        });
      }
    }

    return {
      points,
      cushionContacts,
      estimatedEnd: currentPos,
    };
  }

  /**
   * 하프 시스템 궤적 계산
   */
  calculateHalfSystemTrajectory(
    cueBallPos: number,
    firstCushion: number,
    power: number
  ): PredictionResult {
    const { TABLE_WIDTH, TABLE_HEIGHT } = TrajectoryPredictor;

    const startX = (cueBallPos / 50 - 0.5) * TABLE_WIDTH;
    const cushionX = (firstCushion / 50 - 0.5) * TABLE_WIDTH;
    const startZ = 0; // 중앙에서 시작

    const dirX = cushionX - startX;
    const dirZ = -TABLE_HEIGHT / 2 - startZ;

    const length = Math.sqrt(dirX * dirX + dirZ * dirZ);
    const speed = power * 0.3;

    return this.predict(
      new THREE.Vector3(startX, 0.615, startZ),
      new THREE.Vector3(
        (dirX / length) * speed,
        0,
        (dirZ / length) * speed
      ),
      3
    );
  }
}

/**
 * 궤적 라인 생성
 */
export function createTrajectoryLine(
  points: THREE.Vector3[], 
  color: number = 0x00ff00,
  lineWidth: number = 5
): THREE.Line {
  const geometry = new THREE.BufferGeometry().setFromPoints(points);
  const material = new THREE.LineBasicMaterial({
    color,
    linewidth: lineWidth,
  });
  return new THREE.Line(geometry, material);
}
