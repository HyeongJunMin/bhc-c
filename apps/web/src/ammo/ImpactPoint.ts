import * as THREE from 'three';

/**
 * 당점 시각화
 * - 수구 위에 반투명 원으로 표시
 * - WASD로 당점 이동 시 실시간 업데이트
 * - 미스큐 위험 경고
 */
export class ImpactPoint {
  private mesh: THREE.Group;
  private scene: THREE.Scene;
  private cueBallRadius: number;
  
  // 당점 마커
  private marker!: THREE.Mesh;
  private warningRing!: THREE.Mesh;
  private guideLines!: THREE.Group;
  
  constructor(scene: THREE.Scene, ballRadius: number) {
    this.scene = scene;
    this.cueBallRadius = ballRadius;
    this.mesh = new THREE.Group();
    this.createVisuals();
    this.scene.add(this.mesh);
  }
  
  private createVisuals(): void {
    // 1. 중앙 가이드 원 (수구 위에 투명하게)
    const guideGeometry = new THREE.RingGeometry(
      this.cueBallRadius * 0.1,
      this.cueBallRadius * 0.95,
      32
    );
    const guideMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.15,
      side: THREE.DoubleSide,
    });
    const guide = new THREE.Mesh(guideGeometry, guideMaterial);
    guide.rotation.x = -Math.PI / 2;
    guide.position.y = this.cueBallRadius + 0.001;
    this.mesh.add(guide);
    
    // 2. 십자가 가이드 라인
    this.guideLines = new THREE.Group();
    const lineMaterial = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.2,
    });
    
    // 수평선
    const hLine = new THREE.Mesh(
      new THREE.PlaneGeometry(this.cueBallRadius * 2, 0.005),
      lineMaterial
    );
    hLine.rotation.x = -Math.PI / 2;
    hLine.position.y = this.cueBallRadius + 0.002;
    this.guideLines.add(hLine);
    
    // 수직선
    const vLine = new THREE.Mesh(
      new THREE.PlaneGeometry(0.005, this.cueBallRadius * 2),
      lineMaterial
    );
    vLine.rotation.x = -Math.PI / 2;
    vLine.position.y = this.cueBallRadius + 0.002;
    this.guideLines.add(vLine);
    
    this.mesh.add(this.guideLines);
    
    // 3. 당점 마커 (빨간 점)
    const markerGeometry = new THREE.CircleGeometry(0.008, 16);
    const markerMaterial = new THREE.MeshBasicMaterial({
      color: 0xff3333,
      transparent: true,
      opacity: 0.9,
    });
    this.marker = new THREE.Mesh(markerGeometry, markerMaterial);
    this.marker.rotation.x = -Math.PI / 2;
    this.marker.position.y = this.cueBallRadius + 0.003;
    this.mesh.add(this.marker);
    
    // 4. 미스큐 경고 링
    const warningGeometry = new THREE.RingGeometry(
      this.cueBallRadius * 0.9,
      this.cueBallRadius * 0.95,
      32
    );
    const warningMaterial = new THREE.MeshBasicMaterial({
      color: 0xff0000,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
    });
    this.warningRing = new THREE.Mesh(warningGeometry, warningMaterial);
    this.warningRing.rotation.x = -Math.PI / 2;
    this.warningRing.position.y = this.cueBallRadius + 0.002;
    this.mesh.add(this.warningRing);
    
    // 5. 미스큐 임계치 표시 (점선 느낌의 링)
    const thresholdGeometry = new THREE.RingGeometry(
      this.cueBallRadius * 0.88,
      this.cueBallRadius * 0.9,
      32,
      0,
      Math.PI * 2
    );
    const thresholdMaterial = new THREE.MeshBasicMaterial({
      color: 0xffaa00,
      transparent: true,
      opacity: 0.3,
      side: THREE.DoubleSide,
    });
    const threshold = new THREE.Mesh(thresholdGeometry, thresholdMaterial);
    threshold.rotation.x = -Math.PI / 2;
    threshold.position.y = this.cueBallRadius + 0.0015;
    this.mesh.add(threshold);
  }
  
  /**
   * 당점 업데이트
   * @param offsetX 좌우 오프셋 (-R ~ +R)
   * @param offsetY 상하 오프셋 (-R ~ +R)
   * @param cueBallPos 수구 위치
   */
  update(
    offsetX: number,
    offsetY: number,
    cueBallPos: THREE.Vector3
  ): void {
    // 위치 업데이트
    this.mesh.position.copy(cueBallPos);
    
    // 당점 마커 위치
    this.marker.position.x = offsetX;
    this.marker.position.z = -offsetY; // Y가 상하인데 Z가 전후
    
    // 미스큐 위험 체크
    const offsetDistance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    const dangerRatio = offsetDistance / (this.cueBallRadius * 0.9);
    
    const warningMat = this.warningRing.material as THREE.MeshBasicMaterial;
    const markerMat = this.marker.material as THREE.MeshBasicMaterial;
    
    if (dangerRatio > 0.8) {
      // 경고 표시
      warningMat.opacity = Math.min((dangerRatio - 0.8) * 5, 0.8);
      
      // 당점 색상 변경
      if (dangerRatio >= 1.0) {
        markerMat.color.setHex(0xff0000);
      } else {
        markerMat.color.setHex(0xffaa00);
      }
    } else {
      warningMat.opacity = 0;
      markerMat.color.setHex(0xff3333);
    }
  }
  
  /**
   * 미스큐 체크
   * @returns 미스큐 여부
   */
  checkMiscue(offsetX: number, offsetY: number): boolean {
    const offsetDistance = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    return offsetDistance > this.cueBallRadius * 0.9;
  }
  
  setVisible(visible: boolean): void {
    this.mesh.visible = visible;
  }
  
  /**
   * 당점 정보 텍스트 생성
   */
  getImpactDescription(offsetX: number, offsetY: number): string {
    const dist = Math.sqrt(offsetX * offsetX + offsetY * offsetY);
    const maxDist = this.cueBallRadius;
    const percent = Math.round((dist / maxDist) * 100);
    
    if (dist > maxDist * 0.9) return '⚠️ MISCUE WARNING!';
    
    let desc = '';
    
    // 상하
    if (offsetY > 0.01) desc += 'Top ';
    else if (offsetY < -0.01) desc += 'Bottom ';
    else desc += 'Center ';
    
    // 좌우
    if (offsetX < -0.01) desc += 'Left';
    else if (offsetX > 0.01) desc += 'Right';
    else if (desc === 'Center ') desc += 'Hit';
    
    return `${desc} (${percent}%)`;
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
