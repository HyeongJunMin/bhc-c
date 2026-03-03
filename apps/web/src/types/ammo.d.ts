/**
 * Ammo.js Type Definitions
 * 
 * Bullet Physics의 JavaScript/WebAssembly 바인딩
 */

declare module 'ammo.js' {
  // 벡터3
  export class btVector3 {
    constructor(x?: number, y?: number, z?: number);
    x(): number;
    y(): number;
    z(): number;
    setX(x: number): void;
    setY(y: number): void;
    setZ(z: number): void;
    length(): number;
    normalize(): btVector3;
    dot(v: btVector3): number;
    cross(v: btVector3): btVector3;
    add(v: btVector3): btVector3;
    sub(v: btVector3): btVector3;
    multiplyScalar(s: number): btVector3;
    op_add(v: btVector3): btVector3;
    op_sub(v: btVector3): btVector3;
    op_mul(s: number): btVector3;
  }

  // 쿼터니언
  export class btQuaternion {
    constructor(x?: number, y?: number, z?: number, w?: number);
    x(): number;
    y(): number;
    z(): number;
    w(): number;
    setX(x: number): void;
    setY(y: number): void;
    setZ(z: number): void;
    setW(w: number): void;
  }

  // 트랜스폼
  export class btTransform {
    constructor();
    setIdentity(): void;
    setOrigin(origin: btVector3): void;
    setRotation(rotation: btQuaternion): void;
    getOrigin(): btVector3;
    getRotation(): btQuaternion;
  }

  // 모션 상태
  export class btDefaultMotionState {
    constructor(transform?: btTransform);
    getWorldTransform(transform: btTransform): void;
    setWorldTransform(transform: btTransform): void;
  }

  // 충돌 형태
  export class btCollisionShape {
    calculateLocalInertia(mass: number, inertia: btVector3): void;
    setMargin(margin: number): void;
  }

  export class btBoxShape extends btCollisionShape {
    constructor(halfExtents: btVector3);
  }

  export class btSphereShape extends btCollisionShape {
    constructor(radius: number);
  }

  export class btCylinderShape extends btCollisionShape {
    constructor(halfExtents: btVector3);
  }

  export class btCapsuleShape extends btCollisionShape {
    constructor(radius: number, height: number);
  }

  // 강체 생성 정보
  export class btRigidBodyConstructionInfo {
    constructor(
      mass: number,
      motionState: btDefaultMotionState,
      collisionShape: btCollisionShape,
      localInertia?: btVector3
    );
  }

  // 강체
  export class btRigidBody {
    constructor(constructionInfo: btRigidBodyConstructionInfo);
    
    // 변환
    getWorldTransform(): btTransform;
    setWorldTransform(transform: btTransform): void;
    getMotionState(): btDefaultMotionState;
    
    // 물리 속성
    getMass(): number;
    setMassProps(mass: number, inertia: btVector3): void;
    
    // 속도
    getLinearVelocity(): btVector3;
    setLinearVelocity(velocity: btVector3): void;
    getAngularVelocity(): btVector3;
    setAngularVelocity(velocity: btVector3): void;
    
    // 충격
    applyCentralImpulse(impulse: btVector3): void;
    applyImpulse(impulse: btVector3, relPos: btVector3): void;
    applyTorqueImpulse(torque: btVector3): void;
    applyCentralForce(force: btVector3): void;
    
    // 감쇠
    setDamping(linDamping: number, angDamping: number): void;
    
    // 마찰
    setFriction(friction: number): void;
    setRollingFriction(friction: number): void;
    setSpinningFriction(friction: number): void;
    
    // 반발
    setRestitution(restitution: number): void;
    
    // CCD (Continuous Collision Detection)
    setCcdMotionThreshold(threshold: number): void;
    setCcdSweptSphereRadius(radius: number): void;
    
    // 활성화
    activate(forceActivation?: boolean): void;
    isActive(): boolean;
    
    // 중력
    setGravity(gravity: btVector3): void;
    
    // 제약
    setActivationState(state: number): void;
  }

  // 충돌 설정
  export class btDefaultCollisionConfiguration {
    constructor();
  }

  // 충돌 디스패처
  export class btCollisionDispatcher {
    constructor(config: btDefaultCollisionConfiguration);
  }

  // 브로드페이즈
  export class btDbvtBroadphase {
    constructor();
  }

  // 솔버
  export class btSequentialImpulseConstraintSolver {
    constructor();
  }

  // 디스크리트 다이나믹스 월드
  export class btDiscreteDynamicsWorld {
    constructor(
      dispatcher: btCollisionDispatcher,
      broadphase: btDbvtBroadphase,
      solver: btSequentialImpulseConstraintSolver,
      config: btDefaultCollisionConfiguration
    );
    
    setGravity(gravity: btVector3): void;
    addRigidBody(body: btRigidBody): void;
    removeRigidBody(body: btRigidBody): void;
    stepSimulation(
      timeStep: number,
      maxSubSteps?: number,
      fixedTimeStep?: number
    ): number;
  }

  // Raycast
  export class btClosestRayResultCallback {
    constructor(from: btVector3, to: btVector3);
    hasHit(): boolean;
    getCollisionObject(): btRigidBody | null;
    getHitPointWorld(): btVector3;
    getHitNormalWorld(): btVector3;
  }

  // Ammo 모듈 인터페이스
  interface AmmoModule {
    btVector3: typeof btVector3;
    btQuaternion: typeof btQuaternion;
    btTransform: typeof btTransform;
    btDefaultMotionState: typeof btDefaultMotionState;
    btCollisionShape: typeof btCollisionShape;
    btBoxShape: typeof btBoxShape;
    btSphereShape: typeof btSphereShape;
    btCylinderShape: typeof btCylinderShape;
    btCapsuleShape: typeof btCapsuleShape;
    btRigidBodyConstructionInfo: typeof btRigidBodyConstructionInfo;
    btRigidBody: typeof btRigidBody;
    btDefaultCollisionConfiguration: typeof btDefaultCollisionConfiguration;
    btCollisionDispatcher: typeof btCollisionDispatcher;
    btDbvtBroadphase: typeof btDbvtBroadphase;
    btSequentialImpulseConstraintSolver: typeof btSequentialImpulseConstraintSolver;
    btDiscreteDynamicsWorld: typeof btDiscreteDynamicsWorld;
    btClosestRayResultCallback: typeof btClosestRayResultCallback;
  }

  // 메인 Ammo 함수
  function Ammo(): Promise<AmmoModule>;
  
  export = AmmoModule;
}
