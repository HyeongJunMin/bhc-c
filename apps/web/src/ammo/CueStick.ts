import * as THREE from 'three';

/**
 * 큐 스틱 시각화
 * - 수구 주변을 360도 회전
 * - 상하 고각 조절
 * - 드래그 거리에 따른 파워 시각화
 */
export class CueStick {
  private mesh: THREE.Group;
  private scene: THREE.Scene;
  private visible: boolean = true;
  
  // 큐 스펙
  private readonly CUE_LENGTH = 1.5; // 1.5m
  private readonly CUE_RADIUS = 0.012; // 12mm
  private readonly TIP_LENGTH = 0.02;
  private readonly IMPACT_FACE_OFFSET = 0.031;
  
  constructor(scene: THREE.Scene) {
    this.scene = scene;
    this.mesh = new THREE.Group();
    this.createCueMesh();
    this.scene.add(this.mesh);
  }
  
  private createCueMesh(): void {
    // 큐 본체 (나무 색상)
    const shaftGeometry = new THREE.CylinderGeometry(
      this.CUE_RADIUS * 0.6, // 팁 쪽
      this.CUE_RADIUS * 1.2, // 뒤쪽
      this.CUE_LENGTH,
      16
    );
    const shaftMaterial = new THREE.MeshStandardMaterial({
      color: 0xd4a574, // 나무색
      roughness: 0.4,
      metalness: 0.1,
    });
    const shaft = new THREE.Mesh(shaftGeometry, shaftMaterial);
    shaft.rotation.x = Math.PI / 2; // 수평으로
    shaft.position.z = -this.CUE_LENGTH / 2 - 0.05; // 수구에서 약간 떨어진 위치
    shaft.castShadow = true;
    this.mesh.add(shaft);
    
    // 팁 (진한 갈색)
    const tipGeometry = new THREE.CylinderGeometry(
      this.CUE_RADIUS * 0.55,
      this.CUE_RADIUS * 0.6,
      this.TIP_LENGTH,
      16
    );
    const tipMaterial = new THREE.MeshStandardMaterial({
      color: 0x4a3728,
      roughness: 0.8,
    });
    const tip = new THREE.Mesh(tipGeometry, tipMaterial);
    tip.rotation.x = Math.PI / 2;
    tip.position.z = -0.05 + this.TIP_LENGTH / 2;
    this.mesh.add(tip);
    
    // 뒤쪽 그립 (어두운 색)
    const buttGeometry = new THREE.CylinderGeometry(
      this.CUE_RADIUS * 1.2,
      this.CUE_RADIUS * 1.4,
      0.4,
      16
    );
    const buttMaterial = new THREE.MeshStandardMaterial({
      color: 0x2d2416,
      roughness: 0.6,
    });
    const butt = new THREE.Mesh(buttGeometry, buttMaterial);
    butt.rotation.x = Math.PI / 2;
    butt.position.z = -this.CUE_LENGTH + 0.2;
    butt.castShadow = true;
    this.mesh.add(butt);
    
    // 파워 게이지 (드래그 중일 때 표시)
    this.createPowerGauge();
  }
  
  private createPowerGauge(): void {
    const gaugeGroup = new THREE.Group();
    gaugeGroup.name = 'powerGauge';
    
    // 게이지 배경
    const bgGeometry = new THREE.PlaneGeometry(0.3, 0.04);
    const bgMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x333333,
      transparent: true,
      opacity: 0.8,
    });
    const bg = new THREE.Mesh(bgGeometry, bgMaterial);
    bg.position.set(0, 0.15, -0.3);
    bg.rotation.x = -Math.PI / 4;
    gaugeGroup.add(bg);
    
    // 게이지 채움
    const fillGeometry = new THREE.PlaneGeometry(0.28, 0.03);
    const fillMaterial = new THREE.MeshBasicMaterial({ 
      color: 0x00ff88,
      transparent: true,
      opacity: 0.9,
    });
    const fill = new THREE.Mesh(fillGeometry, fillMaterial);
    fill.name = 'powerFill';
    fill.position.set(-0.14, 0.15, -0.29);
    fill.rotation.x = -Math.PI / 4;
    fill.geometry.translate(0.14, 0, 0); // 왼쪽 정렬
    gaugeGroup.add(fill);
    
    gaugeGroup.visible = false;
    this.mesh.add(gaugeGroup);
  }
  
  /**
   * 큐 위치 업데이트
   * @param cueBallPos 수구 위치
   * @param directionDeg 수평 방향 (도)
   * @param elevationDeg 고각 (도)
   * @param impactOffsetX 좌우 당점 오프셋 (m)
   * @param impactOffsetY 상하 당점 오프셋 (m)
   * @param dragPx 드래그 거리 (파워)
   * @param isDragging 드래그 중 여부
   */
  update(
    cueBallPos: THREE.Vector3,
    directionDeg: number,
    elevationDeg: number,
    impactOffsetX: number,
    impactOffsetY: number,
    dragPx: number,
    isDragging: boolean
  ): void {
    if (!this.visible) return;
    
    // 라디안 변환
    const directionRad = (directionDeg * Math.PI) / 180;
    const elevationRad = (elevationDeg * Math.PI) / 180;

    // 큐 회전 기준(당점/큐 축 동기화용)
    const cueEuler = new THREE.Euler(-elevationRad, directionRad, 0, 'YXZ');
    const cueQuat = new THREE.Quaternion().setFromEuler(cueEuler);
    
    // 큐 위치 계산: 당점(수구 타격면) 기준으로 큐 축을 이동
    const localImpactOffset = new THREE.Vector3(impactOffsetX, impactOffsetY, 0);
    const worldImpactOffset = localImpactOffset.applyQuaternion(cueQuat);
    const cueAxisForward = new THREE.Vector3(0, 0, 1).applyQuaternion(cueQuat);
    this.mesh.position
      .copy(cueBallPos)
      .add(worldImpactOffset)
      .addScaledVector(cueAxisForward, -this.IMPACT_FACE_OFFSET);
    
    // 회전 적용
    this.mesh.rotation.y = directionRad;
    this.mesh.rotation.x = -elevationRad;
    
    // 드래그 시 큐 뒤로 당기기 (스트로크 준비 자세)
    const pullBackDistance = isDragging ? Math.min((dragPx - 10) / 400 * 0.3, 0.3) : 0;
    this.mesh.position.z -= pullBackDistance * Math.cos(directionRad);
    this.mesh.position.x -= pullBackDistance * Math.sin(directionRad);
    
    // 파워 게이지 업데이트
    const gauge = this.mesh.getObjectByName('powerGauge') as THREE.Group;
    if (gauge) {
      gauge.visible = isDragging;
      
      const fill = gauge.getObjectByName('powerFill') as THREE.Mesh;
      if (fill) {
        const powerRatio = Math.min((dragPx - 10) / 390, 1);
        fill.scale.x = powerRatio;
        
        // 파워에 따른 색상 변화
        const material = fill.material as THREE.MeshBasicMaterial;
        if (powerRatio < 0.3) {
          material.color.setHex(0x00ff88); // 초록
        } else if (powerRatio < 0.7) {
          material.color.setHex(0xffff00); // 노랑
        } else {
          material.color.setHex(0xff4444); // 빨강
        }
      }
    }
  }
  
  setVisible(visible: boolean): void {
    this.visible = visible;
    this.mesh.visible = visible;
  }
  
  /**
   * 샷 애니메이션
   * @param duration 애니메이션 지속 시간 (ms)
   */
  animateShot(duration: number = 200): Promise<void> {
    return new Promise((resolve) => {
      const startZ = this.mesh.position.z;
      const startX = this.mesh.position.x;
      const startTime = Date.now();
      
      const animate = () => {
        const elapsed = Date.now() - startTime;
        const progress = Math.min(elapsed / duration, 1);
        
        // 앞으로 나아가는 모션
        const forwardDistance = 0.1 * Math.sin(progress * Math.PI);
        this.mesh.position.z = startZ + forwardDistance;
        this.mesh.position.x = startX + forwardDistance;
        
        if (progress < 1) {
          requestAnimationFrame(animate);
        } else {
          // 원래 위치로
          this.mesh.position.z = startZ;
          this.mesh.position.x = startX;
          resolve();
        }
      };
      
      animate();
    });
  }
  
  dispose(): void {
    this.scene.remove(this.mesh);
    this.mesh.traverse((child) => {
      if (child instanceof THREE.Mesh) {
        child.geometry.dispose();
        if (Array.isArray(child.material)) {
          child.material.forEach(m => m.dispose());
        } else {
          child.material.dispose();
        }
      }
    });
  }
}
