import * as THREE from 'three';
import type Ammo from 'ammo.js';

/**
 * 3쿠션 당구 시스템 통합 모듈
 * 
 * 지원 시스템:
 * 1. 하프 시스템 (Half System)
 * 2. 파이브 앤 하프 (Five & Half System)  
 * 3. 플러스 투 (Plus Two System)
 * 
 * 테이블 규격: 대대 (284cm x 142cm)
 * Three.js Unit: 28.4 x 14.2 (1cm = 0.1 unit)
 */

// ============================================================================
// 1. 좌표 매핑 데이터 구조
// ============================================================================

export interface TableSpecs {
  readonly width: number;      // 28.4 (284cm)
  readonly height: number;     // 14.2 (142cm)
  readonly cushionHeight: number;
  readonly ballRadius: number;
}

export const TABLE_SPECS: TableSpecs = {
  width: 28.4,
  height: 14.2,
  cushionHeight: 0.37,
  ballRadius: 0.3075,
};

/**
 * 시스템별 포인트 매핑 데이터
 */
export const CAROM_SYSTEMS = {
  // 하프 시스템: 수구 포인트 0-50 (장축 기준)
  half: {
    name: 'Half System',
    description: '1쿠션 = 수구 / 2',
    cueBallRange: { min: 0, max: 50 },
    firstCushionRange: { min: 0, max: 50 },
    thirdCushionRange: { min: 0, max: 50 },
    // 주요 다이아몬드 포인트
    keyPoints: {
      corner: 0,      // 코너
      diamond20: 10,  // 20 다이아몬드 (하프 기준 20)
      diamond40: 20,  // 40 다이아몬드
      center: 25,     // 중앙
      diamond60: 30,  // 60 다이아몬드
      diamond80: 40,  // 80 다이아몬드
      oppositeCorner: 50, // 반대 코너
    },
  },

  // 파이브 앤 하프: 수구 15-100, 1쿠션/3쿠션 0-100
  fiveAndHalf: {
    name: 'Five & Half System',
    description: '1쿠션 = 수구 - 3쿠션',
    cueBallRange: { min: 15, max: 100 },
    firstCushionRange: { min: 0, max: 100 },
    thirdCushionRange: { min: 0, max: 100 },
    formula: (cueBall: number, thirdCushion: number) => cueBall - thirdCushion,
    keyPoints: {
      corner: 0,
      diamond15: 15,
      diamond20: 20,
      diamond25: 25,
      diamond30: 30,
      diamond35: 35,
      diamond40: 40,
      diamond45: 45,
      center: 50,
      diamond55: 55,
      diamond60: 60,
      diamond70: 70,
      diamond80: 80,
      diamond90: 90,
      oppositeCorner: 100,
    },
  },

  // 플러스 투: 단축 + 장축 = 단축
  plusTwo: {
    name: 'Plus Two System',
    description: '단축 + 장축 = 단축 (뱅크샷)',
    shortRailRange: { min: 0, max: 50 },  // 단축 (0-50)
    longRailRange: { min: 0, max: 100 },  // 장축 (0-100)
    formula: (shortRail: number, longRail: number) => {
      // 결과가 50을 넘으면 반대쪽 단축으로 계산
      const result = shortRail + longRail;
      return result > 50 ? 100 - result : result;
    },
    keyPoints: {
      shortCorner: 0,
      short20: 10,
      short40: 20,
      shortCenter: 25,
      short60: 30,
      short80: 40,
      shortOpposite: 50,
    },
  },
};

// ============================================================================
// 2. 좌표 변환 함수
// ============================================================================

/**
 * 시스템 포인트를 Three.js Vector3로 변환
 * 
 * @param systemName 시스템 이름 ('half', 'fiveAndHalf', 'plusTwo')
 * @param pointValue 포인트 값
 * @param railType 레일 타입 ('long' | 'short')
 * @param isTopRail 상단 레일 여부 (기본값: 하단)
 */
export function getVectorFromPoint(
  systemName: keyof typeof CAROM_SYSTEMS,
  pointValue: number,
  railType: 'long' | 'short' = 'long',
  isTopRail: boolean = false
): THREE.Vector3 {
  const { width, height } = TABLE_SPECS;

  switch (systemName) {
    case 'half':
    case 'fiveAndHalf': {
      // 장축(Long Rail) 기준: 0-50 또는 0-100
      // 좌측 하단 코너 (0, 0, 0) 기준
      const maxPoint = systemName === 'half' ? 50 : 100;
      const normalizedPoint = Math.max(0, Math.min(maxPoint, pointValue)) / maxPoint;
      
      if (railType === 'long') {
        // 장축: X축 방향
        const x = normalizedPoint * width;
        const z = isTopRail ? 0 : height;
        return new THREE.Vector3(x, TABLE_SPECS.ballRadius, z);
      } else {
        // 단축: Z축 방향
        const z = normalizedPoint * height;
        const x = isTopRail ? width : 0;
        return new THREE.Vector3(x, TABLE_SPECS.ballRadius, z);
      }
    }

    case 'plusTwo': {
      // 플러스 투: 단축 또는 장축
      if (railType === 'short') {
        // 단축: 0-50
        const normalized = Math.max(0, Math.min(50, pointValue)) / 50;
        const z = normalized * height;
        const x = isTopRail ? width / 2 : 0; // 중앙 또는 코너
        return new THREE.Vector3(x, TABLE_SPECS.ballRadius, z);
      } else {
        // 장축
        const normalized = Math.max(0, Math.min(100, pointValue)) / 100;
        const x = normalized * width;
        const z = isTopRail ? 0 : height;
        return new THREE.Vector3(x, TABLE_SPECS.ballRadius, z);
      }
    }

    default:
      return new THREE.Vector3(0, TABLE_SPECS.ballRadius, 0);
  }
}

/**
 * Vector3를 시스템 포인트로 역변환
 */
export function getPointFromVector(
  position: THREE.Vector3,
  systemName: keyof typeof CAROM_SYSTEMS,
  railType: 'long' | 'short' = 'long'
): number {
  const { width, height } = TABLE_SPECS;

  switch (systemName) {
    case 'half': {
      if (railType === 'long') {
        return Math.round((position.x / width) * 50 * 10) / 10;
      } else {
        return Math.round((position.z / height) * 50 * 10) / 10;
      }
    }
    case 'fiveAndHalf': {
      if (railType === 'long') {
        return Math.round((position.x / width) * 100 * 10) / 10;
      } else {
        return Math.round((position.z / height) * 50 * 10) / 10;
      }
    }
    case 'plusTwo': {
      if (railType === 'short') {
        return Math.round((position.z / height) * 50 * 10) / 10;
      } else {
        return Math.round((position.x / width) * 100 * 10) / 10;
      }
    }
    default:
      return 0;
  }
}

// ============================================================================
// 3. 보정값 테이블 (대대 특성)
// ============================================================================

/**
 * 대대(Match Table) 특성 보정값
 * 30포인트 이상에서 공이 짧아지는 현상 반영
 */
export const MATCH_TABLE_COMPENSATION = {
  // 수구 위치별 보정값 (포인트)
  cueBallCompensation: [
    { range: [0, 20], value: 0 },      // 0-20: 보정 없음
    { range: [20, 30], value: -0.5 },  // 20-30: 0.5 짧게
    { range: [30, 40], value: -1.0 },  // 30-40: 1.0 짧게 (대대 특성)
    { range: [40, 50], value: -1.5 },  // 40-50: 1.5 짧게
  ],
  
  // 1쿠션 위치별 보정 (롱 레일)
  firstCushionCompensation: [
    { range: [0, 25], value: 0 },
    { range: [25, 40], value: -0.3 },
    { range: [40, 50], value: -0.5 },
  ],

  // 테이블 상태별 추가 보정
  tableCondition: {
    tight: -1.0,      // 빡빡함: 더 짧게
    normal: 0,        // 보통
    slippery: 1.5,    // 미끄러움: 길게
  },
};

/**
 * 보정값 계산
 */
export function calculateCompensation(
  cueBallPoint: number,
  firstCushionPoint: number,
  tableCondition: 'tight' | 'normal' | 'slippery' = 'normal'
): number {
  let compensation = 0;

  // 수구 위치 보정
  for (const comp of MATCH_TABLE_COMPENSATION.cueBallCompensation) {
    if (cueBallPoint >= comp.range[0] && cueBallPoint < comp.range[1]) {
      compensation += comp.value;
      break;
    }
  }

  // 1쿠션 위치 보정
  for (const comp of MATCH_TABLE_COMPENSATION.firstCushionCompensation) {
    if (firstCushionPoint >= comp.range[0] && firstCushionPoint < comp.range[1]) {
      compensation += comp.value;
      break;
    }
  }

  // 테이블 상태 보정
  compensation += MATCH_TABLE_COMPENSATION.tableCondition[tableCondition];

  return compensation;
}

// ============================================================================
// 4. Ef-2 회전 각속도 계산
// ============================================================================

/**
 * Ef-2 (2팁) 회전의 Ammo.js 각속도 계산
 * 
 * @param direction 샷 방향 (정규화된 벡터)
 * @param tipOffset 당점 오프셋 (-1 ~ 1, 음수: 상단)
 * @param power 힘 (0-100)
 * @returns Ammo.js btVector3 형태의 각속도
 */
import type AmmoType from 'ammo.js';

export function calculateEf2AngularVelocity(
  ammo: typeof AmmoType,
  direction: THREE.Vector3,
  tipOffset: number,
  power: number
): AmmoType.btVector3 {
  const ballRadius = 0.615;
  const mass = 0.21;
  
  // 관성모멘트 I = 2/5 * m * R²
  const inertia = (2 / 5) * mass * ballRadius * ballRadius;
  
  // 토크 = 힘 x 거리
  const force = (power / 100) * 50; // 최대 50N
  const torque = force * Math.abs(tipOffset) * ballRadius;
  
  // 각속도 = 토크 / 관성모멘트
  const angularVelocityMagnitude = torque / inertia;
  
  // 회전 축 계산
  // 상단/하단 스핀은 샷 방향의 수직축 기준
  const spinAxis = new THREE.Vector3(-direction.z, 0, direction.x).normalize();
  
  // 방향에 따른 부호
  const sign = tipOffset < 0 ? 1 : -1; // 상단: +, 하단: -
  
  return new ammo.btVector3(
    spinAxis.x * angularVelocityMagnitude * sign,
    0,
    spinAxis.z * angularVelocityMagnitude * sign
  );
}

// ============================================================================
// 5. 궤적 계산 클래스
// ============================================================================

export interface TrajectoryPoint {
  position: THREE.Vector3;
  type: 'cue' | 'cushion1' | 'cushion2' | 'cushion3' | 'target';
  point?: number; // 시스템 포인트 값
}

export class CaromTrajectoryCalculator {
  /**
   * 하프 시스템 궤적 계산
   * 
   * 공식: 1쿠션 = 수구 / 2
   */
  static calculateHalf(
    cueBallPoint: number,
    tableCondition: 'tight' | 'normal' | 'slippery' = 'normal'
  ): TrajectoryPoint[] {
    const points: TrajectoryPoint[] = [];
    
    // 1. 수구 위치
    const cueBallPos = getVectorFromPoint('half', cueBallPoint, 'long', false);
    points.push({ position: cueBallPos, type: 'cue', point: cueBallPoint });
    
    // 2. 1쿠션 계산 (하프)
    let firstCushionPoint = cueBallPoint / 2;
    
    // 보정 적용
    const compensation = calculateCompensation(cueBallPoint, firstCushionPoint, tableCondition);
    firstCushionPoint += compensation;
    firstCushionPoint = Math.max(0, Math.min(50, firstCushionPoint));
    
    const firstCushionPos = getVectorFromPoint('half', firstCushionPoint, 'long', true);
    points.push({ position: firstCushionPos, type: 'cushion1', point: firstCushionPoint });
    
    // 3. 2쿠션 (단축)
    // 1쿠션 각도에 따른 2쿠션 위치 추정
    const secondCushionPoint = 50 - firstCushionPoint; // 대칭
    const secondCushionPos = getVectorFromPoint('half', secondCushionPoint, 'short', true);
    points.push({ position: secondCushionPos, type: 'cushion2', point: secondCushionPoint });
    
    // 4. 3쿠션
    const thirdCushionPoint = cueBallPoint; // 하프 시스템에서 3쿠션 = 수구
    const thirdCushionPos = getVectorFromPoint('half', thirdCushionPoint, 'long', false);
    points.push({ position: thirdCushionPos, type: 'cushion3', point: thirdCushionPoint });
    
    return points;
  }

  /**
   * 파이브 앤 하프 궤적 계산
   * 
   * 공식: 1쿠션 = 수구 - 3쿠션
   */
  static calculateFiveAndHalf(
    cueBallPoint: number,
    thirdCushionPoint: number,
    tableCondition: 'tight' | 'normal' | 'slippery' = 'normal'
  ): TrajectoryPoint[] {
    const points: TrajectoryPoint[] = [];
    
    // 1. 수구 위치
    const cueBallPos = getVectorFromPoint('fiveAndHalf', cueBallPoint, 'long', false);
    points.push({ position: cueBallPos, type: 'cue', point: cueBallPoint });
    
    // 2. 1쿠션 계산
    let firstCushionPoint = cueBallPoint - thirdCushionPoint;
    
    // 보정 적용
    const compensation = calculateCompensation(cueBallPoint, firstCushionPoint, tableCondition);
    firstCushionPoint += compensation;
    firstCushionPoint = Math.max(0, Math.min(100, firstCushionPoint));
    
    const firstCushionPos = getVectorFromPoint('fiveAndHalf', firstCushionPoint, 'long', true);
    points.push({ position: firstCushionPos, type: 'cushion1', point: firstCushionPoint });
    
    // 3. 2쿠션 (단축)
    // 수구와 1쿠션의 비율로 2쿠션 추정
    const ratio = firstCushionPoint / cueBallPoint;
    const secondCushionPoint = 50 * ratio;
    const secondCushionPos = getVectorFromPoint('fiveAndHalf', secondCushionPoint, 'short', true);
    points.push({ position: secondCushionPos, type: 'cushion2', point: secondCushionPoint });
    
    // 4. 3쿠션
    const thirdCushionPos = getVectorFromPoint('fiveAndHalf', thirdCushionPoint, 'long', false);
    points.push({ position: thirdCushionPos, type: 'cushion3', point: thirdCushionPoint });
    
    return points;
  }

  /**
   * 플러스 투 궤적 계산
   * 
   * 공식: 단축 + 장축 = 단축 (뱅크샷)
   */
  static calculatePlusTwo(
    shortRailPoint: number,  // 수구 단축 위치
    longRailPoint: number,   // 1쿠션 장축 위치
    tableCondition: 'tight' | 'normal' | 'slippery' = 'normal'
  ): TrajectoryPoint[] {
    const points: TrajectoryPoint[] = [];
    
    // 1. 수구 위치 (단축)
    const cueBallPos = getVectorFromPoint('plusTwo', shortRailPoint, 'short', false);
    points.push({ position: cueBallPos, type: 'cue', point: shortRailPoint });
    
    // 2. 1쿠션 (장축)
    let firstCushionPoint = longRailPoint;
    
    // 뱅크샷 보정 (단축 출발은 짧아지는 경향)
    const compensation = tableCondition === 'tight' ? -1.5 : 
                         tableCondition === 'slippery' ? 1.0 : -0.5;
    firstCushionPoint += compensation;
    
    const firstCushionPos = getVectorFromPoint('plusTwo', firstCushionPoint, 'long', true);
    points.push({ position: firstCushionPos, type: 'cushion1', point: firstCushionPoint });
    
    // 3. 2쿠션 (단축)
    // 플러스 투 공식: 결과 단축 = (단축 + 장축) % 50
    let resultShort = shortRailPoint + longRailPoint;
    if (resultShort > 50) {
      resultShort = 100 - resultShort; // 반대쪽 단축
    }
    
    const secondCushionPos = getVectorFromPoint('plusTwo', resultShort, 'short', false);
    points.push({ position: secondCushionPos, type: 'cushion2', point: resultShort });
    
    // 4. 3쿠션 (장축)
    // 1쿠션과 대칭
    const thirdCushionPoint = 100 - firstCushionPoint;
    const thirdCushionPos = getVectorFromPoint('plusTwo', thirdCushionPoint, 'long', true);
    points.push({ position: thirdCushionPos, type: 'cushion3', point: thirdCushionPoint });
    
    return points;
  }
}

// ============================================================================
// 6. 플러스 투 실시간 업데이트
// ============================================================================

export class PlusTwoPathUpdater {
  private currentTrajectory: TrajectoryPoint[] = [];
  private lineMesh: THREE.Line | null = null;
  private scene: THREE.Scene;

  constructor(scene: THREE.Scene) {
    this.scene = scene;
  }

  /**
   * 플러스 투 경로 실시간 업데이트
   * 
   * @param shortRailPoint 수구 단축 위치
   * @param longRailPoint 1쿠션 장축 위치 (터치로 변경)
   * @param tableCondition 테이블 상태
   */
  updatePlusTwoPath(
    shortRailPoint: number,
    longRailPoint: number,
    tableCondition: 'tight' | 'normal' | 'slippery' = 'normal'
  ): TrajectoryPoint[] {
    // 기존 라인 제거
    if (this.lineMesh) {
      this.scene.remove(this.lineMesh);
      this.lineMesh.geometry.dispose();
      (this.lineMesh.material as THREE.Material).dispose();
    }

    // 새 궤적 계산
    this.currentTrajectory = CaromTrajectoryCalculator.calculatePlusTwo(
      shortRailPoint,
      longRailPoint,
      tableCondition
    );

    // 라인 생성
    const points = this.currentTrajectory.map((p) => p.position);
    const geometry = new THREE.BufferGeometry().setFromPoints(points);
    const material = new THREE.LineBasicMaterial({
      color: 0x00ffff, // 플러스 투는 시안색으로 표시
      linewidth: 3,
      transparent: true,
      opacity: 0.8,
    });

    this.lineMesh = new THREE.Line(geometry, material);
    this.scene.add(this.lineMesh);

    return this.currentTrajectory;
  }

  /**
   * 현재 궤적 반환
   */
  getCurrentTrajectory(): TrajectoryPoint[] {
    return this.currentTrajectory;
  }

  /**
   * 리소스 정리
   */
  dispose(): void {
    if (this.lineMesh) {
      this.scene.remove(this.lineMesh);
      this.lineMesh.geometry.dispose();
      (this.lineMesh.material as THREE.Material).dispose();
    }
  }
}

// ============================================================================
// Export
// ============================================================================

export default {
  TABLE_SPECS,
  CAROM_SYSTEMS,
  getVectorFromPoint,
  getPointFromVector,
  MATCH_TABLE_COMPENSATION,
  calculateCompensation,
  calculateEf2AngularVelocity,
  CaromTrajectoryCalculator,
  PlusTwoPathUpdater,
};
