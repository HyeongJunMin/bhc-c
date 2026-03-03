import type AmmoType from 'ammo.js';
import { PHYSICS } from '../lib/constants';

/**
 * Ammo.js 물리 세계 관리자
 * - Physics-Spec.md 기준 테이블 설정
 * - 쿠션/공 충돌 콜백 지원
 */
export class PhysicsWorld {
  private ammo: typeof AmmoType;
  private collisionConfig: AmmoType.btDefaultCollisionConfiguration;
  private dispatcher: AmmoType.btCollisionDispatcher;
  private broadphase: AmmoType.btDbvtBroadphase;
  private solver: AmmoType.btSequentialImpulseConstraintSolver;
  private world: AmmoType.btDiscreteDynamicsWorld;

  // 콜백
  onCushionCollision?: (ballId: string, railId: string, impactSpeed: number) => void;
  onBallCollision?: (ballId1: string, ballId2: string) => void;

  // 테이블 경계
  private readonly halfWidth = PHYSICS.TABLE_WIDTH / 2;
  private readonly halfHeight = PHYSICS.TABLE_HEIGHT / 2;
  
  // Body ID 매핑 (setUserPointer 대신 사용)
  private bodyIdMap = new Map<number, { type: string; id: string }>();
  private nextBodyId = 1;

  constructor(ammo: typeof AmmoType) {
    this.ammo = ammo;
    
    // 물리 세계 초기화
    this.collisionConfig = new ammo.btDefaultCollisionConfiguration();
    this.dispatcher = new ammo.btCollisionDispatcher(this.collisionConfig);
    this.broadphase = new ammo.btDbvtBroadphase();
    this.solver = new ammo.btSequentialImpulseConstraintSolver();
    this.world = new ammo.btDiscreteDynamicsWorld(
      this.dispatcher,
      this.broadphase,
      this.solver,
      this.collisionConfig
    );
    
    // 중력
    this.world.setGravity(new ammo.btVector3(0, -9.8, 0));
    
    // 테이블 생성
    this.createTable();
  }

  private createTable(): void {
    const { halfWidth, halfHeight } = this;

    // 바닥 (천)
    const floorShape = new this.ammo.btBoxShape(
      new this.ammo.btVector3(halfWidth, 0.01, halfHeight)
    );
    const floorTransform = new this.ammo.btTransform();
    floorTransform.setIdentity();
    floorTransform.setOrigin(new this.ammo.btVector3(0, 0, 0));

    const floorMotionState = new this.ammo.btDefaultMotionState(floorTransform);
    const floorRigidBodyCI = new this.ammo.btRigidBodyConstructionInfo(
      0,
      floorMotionState,
      floorShape
    );
    const floorBody = new this.ammo.btRigidBody(floorRigidBodyCI);
    
    // 천 마찰
    floorBody.setFriction(PHYSICS.SLIDING_FRICTION);
    floorBody.setRollingFriction(PHYSICS.ROLLING_FRICTION);
    floorBody.setRestitution(0.1);
    
    this.world.addRigidBody(floorBody);
    this.registerBody(floorBody, 'floor', 'floor');

    // 4면 쿠션
    const cushionThickness = 0.06;
    const ch = PHYSICS.CUSHION_HEIGHT / 2;
    
    const cushions = [
      { id: 'top',    pos: [0, ch, -halfHeight - cushionThickness/2], size: [halfWidth, ch, cushionThickness/2] },
      { id: 'bottom', pos: [0, ch, halfHeight + cushionThickness/2], size: [halfWidth, ch, cushionThickness/2] },
      { id: 'left',   pos: [-halfWidth - cushionThickness/2, ch, 0], size: [cushionThickness/2, ch, halfHeight] },
      { id: 'right',  pos: [halfWidth + cushionThickness/2, ch, 0], size: [cushionThickness/2, ch, halfHeight] },
    ];

    cushions.forEach((c) => {
      const shape = new this.ammo.btBoxShape(
        new this.ammo.btVector3(c.size[0], c.size[1], c.size[2])
      );
      const transform = new this.ammo.btTransform();
      transform.setIdentity();
      transform.setOrigin(new this.ammo.btVector3(c.pos[0], c.pos[1], c.pos[2]));

      const motionState = new this.ammo.btDefaultMotionState(transform);
      const rbInfo = new this.ammo.btRigidBodyConstructionInfo(0, motionState, shape);
      const body = new this.ammo.btRigidBody(rbInfo);

      body.setRestitution(PHYSICS.BALL_CUSHION_RESTITUTION);
      body.setFriction(PHYSICS.CUSHION_FRICTION);
      
      this.world.addRigidBody(body);
      this.registerBody(body, 'cushion', c.id);
    });
  }
  
  // Body ID 등록
  private registerBody(body: AmmoType.btRigidBody, type: string, id: string): number {
    const bodyId = this.nextBodyId++;
    this.bodyIdMap.set(bodyId, { type, id });
    // @ts-ignore - body에 ID 저장
    body._bhcId = bodyId;
    return bodyId;
  }
  
  // Body ID로 정보 조회
  private getBodyInfo(body: AmmoType.btRigidBody): { type: string; id: string } | null {
    // @ts-ignore
    const bodyId = body._bhcId;
    if (bodyId) {
      return this.bodyIdMap.get(bodyId) || null;
    }
    return null;
  }

  createBall(x: number, y: number, z: number, id: string = ''): AmmoType.btRigidBody {
    const { BALL_RADIUS, BALL_MASS } = PHYSICS;

    const shape = new this.ammo.btSphereShape(BALL_RADIUS);
    const transform = new this.ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new this.ammo.btVector3(x, y, z));

    const motionState = new this.ammo.btDefaultMotionState(transform);
    const localInertia = new this.ammo.btVector3(0, 0, 0);
    shape.calculateLocalInertia(BALL_MASS, localInertia);

    const rbInfo = new this.ammo.btRigidBodyConstructionInfo(
      BALL_MASS,
      motionState,
      shape,
      localInertia
    );
    const body = new this.ammo.btRigidBody(rbInfo);

    // 공 물리 특성
    body.setRestitution(PHYSICS.BALL_BALL_RESTITUTION);
    body.setFriction(0.06);
    body.setRollingFriction(PHYSICS.ROLLING_FRICTION);
    body.setDamping(0.005, 0.005);
    // 2.5D 테이블 모델: Y축 이동을 막아 강한 샷 시 공 이탈 방지
    // ammo.js 타입 정의에 누락되어 있어 런타임 API를 직접 호출
    (body as unknown as { setLinearFactor: (v: AmmoType.btVector3) => void })
      .setLinearFactor(new this.ammo.btVector3(1, 0, 1));

    // CCD 설정
    body.setCcdMotionThreshold(BALL_RADIUS);
    body.setCcdSweptSphereRadius(BALL_RADIUS * 0.9);

    this.world.addRigidBody(body);
    this.registerBody(body, 'ball', id);
    
    return body;
  }

  step(deltaTime: number): void {
    const fixedTimeStep = 1 / 120;
    const maxSubSteps = 10;
    
    this.world.stepSimulation(deltaTime, maxSubSteps, fixedTimeStep);
    
    // 충돌 이벤트 처리
    this.processCollisions();
  }

  private processCollisions(): void {
    // @ts-ignore - getNumManifolds exists in ammo.js
    const numManifolds = this.dispatcher.getNumManifolds();
    
    for (let i = 0; i < numManifolds; i++) {
      // @ts-ignore - getManifoldByIndexInternal exists in ammo.js
      const manifold = this.dispatcher.getManifoldByIndexInternal(i);
      const body0 = manifold.getBody0();
      const body1 = manifold.getBody1();
      
      const numContacts = manifold.getNumContacts();
      if (numContacts === 0) continue;
      
      const info0 = this.getBodyInfo(body0);
      const info1 = this.getBodyInfo(body1);
      
      if (!info0 || !info1) continue;
      
      // 쿠션-공 충돌
      if ((info0.type === 'cushion' && info1.type === 'ball') ||
          (info1.type === 'cushion' && info0.type === 'ball')) {
        const cushionInfo = info0.type === 'cushion' ? info0 : info1;
        const ballInfo = info0.type === 'ball' ? info0 : info1;
        
        this.onCushionCollision?.(ballInfo.id, cushionInfo.id, 0);
      }
      
      // 공-공 충돌
      if (info0.type === 'ball' && info1.type === 'ball') {
        this.onBallCollision?.(info0.id, info1.id);
      }
    }
  }

  getTransform(body: AmmoType.btRigidBody): { position: AmmoType.btVector3; quaternion: AmmoType.btQuaternion } {
    const motionState = body.getMotionState();
    const transform = new this.ammo.btTransform();
    motionState.getWorldTransform(transform);
    
    return {
      position: transform.getOrigin(),
      quaternion: transform.getRotation(),
    };
  }

  getWorld(): AmmoType.btDiscreteDynamicsWorld {
    return this.world;
  }

  getAmmo(): typeof AmmoType {
    return this.ammo;
  }
}
