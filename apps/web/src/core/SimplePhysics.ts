import { Vector3 } from 'three';
import { PHYSICS } from '../lib/constants';

interface PhysicsBall {
  id: string;
  position: Vector3;
  velocity: Vector3;
  radius: number;
  mass: number;
}

interface Collision {
  ball1: PhysicsBall;
  ball2: PhysicsBall;
  normal: Vector3;
  penetration: number;
}

/**
 * 개선된 2D 물리 엔진
 * - 현실적인 마찰: 초기에는 거의 없고, 속도가 줄어들수록 증가
 * - 에너지 보존: 쿠션/공 충돌 시 반발력 적용
 */
export class SimplePhysics {
  private balls: Map<string, PhysicsBall> = new Map();
  private tableBounds = {
    minX: -PHYSICS.TABLE_WIDTH / 2 + PHYSICS.CUSHION_THICKNESS + PHYSICS.BALL_RADIUS,
    maxX: PHYSICS.TABLE_WIDTH / 2 - PHYSICS.CUSHION_THICKNESS - PHYSICS.BALL_RADIUS,
    minZ: -PHYSICS.TABLE_HEIGHT / 2 + PHYSICS.CUSHION_THICKNESS + PHYSICS.BALL_RADIUS,
    maxZ: PHYSICS.TABLE_HEIGHT / 2 - PHYSICS.CUSHION_THICKNESS - PHYSICS.BALL_RADIUS,
  };

  // 콜백
  onCushionCollision?: (ballId: string, cushionId: string) => void;
  onBallCollision?: (ballId1: string, ballId2: string) => void;

  /**
   * 초기화
   */
  init(): void {
    console.log('[SimplePhysics] Initialized with realistic friction');
  }

  /**
   * 공 생성
   */
  createBall(id: string, position: Vector3, radius: number = PHYSICS.BALL_RADIUS): void {
    this.balls.set(id, {
      id,
      position: position.clone(),
      velocity: new Vector3(0, 0, 0),
      radius,
      mass: 0.21,
    });
  }

  /**
   * 속도 적용
   */
  applyVelocity(id: string, velocity: { x: number; y: number; z: number }): void {
    const ball = this.balls.get(id);
    if (!ball) {
      console.log('[Physics] Ball not found:', id);
      return;
    }
    
    console.log('[Physics] Applying velocity to', id, ':', velocity);
    ball.velocity.set(velocity.x, 0, velocity.z);
    console.log('[Physics] New velocity:', ball.velocity);
  }

  /**
   * 물리 스텝
   */
  step(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.016); // 최대 16ms (60fps)

    // 1. 위치 업데이트 전에 충돌 처리 (반복적으로 해결)
    for (let i = 0; i < 2; i++) {
      this.handleBallCollisions();
    }

    // 2. 위치 업데이트
    for (const ball of this.balls.values()) {
      const speed = ball.velocity.length();
      
      // 완전 정지 처리 (매우 느릴 때만)
      if (speed < 0.001) {
        ball.velocity.set(0, 0, 0);
        continue;
      }

      // 위치 = 위치 + 속도 * 시간
      ball.position.add(ball.velocity.clone().multiplyScalar(dt));

      // === 현실적인 마찰 적용 ===
      // 속도가 빠를 때: 마찰이 매우 작음 (미끄러짐)
      // 속도가 느릴 때: 마찰이 커짐 (롤링)
      
      // 속도에 따른 마찰 계수
      // 10 m/s 이상: 거의 마찰 없음 (0.9999)
      // 1 m/s: 약간의 마찰 (0.999)
      // 0.1 m/s: 큰 마찰 (0.99)
      let friction;
      if (speed > 5) {
        friction = 0.9998; // 매우 빠를 때: 거의 감소 없음
      } else if (speed > 2) {
        friction = 0.9995; // 빠를 때: 약간의 감소
      } else if (speed > 0.5) {
        friction = 0.999; // 중간: 천천히 감소
      } else {
        friction = 0.995; // 느릴 때: 빠르게 감소
      }
      
      ball.velocity.multiplyScalar(friction);
    }

    // 3. 공-쿠션 충돌 처리
    this.handleCushionCollisions();
  }

  /**
   * 쿠션 충돌 처리
   */
  private handleCushionCollisions(): void {
    for (const ball of this.balls.values()) {
      const { minX, maxX, minZ, maxZ } = this.tableBounds;
      let collided = false;
      let cushionId = '';

      // 좌/우 쿠션
      if (ball.position.x < minX) {
        ball.position.x = minX;
        ball.velocity.x = -ball.velocity.x * 0.72;
        collided = true;
        cushionId = 'left';
      } else if (ball.position.x > maxX) {
        ball.position.x = maxX;
        ball.velocity.x = -ball.velocity.x * 0.72;
        collided = true;
        cushionId = 'right';
      }

      // 상/하 쿠션
      if (ball.position.z < minZ) {
        ball.position.z = minZ;
        ball.velocity.z = -ball.velocity.z * 0.72;
        collided = true;
        cushionId = 'top';
      } else if (ball.position.z > maxZ) {
        ball.position.z = maxZ;
        ball.velocity.z = -ball.velocity.z * 0.72;
        collided = true;
        cushionId = 'bottom';
      }

      if (collided && this.onCushionCollision) {
        this.onCushionCollision(ball.id, cushionId);
      }
    }
  }

  /**
   * 공-공 충돌 처리
   */
  private handleBallCollisions(): void {
    const ballArray = Array.from(this.balls.values());

    for (let i = 0; i < ballArray.length; i++) {
      for (let j = i + 1; j < ballArray.length; j++) {
        const ball1 = ballArray[i];
        const ball2 = ballArray[j];

        const collision = this.checkBallCollision(ball1, ball2);
        if (collision) {
          this.resolveBallCollision(collision);
          
          if (this.onBallCollision) {
            this.onBallCollision(ball1.id, ball2.id);
          }
        }
      }
    }
  }

  /**
   * 공-공 충돌 검사
   */
  private checkBallCollision(ball1: PhysicsBall, ball2: PhysicsBall): Collision | null {
    const diff = ball2.position.clone().sub(ball1.position);
    const distance = diff.length();
    const minDistance = ball1.radius + ball2.radius;

    if (distance < minDistance && distance > 0.0001) {
      const normal = diff.normalize();
      const penetration = minDistance - distance;
      return { ball1, ball2, normal, penetration };
    }

    return null;
  }

  /**
   * 공-공 충돌 해결 (탄성 충돌)
   */
  private resolveBallCollision(collision: Collision): void {
    const { ball1, ball2, normal, penetration } = collision;

    // === 1. 위치 분리 (겹침 해결) ===
    const separationFactor = 1.0;
    const totalMass = ball1.mass + ball2.mass;
    const ratio1 = ball2.mass / totalMass;
    const ratio2 = ball1.mass / totalMass;
    
    const separation = penetration * separationFactor;
    
    ball1.position.sub(normal.clone().multiplyScalar(separation * ratio1));
    ball2.position.add(normal.clone().multiplyScalar(separation * ratio2));

    // === 2. 속도 반응 (탄성 충돌) ===
    // Relative velocity from ball1 to ball2.
    // Using (ball2 - ball1) keeps "separating" check intuitive:
    // dot >= 0 means moving apart along collision normal.
    const relativeVelocity = ball2.velocity.clone().sub(ball1.velocity);
    const velocityAlongNormal = relativeVelocity.dot(normal);

    if (velocityAlongNormal >= 0) return;

    // 충돌 반응 (반발 계수 적용)
    const restitution = 0.95;
    let impulse = -(1 + restitution) * velocityAlongNormal;
    impulse /= (1 / ball1.mass + 1 / ball2.mass);

    const impulseVector = normal.clone().multiplyScalar(impulse);
    ball1.velocity.sub(impulseVector.clone().multiplyScalar(1 / ball1.mass));
    ball2.velocity.add(impulseVector.clone().multiplyScalar(1 / ball2.mass));

    // === 3. 접선 방향 마찰 ===
    const tangent = new Vector3(-normal.z, 0, normal.x);
    const velocityAlongTangent = relativeVelocity.dot(tangent);
    
    const frictionImpulse = -velocityAlongTangent * 0.1;
    const frictionVector = tangent.multiplyScalar(frictionImpulse / totalMass);
    
    ball1.velocity.sub(frictionVector);
    ball2.velocity.add(frictionVector);
  }

  /**
   * 모든 공 상태 가져오기
   */
  getAllBallStates(): Map<string, { position: Vector3; velocity: Vector3 }> {
    const states = new Map();
    
    for (const [id, ball] of this.balls) {
      states.set(id, {
        position: ball.position.clone(),
        velocity: ball.velocity.clone(),
      });
    }
    
    return states;
  }

  /**
   * 특정 공 상태 가져오기
   */
  getBallState(id: string): { position: Vector3; velocity: Vector3 } | null {
    const ball = this.balls.get(id);
    if (!ball) return null;
    
    return {
      position: ball.position.clone(),
      velocity: ball.velocity.clone(),
    };
  }

  /**
   * 모든 공이 멈췄는지 확인
   */
  areAllBallsStopped(threshold = 0.01): boolean {
    for (const ball of this.balls.values()) {
      if (ball.velocity.length() > threshold) return false;
    }
    return true;
  }

  /**
   * 공 위치 리셋
   */
  resetBall(id: string, position: Vector3): void {
    const ball = this.balls.get(id);
    if (!ball) return;
    
    ball.position.copy(position);
    ball.velocity.set(0, 0, 0);
  }

  /**
   * 정리
   */
  cleanup(): void {
    this.balls.clear();
  }
}

// 싱글톤 인스턴스
export const simplePhysics = new SimplePhysics();
