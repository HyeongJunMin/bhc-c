import { Vector3 } from 'three';
import { PHYSICS } from '../lib/constants';

interface PhysicsBall {
  id: string;
  position: Vector3;
  velocity: Vector3;
  angularVelocity: Vector3;
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
 * 완벽한 3쿠션 물리 엔진
 * - 현실적인 마찰 (슬라이딩 -> 롤링 전환)
 * - 스핀 기반 쿠션 throw
 * - 공-공 충돌 시 스핀 전달
 * - 정밀한 속도 감소
 */
export class SimplePhysics {
  private balls: Map<string, PhysicsBall> = new Map();
  private tableBounds = {
    minX: -PHYSICS.TABLE_WIDTH / 2 + PHYSICS.BALL_RADIUS,
    maxX: PHYSICS.TABLE_WIDTH / 2 - PHYSICS.BALL_RADIUS,
    minZ: -PHYSICS.TABLE_HEIGHT / 2 + PHYSICS.BALL_RADIUS,
    maxZ: PHYSICS.TABLE_HEIGHT / 2 - PHYSICS.BALL_RADIUS,
  };

  onCushionCollision?: (ballId: string, cushionId: string, impactSpeed: number) => void;
  onBallCollision?: (ballId1: string, ballId2: string) => void;

  init(): void {
    console.log('[SimplePhysics] 3-Cushion Physics Initialized');
  }

  createBall(id: string, position: Vector3, radius: number = PHYSICS.BALL_RADIUS): void {
    this.balls.set(id, {
      id,
      position: position.clone(),
      velocity: new Vector3(0, 0, 0),
      angularVelocity: new Vector3(0, 0, 0),
      radius,
      mass: PHYSICS.BALL_MASS,
    });
  }

  applyVelocity(id: string, velocity: { x: number; y: number; z: number }): void {
    const ball = this.balls.get(id);
    if (!ball) return;
    ball.velocity.set(velocity.x, 0, velocity.z);
  }

  applyVelocityAndSpin(
    id: string, 
    velocity: { x: number; z: number }, 
    angularVelocity: { omegaX: number; omegaZ: number }
  ): void {
    const ball = this.balls.get(id);
    if (!ball) return;
    ball.velocity.set(velocity.x, 0, velocity.z);
    ball.angularVelocity.set(angularVelocity.omegaX, 0, angularVelocity.omegaZ);
  }

  /**
   * 물리 스텝 - 완벽한 3쿠션 물리
   */
  step(deltaTime: number): void {
    const dt = Math.min(deltaTime, 0.016);

    // 충돌 처리
    for (let i = 0; i < 4; i++) {
      this.handleBallCollisions();
    }

    // 위치 업데이트 및 마찰 적용
    for (const ball of this.balls.values()) {
      const speed = ball.velocity.length();
      
      if (speed < 0.005) {
        ball.velocity.set(0, 0, 0);
        ball.angularVelocity.set(0, 0, 0);
        continue;
      }

      // 위치 업데이트
      ball.position.add(ball.velocity.clone().multiplyScalar(dt));

      // === 현실적인 마찰 적용 (슬라이딩 -> 롤링) ===
      const slidingFriction = PHYSICS.SLIDING_FRICTION;
      const rollingFriction = PHYSICS.ROLLING_FRICTION;
      
      // 공의 회전 속도
      const spinSpeed = ball.angularVelocity.length();
      
      // 슬라이딩 vs 롤링 판정
      // 속도와 회전 속도의 차이로 판단
      const velocityDiff = Math.abs(speed - spinSpeed * ball.radius);
      
      let friction;
      if (velocityDiff > 0.5) {
        // 슬라이딩 (미끄러짐) - 큰 마찰
        friction = 1.0 - (slidingFriction * dt * 5);
      } else if (velocityDiff > 0.1) {
        // 전환 구간
        const t = (0.5 - velocityDiff) / 0.4;
        const currentFriction = slidingFriction * (1 - t) + rollingFriction * t;
        friction = 1.0 - (currentFriction * dt * 5);
      } else {
        // 롤링 (구름) - 작은 마찰
        friction = 1.0 - (rollingFriction * dt * 5);
      }
      
      // 마찰 적용
      friction = Math.max(0.99, Math.min(1.0, friction));
      ball.velocity.multiplyScalar(friction);
      
      // 회전도 자연스럽게 감소
      const spinFriction = 0.995;
      ball.angularVelocity.multiplyScalar(spinFriction);
      
      // 롤링 상태에서는 회전이 속도에 영향을 주도록 (진행 방향으로 회전이 맞춰짐)
      if (velocityDiff < 0.1 && speed > 0.1) {
        const rollDirection = ball.velocity.clone().normalize();
        const idealSpinX = -rollDirection.z / ball.radius * speed * 0.1;
        const idealSpinZ = rollDirection.x / ball.radius * speed * 0.1;
        
        ball.angularVelocity.x += (idealSpinX - ball.angularVelocity.x) * 0.1;
        ball.angularVelocity.z += (idealSpinZ - ball.angularVelocity.z) * 0.1;
      }
    }

    this.handleCushionCollisions();
  }

  /**
   * 쿠션 충돌 - 완벽한 throw 효과
   */
  private handleCushionCollisions(): void {
    for (const ball of this.balls.values()) {
      const { minX, maxX, minZ, maxZ } = this.tableBounds;
      let collided = false;
      let cushionId = '';

      // 좌/우 쿠션
      if (ball.position.x < minX) {
        ball.position.x = minX;
        const incomingSpeed = Math.abs(ball.velocity.x);
        
        // 반발
        ball.velocity.x = -ball.velocity.x * PHYSICS.BALL_CUSHION_RESTITUTION;
        
        // 스핀 기반 throw 효과 (정교하게 계산)
        // side spin (omegaZ)이 있으면 쿠션에서 옆으로 튕겨나감
        const throwEffect = ball.angularVelocity.z * ball.radius * 0.5;
        const approachAngle = Math.abs(Math.atan2(ball.velocity.z, ball.velocity.x));
        const throwMultiplier = Math.sin(approachAngle) * 0.8 + 0.2;
        
        ball.velocity.z += throwEffect * throwMultiplier;
        
        // 쿠션 마찰로 인한 속도 감소 (접선 방향)
        ball.velocity.z *= (1 - PHYSICS.CUSHION_FRICTION);
        
        // 스핀 변화 (쿠션에 부딪히면서 스핀이 변함)
        ball.angularVelocity.z *= 0.7;
        ball.angularVelocity.z -= Math.sign(ball.velocity.x) * incomingSpeed * 0.05;
        
        collided = true;
        cushionId = 'left';
      } else if (ball.position.x > maxX) {
        ball.position.x = maxX;
        const incomingSpeed = Math.abs(ball.velocity.x);
        
        ball.velocity.x = -ball.velocity.x * PHYSICS.BALL_CUSHION_RESTITUTION;
        
        const throwEffect = ball.angularVelocity.z * ball.radius * 0.5;
        const approachAngle = Math.abs(Math.atan2(ball.velocity.z, ball.velocity.x));
        const throwMultiplier = Math.sin(approachAngle) * 0.8 + 0.2;
        
        ball.velocity.z -= throwEffect * throwMultiplier;
        ball.velocity.z *= (1 - PHYSICS.CUSHION_FRICTION);
        
        ball.angularVelocity.z *= 0.7;
        ball.angularVelocity.z += Math.sign(ball.velocity.x) * incomingSpeed * 0.05;
        
        collided = true;
        cushionId = 'right';
      }

      // 상/하 쿠션
      if (ball.position.z < minZ) {
        ball.position.z = minZ;
        const incomingSpeed = Math.abs(ball.velocity.z);
        
        ball.velocity.z = -ball.velocity.z * PHYSICS.BALL_CUSHION_RESTITUTION;
        
        // top/back spin (omegaX) throw 효과
        const throwEffect = ball.angularVelocity.x * ball.radius * 0.5;
        const approachAngle = Math.abs(Math.atan2(ball.velocity.x, ball.velocity.z));
        const throwMultiplier = Math.sin(approachAngle) * 0.8 + 0.2;
        
        ball.velocity.x += throwEffect * throwMultiplier;
        ball.velocity.x *= (1 - PHYSICS.CUSHION_FRICTION);
        
        ball.angularVelocity.x *= 0.7;
        ball.angularVelocity.x -= Math.sign(ball.velocity.z) * incomingSpeed * 0.05;
        
        collided = true;
        cushionId = 'top';
      } else if (ball.position.z > maxZ) {
        ball.position.z = maxZ;
        const incomingSpeed = Math.abs(ball.velocity.z);
        
        ball.velocity.z = -ball.velocity.z * PHYSICS.BALL_CUSHION_RESTITUTION;
        
        const throwEffect = ball.angularVelocity.x * ball.radius * 0.5;
        const approachAngle = Math.abs(Math.atan2(ball.velocity.x, ball.velocity.z));
        const throwMultiplier = Math.sin(approachAngle) * 0.8 + 0.2;
        
        ball.velocity.x -= throwEffect * throwMultiplier;
        ball.velocity.x *= (1 - PHYSICS.CUSHION_FRICTION);
        
        ball.angularVelocity.x *= 0.7;
        ball.angularVelocity.x += Math.sign(ball.velocity.z) * incomingSpeed * 0.05;
        
        collided = true;
        cushionId = 'bottom';
      }

      if (collided && this.onCushionCollision) {
        const impactSpeed = ball.velocity.length();
        this.onCushionCollision(ball.id, cushionId, impactSpeed);
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
   * 공-공 충돌 해결 - 스핀 전달 포함
   */
  private resolveBallCollision(collision: Collision): void {
    const { ball1, ball2, normal, penetration } = collision;

    // 위치 분리
    const separation = penetration * 1.02;
    ball1.position.sub(normal.clone().multiplyScalar(separation * 0.5));
    ball2.position.add(normal.clone().multiplyScalar(separation * 0.5));

    // 상대 속도 계산
    const relativeVelocity = ball1.velocity.clone().sub(ball2.velocity);
    const velocityAlongNormal = relativeVelocity.dot(normal);

    if (velocityAlongNormal > 0) return;

    // 충돌 지점 (공 표면)
    const contactPoint1 = ball1.position.clone().add(normal.clone().multiplyScalar(ball1.radius));
    const contactPoint2 = ball2.position.clone().sub(normal.clone().multiplyScalar(ball2.radius));

    // 스핀에 따른 접선 속도 계산
    const spinVelocity1 = new Vector3(
      -ball1.angularVelocity.z * ball1.radius,
      0,
      ball1.angularVelocity.x * ball1.radius
    );
    const spinVelocity2 = new Vector3(
      -ball2.angularVelocity.z * ball2.radius,
      0,
      ball2.angularVelocity.x * ball2.radius
    );

    // 접점에서의 전체 상대 속도
    const surfaceVelocity1 = ball1.velocity.clone().add(spinVelocity1);
    const surfaceVelocity2 = ball2.velocity.clone().add(spinVelocity2);
    const surfaceRelativeVelocity = surfaceVelocity1.sub(surfaceVelocity2);

    // 법선 방향 충격량
    const restitution = PHYSICS.BALL_BALL_RESTITUTION;
    let impulse = -(1 + restitution) * velocityAlongNormal;
    impulse /= (1 / ball1.mass + 1 / ball2.mass);

    const impulseVector = normal.clone().multiplyScalar(impulse);

    // 속도 업데이트
    ball1.velocity.add(impulseVector.clone().multiplyScalar(1 / ball1.mass));
    ball2.velocity.sub(impulseVector.clone().multiplyScalar(1 / ball2.mass));

    // 접선 방향 마찰 및 스핀 전달
    const tangent = new Vector3(-normal.z, 0, normal.x).normalize();
    const velocityAlongTangent = surfaceRelativeVelocity.dot(tangent);
    
    // 마찰력으로 인한 스핀 변화
    const frictionImpulse = -velocityAlongTangent * 0.15;
    const frictionVector = tangent.multiplyScalar(frictionImpulse);
    
    ball1.velocity.add(frictionVector);
    ball2.velocity.sub(frictionVector);

    // 스핀 전달 (충돌로 인한 회전 변화)
    const spinTransfer = frictionImpulse * ball1.radius * 0.5;
    const spinAxisX = -tangent.z; // 접선 방향에 따른 회전 축
    const spinAxisZ = tangent.x;
    
    ball1.angularVelocity.x += spinAxisZ * spinTransfer * 0.1;
    ball1.angularVelocity.z -= spinAxisX * spinTransfer * 0.1;
    ball2.angularVelocity.x -= spinAxisZ * spinTransfer * 0.1;
    ball2.angularVelocity.z += spinAxisX * spinTransfer * 0.1;
  }

  getAllBallStates(): Map<string, { position: Vector3; velocity: Vector3; angularVelocity: Vector3 }> {
    const states = new Map();
    for (const [id, ball] of this.balls) {
      states.set(id, {
        position: ball.position.clone(),
        velocity: ball.velocity.clone(),
        angularVelocity: ball.angularVelocity.clone(),
      });
    }
    return states;
  }

  getBallState(id: string): { position: Vector3; velocity: Vector3; angularVelocity: Vector3 } | null {
    const ball = this.balls.get(id);
    if (!ball) return null;
    return {
      position: ball.position.clone(),
      velocity: ball.velocity.clone(),
      angularVelocity: ball.angularVelocity.clone(),
    };
  }

  areAllBallsStopped(threshold = 0.005): boolean {
    for (const ball of this.balls.values()) {
      if (ball.velocity.length() > threshold) return false;
    }
    return true;
  }

  resetBall(id: string, position: Vector3): void {
    const ball = this.balls.get(id);
    if (!ball) return;
    ball.position.copy(position);
    ball.velocity.set(0, 0, 0);
    ball.angularVelocity.set(0, 0, 0);
  }

  cleanup(): void {
    this.balls.clear();
  }
}

export const simplePhysics = new SimplePhysics();
