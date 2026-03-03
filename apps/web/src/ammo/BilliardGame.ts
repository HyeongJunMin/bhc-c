import type AmmoType from 'ammo.js';
import * as THREE from 'three';
import { PhysicsWorld } from './PhysicsWorld';
import { CueController, CueHitParams } from './Cue';
import { TrajectoryPredictor, createTrajectoryLine, PredictionResult } from './Prediction';
import { halfSystemSolver, HalfSystemParams } from '../lib/half-system';

/**
 * 통합 3쿠션 당구 게임 컨트롤러
 * 
 * Three.js + Ammo.js + 하프 시스템 통합
 * 스케일: 1 Unit = 10cm
 */
export class BilliardGame {
  // Ammo.js
  private ammo: typeof AmmoType;
  private physics: PhysicsWorld;
  private cue: CueController;
  private predictor: TrajectoryPredictor;

  // Three.js
  private scene: THREE.Scene;
  private balls: Map<string, {
    body: AmmoType.btRigidBody;
    mesh: THREE.Mesh;
  }> = new Map();

  // 궤적 표시
  private trajectoryLine: THREE.Line | null = null;

  // 테이블 상수 (Unit: 10cm = 1 Unit)
  static readonly TABLE_WIDTH = 28.4;   // 284cm
  static readonly TABLE_HEIGHT = 14.2;  // 142cm
  static readonly FRAME_THICKNESS = 1.5; // 15cm
  static readonly BALL_RADIUS = 0.615;   // 6.15cm (3쿠션 공)
  static readonly CUSHION_HEIGHT = 0.37; // 3.7cm

  constructor(ammo: typeof AmmoType, scene: THREE.Scene) {
    this.ammo = ammo;
    this.scene = scene;

    // 물리 세계 초기화
    this.physics = new PhysicsWorld(ammo);
    this.cue = new CueController(ammo);
    this.predictor = new TrajectoryPredictor(ammo, this.physics.getWorld());

    // 시각적 테이블 생성
    this.createVisualTable();
    
    // 기본 공 3개 생성
    this.createInitialBalls();
  }

  /**
   * Three.js 시각적 테이블 생성 - 상세 구현
   */
  private createVisualTable(): void {
    const { TABLE_WIDTH, TABLE_HEIGHT, FRAME_THICKNESS, CUSHION_HEIGHT } = BilliardGame;
    const totalWidth = TABLE_WIDTH + FRAME_THICKNESS * 2;

    // 1. 플레이 구역 (Cloth) - 밝은 초록색 (대표적 당구대 천)
    const clothGeometry = new THREE.PlaneGeometry(TABLE_WIDTH, TABLE_HEIGHT);
    const clothMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d8a4e, // 밝은 초록색 - 배경과 대비
      roughness: 0.8,
      metalness: 0.0,
    });
    const cloth = new THREE.Mesh(clothGeometry, clothMaterial);
    cloth.rotation.x = -Math.PI / 2;
    cloth.position.y = 0.01; // 살짝 위로
    cloth.receiveShadow = true;
    this.scene.add(cloth);

    // 2. 나무 프레임 (Rail/Frame)
    const woodMaterial = new THREE.MeshStandardMaterial({
      color: 0x8B4513, // 새들브라운 (나무색)
      roughness: 0.6,
      metalness: 0.1,
    });

    // 프레임은 테이블 바깥쪽에 두께 1.5 Unit으로 배치
    const frameConfigs = [
      // 상단 프레임
      { pos: [0, 0.15, -TABLE_HEIGHT/2 - FRAME_THICKNESS/2], size: [totalWidth, 0.3, FRAME_THICKNESS] },
      // 하단 프레임
      { pos: [0, 0.15, TABLE_HEIGHT/2 + FRAME_THICKNESS/2], size: [totalWidth, 0.3, FRAME_THICKNESS] },
      // 좌측 프레임
      { pos: [-TABLE_WIDTH/2 - FRAME_THICKNESS/2, 0.15, 0], size: [FRAME_THICKNESS, 0.3, TABLE_HEIGHT] },
      // 우측 프레임
      { pos: [TABLE_WIDTH/2 + FRAME_THICKNESS/2, 0.15, 0], size: [FRAME_THICKNESS, 0.3, TABLE_HEIGHT] },
    ];

    frameConfigs.forEach((config) => {
      const geometry = new THREE.BoxGeometry(config.size[0], config.size[1], config.size[2]);
      const mesh = new THREE.Mesh(geometry, woodMaterial);
      mesh.position.set(config.pos[0], config.pos[1], config.pos[2]);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      this.scene.add(mesh);
    });

    // 3. 쿠션 (시각적) - 프레임 안쪽
    const cushionMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d5a2d, // 천과 비슷한 색상의 쿠션
      roughness: 0.7,
    });

    const cushionThickness = 0.6;
    const cushionConfigs = [
      { pos: [0, CUSHION_HEIGHT/2, -TABLE_HEIGHT/2 - cushionThickness/2], size: [TABLE_WIDTH, CUSHION_HEIGHT, cushionThickness] },
      { pos: [0, CUSHION_HEIGHT/2, TABLE_HEIGHT/2 + cushionThickness/2], size: [TABLE_WIDTH, CUSHION_HEIGHT, cushionThickness] },
      { pos: [-TABLE_WIDTH/2 - cushionThickness/2, CUSHION_HEIGHT/2, 0], size: [cushionThickness, CUSHION_HEIGHT, TABLE_HEIGHT] },
      { pos: [TABLE_WIDTH/2 + cushionThickness/2, CUSHION_HEIGHT/2, 0], size: [cushionThickness, CUSHION_HEIGHT, TABLE_HEIGHT] },
    ];

    cushionConfigs.forEach((config) => {
      const geometry = new THREE.BoxGeometry(config.size[0], config.size[1], config.size[2]);
      const mesh = new THREE.Mesh(geometry, cushionMaterial);
      mesh.position.set(config.pos[0], config.pos[1], config.pos[2]);
      mesh.castShadow = true;
      this.scene.add(mesh);
    });

    // 4. 다이아몬드 마커 (원통형) - 프레임 위에 배치
    this.createDiamondMarkers();
    
    // 5. 바닥 (테이블 아래)
    const floorGeometry = new THREE.PlaneGeometry(100, 100);
    const floorMaterial = new THREE.MeshStandardMaterial({
      color: 0x0a0a0a,
      roughness: 1.0,
    });
    const floor = new THREE.Mesh(floorGeometry, floorMaterial);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.1;
    floor.receiveShadow = true;
    this.scene.add(floor);
  }

  /**
   * 다이아몬드 포인트 생성 - 프레임 위에 원통형 메쉬
   * 하프/파이브앤하프 시스템용 1/8 등분 지점
   */
  private createDiamondMarkers(): void {
    const { TABLE_WIDTH, TABLE_HEIGHT, FRAME_THICKNESS } = BilliardGame;
    const markerRadius = 0.12;
    const markerHeight = 0.08;
    
    const markerGeometry = new THREE.CylinderGeometry(markerRadius, markerRadius, markerHeight, 16);
    const markerMaterial = new THREE.MeshStandardMaterial({ 
      color: 0xffffff,
      roughness: 0.3,
      metalness: 0.5,
      emissive: 0x333333,
    });

    // 상하 프레임 - 8개씩 (50 포인트 시스템: 0, 10, 20, 30, 40, 50)
    // 실제로는 8개로 나누되, 50포인트 시스템에 맞춰 배치
    for (let i = 0; i <= 8; i++) {
      const x = (i / 8 - 0.5) * TABLE_WIDTH;
      
      // 상단 프레임
      const topMarker = new THREE.Mesh(markerGeometry, markerMaterial);
      topMarker.rotation.x = Math.PI / 2;
      topMarker.position.set(x, 0.32, -TABLE_HEIGHT/2 - FRAME_THICKNESS/2);
      this.scene.add(topMarker);

      // 하단 프레임
      const bottomMarker = new THREE.Mesh(markerGeometry, markerMaterial);
      bottomMarker.rotation.x = Math.PI / 2;
      bottomMarker.position.set(x, 0.32, TABLE_HEIGHT/2 + FRAME_THICKNESS/2);
      this.scene.add(bottomMarker);
    }

    // 좌우 프레임 - 4개씩
    for (let i = 0; i <= 4; i++) {
      const z = (i / 4 - 0.5) * TABLE_HEIGHT;
      
      // 좌측 프레임
      const leftMarker = new THREE.Mesh(markerGeometry, markerMaterial);
      leftMarker.rotation.z = Math.PI / 2;
      leftMarker.position.set(-TABLE_WIDTH/2 - FRAME_THICKNESS/2, 0.32, z);
      this.scene.add(leftMarker);

      // 우측 프레임
      const rightMarker = new THREE.Mesh(markerGeometry, markerMaterial);
      rightMarker.rotation.z = Math.PI / 2;
      rightMarker.position.set(TABLE_WIDTH/2 + FRAME_THICKNESS/2, 0.32, z);
      this.scene.add(rightMarker);
    }
  }

  /**
   * 기본 공 3개 생성 (수구, 적구1, 적구2)
   */
  private createInitialBalls(): void {
    const { TABLE_WIDTH } = BilliardGame;
    
    // 수구 (흰색) - 좌측에서 시작
    this.createBall('cue', -TABLE_WIDTH * 0.3, 0, 0xffffff);
    
    // 제1적구 (노란색) - 우측
    this.createBall('obj1', TABLE_WIDTH * 0.3, 2, 0xffd700);
    
    // 제2적구 (빨간색) - 중앙 약간 우측
    this.createBall('obj2', TABLE_WIDTH * 0.1, -2, 0xff3333);
  }

  /**
   * 공 생성
   */
  createBall(id: string, x: number, z: number, color: number): void {
    const { BALL_RADIUS } = BilliardGame;

    // 물리 공
    const body = this.physics.createBall(x, BALL_RADIUS, z);

    // Three.js 공 - 더 세밀하게
    const geometry = new THREE.SphereGeometry(BALL_RADIUS, 64, 64);
    const material = new THREE.MeshPhysicalMaterial({
      color,
      roughness: 0.05,
      metalness: 0.1,
      clearcoat: 1.0,
      clearcoatRoughness: 0.05,
      reflectivity: 1.0,
    });
    const mesh = new THREE.Mesh(geometry, material);
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    this.scene.add(mesh);

    this.balls.set(id, { body, mesh });
  }

  /**
   * 공 위치 업데이트 (UI 슬라이더 연동용)
   */
  updateBallPosition(id: string, x: number, z: number): void {
    const ball = this.balls.get(id);
    if (!ball) return;

    const { BALL_RADIUS } = BilliardGame;
    
    // 물리 위치 업데이트
    const transform = new this.ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new this.ammo.btVector3(x, BALL_RADIUS, z));
    
    ball.body.setWorldTransform(transform);
    ball.body.setLinearVelocity(new this.ammo.btVector3(0, 0, 0));
    ball.body.setAngularVelocity(new this.ammo.btVector3(0, 0, 0));
    ball.body.activate();

    // Three.js 위치 업데이트
    ball.mesh.position.set(x, BALL_RADIUS, z);
  }

  /**
   * 수구 위치 설정 (0-50 포인트 시스템)
   */
  setCueBallPosition(point: number): void {
    const { TABLE_WIDTH } = BilliardGame;
    // 0-50 포인트를 테이블 좌표로 변환
    const x = (point / 50 - 0.5) * TABLE_WIDTH;
    const z = 0; // 중앙 Z축
    
    this.updateBallPosition('cue', x, z);
  }

  /**
   * 하프 시스템 기반 샷 실행
   */
  executeHalfSystemShot(
    ballId: string,
    params: HalfSystemParams,
    power: number
  ): void {
    const ball = this.balls.get(ballId);
    if (!ball) return;

    // 하프 시스템 계산
    const advice = halfSystemSolver.calculate(params);

    // 큐 히트 파라미터 생성
    const hitParams: CueHitParams = {
      direction: this.calculateShotDirection(
        params.cueBallPosition,
        advice.firstCushionPoint
      ),
      force: (power / 100) * 50,
      impactOffset: { x: 0, y: 0 },
    };

    // 샷 실행
    this.cue.applyCueHit(ball.body, hitParams);

    console.log('[BilliardGame] Half System Shot:', {
      firstCushion: advice.firstCushionPoint,
      tip: advice.recommendedTip,
      spin: advice.spinAmount,
    });
  }

  /**
   * 샷 방향 계산
   */
  private calculateShotDirection(
    cueBallPos: number,
    targetCushion: number
  ): { x: number; y: number; z: number } {
    const { TABLE_WIDTH, TABLE_HEIGHT } = BilliardGame;

    const startX = (cueBallPos / 50 - 0.5) * TABLE_WIDTH;
    const targetX = (targetCushion / 50 - 0.5) * TABLE_WIDTH;

    const dirX = targetX - startX;
    const dirZ = -TABLE_HEIGHT / 2; // 상단 쿠션

    const length = Math.sqrt(dirX * dirX + dirZ * dirZ);

    return {
      x: dirX / length,
      y: 0,
      z: dirZ / length,
    };
  }

  /**
   * 궤적 예측 및 시각화 - 두꺼운 라인
   */
  showTrajectory(ballId: string, prediction?: PredictionResult): void {
    // 기존 궤적 제거
    if (this.trajectoryLine) {
      this.scene.remove(this.trajectoryLine);
      this.trajectoryLine.geometry.dispose();
      (this.trajectoryLine.material as THREE.Material).dispose();
      this.trajectoryLine = null;
    }

    const ball = this.balls.get(ballId);
    if (!ball) return;

    // 예측 계산
    let pred = prediction;
    if (!pred) {
      const transform = this.physics.getTransform(ball.body);
      const velocity = ball.body.getLinearVelocity();

      const startPos = new THREE.Vector3(
        transform.position.x(),
        transform.position.y(),
        transform.position.z()
      );
      const vel = new THREE.Vector3(velocity.x(), velocity.y(), velocity.z());

      pred = this.predictor.predict(startPos, vel, 3);
    }

    // 라인 생성 - 두껍게
    const points = pred.points.map((p) => p.position);
    this.trajectoryLine = createTrajectoryLine(points, 0x00ff88, 5);
    this.scene.add(this.trajectoryLine);
  }

  /**
   * 물리 업데이트 및 동기화
   */
  update(deltaTime: number): void {
    // 물리 스텝
    this.physics.step(deltaTime);

    // Three.js 동기화
    this.balls.forEach(({ body, mesh }) => {
      const transform = this.physics.getTransform(body);
      mesh.position.set(
        transform.position.x(),
        transform.position.y(),
        transform.position.z()
      );
      mesh.quaternion.set(
        transform.quaternion.x(),
        transform.quaternion.y(),
        transform.quaternion.z(),
        transform.quaternion.w()
      );
    });
  }

  /**
   * 공 상태 가져오기
   */
  getBallState(id: string): {
    position: THREE.Vector3;
    velocity: THREE.Vector3;
    isMoving: boolean;
  } | null {
    const ball = this.balls.get(id);
    if (!ball) return null;

    const transform = this.physics.getTransform(ball.body);
    const velocity = ball.body.getLinearVelocity();

    return {
      position: new THREE.Vector3(
        transform.position.x(),
        transform.position.y(),
        transform.position.z()
      ),
      velocity: new THREE.Vector3(velocity.x(), velocity.y(), velocity.z()),
      isMoving: velocity.length() > 0.01,
    };
  }

  /**
   * 모든 공이 멈췄는지 확인
   */
  areAllBallsStopped(): boolean {
    for (const { body } of this.balls.values()) {
      const velocity = body.getLinearVelocity();
      if (velocity.length() > 0.01) return false;
    }
    return true;
  }

  /**
   * 공 위치 리셋
   */
  resetBall(id: string, x: number, z: number): void {
    const ball = this.balls.get(id);
    if (!ball) return;

    const { BALL_RADIUS } = BilliardGame;
    const transform = new this.ammo.btTransform();
    transform.setIdentity();
    transform.setOrigin(new this.ammo.btVector3(x, BALL_RADIUS, z));

    ball.body.setWorldTransform(transform);
    ball.body.setLinearVelocity(new this.ammo.btVector3(0, 0, 0));
    ball.body.setAngularVelocity(new this.ammo.btVector3(0, 0, 0));
    ball.body.activate();
    
    // Three.js 위치도 즉시 업데이트
    ball.mesh.position.set(x, BALL_RADIUS, z);
  }

  /**
   * 물리 월드 접근자
   */
  getPhysics(): PhysicsWorld {
    return this.physics;
  }
}
