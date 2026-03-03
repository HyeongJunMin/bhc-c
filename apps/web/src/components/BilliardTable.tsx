import { useMemo, useRef, useCallback, forwardRef, useImperativeHandle } from 'react';
import { PHYSICS, COLORS } from '../lib/constants';
import * as THREE from 'three';

// 쿠션 ID 타입
type CushionId = 'top' | 'bottom' | 'left' | 'right';

// 개별 쿠션 컴포넌트 - deformation 애니메이션 지원
interface CushionMeshProps {
  id: CushionId;
  position: [number, number, number];
  size: [number, number, number];
  isHorizontal: boolean;
  cushionThickness: number;
}

const CushionMesh = forwardRef<{ triggerDeformation: (impactSpeed: number) => void }, CushionMeshProps>(
  ({ id, position, size, isHorizontal, cushionThickness }, ref) => {
    const meshRef = useRef<THREE.Mesh>(null);
    const noseRef = useRef<THREE.Mesh>(null);
    const deformationRef = useRef({
      active: false,
      currentDepth: 1, // 정상 상태 = 1 (100%)
      targetDepth: 1,
      velocity: 0,
      springStrength: 15, // 스프링 강도 (복원력)
      damping: 0.75, // 감쇠 (에너지 손실)
    });

    // 매 프레임 deformation 애니메이션 업데이트
    const updateDeformation = () => {
      const def = deformationRef.current;
      if (!def.active && Math.abs(def.currentDepth - 1) < 0.001) return;

      // 스프링 물리 시뮬레이션
      const displacement = def.currentDepth - def.targetDepth;
      const force = -def.springStrength * displacement;
      def.velocity += force * 0.016; // 60fps 기준
      def.velocity *= def.damping;
      def.currentDepth += def.velocity * 0.016;

      // 정상 상태에 가까워지면 종료
      if (Math.abs(def.currentDepth - 1) < 0.001 && Math.abs(def.velocity) < 0.01) {
        def.currentDepth = 1;
        def.active = false;
      }

      // 메시 스케일 적용
      if (meshRef.current) {
        if (isHorizontal) {
          // 상/하 쿠션: Z축으로 찌그러짐
          meshRef.current.scale.z = def.currentDepth;
        } else {
          // 좌/우 쿠션: X축으로 찌그러짐
          meshRef.current.scale.x = def.currentDepth;
        }
      }

      // 쿠션 날도 함께 변형
      if (noseRef.current) {
        if (isHorizontal) {
          noseRef.current.scale.z = def.currentDepth;
        } else {
          noseRef.current.scale.x = def.currentDepth;
        }
      }

      if (def.active || Math.abs(def.currentDepth - 1) > 0.001) {
        requestAnimationFrame(updateDeformation);
      }
    };

    // 외부에서 호출할 deformation 트리거 함수
    useImperativeHandle(ref, () => ({
      triggerDeformation: (impactSpeed: number) => {
        const def = deformationRef.current;
        
        // 속도에 따라 최대 찌그러짐 정도 계산
        // 최소 속도 1m/s → 5% 찌그러짐
        // 최대 속도 10m/s → 35% 찌그러짐
        const minSpeed = 1.0;
        const maxSpeed = 10.0;
        const minDeformation = 0.95; // 5% 찌그러짐
        const maxDeformation = 0.65; // 35% 찌그러짐
        
        const clampedSpeed = Math.max(minSpeed, Math.min(maxSpeed, impactSpeed));
        const t = (clampedSpeed - minSpeed) / (maxSpeed - minSpeed);
        const targetDeformation = minDeformation - t * (minDeformation - maxDeformation);
        
        def.targetDepth = targetDeformation;
        def.velocity = -0.1 - t * 0.2; // 속도가 높을수록 더 강한 충격
        def.active = true;
        
        requestAnimationFrame(updateDeformation);
      },
    }));

    // 쿠션 날 크기 계산
    const noseSize = useMemo(() => {
      if (isHorizontal) {
        return [size[0] - cushionThickness * 2, 0.015, cushionThickness * 0.8] as [number, number, number];
      } else {
        return [cushionThickness * 0.8, 0.015, size[2] - cushionThickness * 2] as [number, number, number];
      }
    }, [size, isHorizontal, cushionThickness]);

    return (
      <group>
        {/* 메인 쿠션 */}
        <mesh ref={meshRef} position={position} castShadow>
          <boxGeometry args={size} />
          <meshStandardMaterial color={COLORS.CUSHION} roughness={0.7} />
        </mesh>
        
        {/* 쿠션 날 */}
        <mesh 
          ref={noseRef} 
          position={[position[0], position[1] + 0.015, position[2]]} 
          castShadow
        >
          <boxGeometry args={noseSize} />
          <meshStandardMaterial color={COLORS.CUSHION} roughness={0.8} />
        </mesh>
      </group>
    );
  }
);

CushionMesh.displayName = 'CushionMesh';

// BilliardTable 메인 컴포넌트
export interface BilliardTableRef {
  triggerCushionDeformation: (cushionId: string, impactSpeed: number) => void;
}

export const BilliardTable = forwardRef<BilliardTableRef>((_, ref) => {
  const { TABLE_WIDTH, TABLE_HEIGHT, TABLE_OUTER_WIDTH, TABLE_OUTER_HEIGHT, CUSHION_HEIGHT, CUSHION_THICKNESS } = PHYSICS;
  
  // 쿠션 refs
  const cushionRefs = useRef<Record<CushionId, React.RefObject<{ triggerDeformation: (impactSpeed: number) => void }>>>({
    top: { current: null },
    bottom: { current: null },
    left: { current: null },
    right: { current: null },
  });

  // 쿠션 ID 매핑 (물리 엔진 ID → 컴포넌트 ID)
  const mapCushionId = useCallback((physicsId: string): CushionId => {
    switch (physicsId) {
      case 'top': return 'top';
      case 'bottom': return 'bottom';
      case 'left': return 'left';
      case 'right': return 'right';
      default: return 'top';
    }
  }, []);

  // 외부에서 쿠션 deformation 호출
  useImperativeHandle(ref, () => ({
    triggerCushionDeformation: (cushionId: string, impactSpeed: number) => {
      const mappedId = mapCushionId(cushionId);
      const cushionRef = cushionRefs.current[mappedId];
      if (cushionRef?.current) {
        cushionRef.current.triggerDeformation(impactSpeed);
      }
    },
  }));

  // 쿠션 설정
  const cushions = useMemo(() => {
    return [
      { id: 'top' as CushionId, pos: [0, CUSHION_HEIGHT / 2, -(TABLE_HEIGHT / 2 + CUSHION_THICKNESS / 2)], size: [TABLE_WIDTH, CUSHION_HEIGHT, CUSHION_THICKNESS], isHorizontal: true },
      { id: 'bottom' as CushionId, pos: [0, CUSHION_HEIGHT / 2, (TABLE_HEIGHT / 2 + CUSHION_THICKNESS / 2)], size: [TABLE_WIDTH, CUSHION_HEIGHT, CUSHION_THICKNESS], isHorizontal: true },
      { id: 'left' as CushionId, pos: [-(TABLE_WIDTH / 2 + CUSHION_THICKNESS / 2), CUSHION_HEIGHT / 2, 0], size: [CUSHION_THICKNESS, CUSHION_HEIGHT, TABLE_HEIGHT], isHorizontal: false },
      { id: 'right' as CushionId, pos: [(TABLE_WIDTH / 2 + CUSHION_THICKNESS / 2), CUSHION_HEIGHT / 2, 0], size: [CUSHION_THICKNESS, CUSHION_HEIGHT, TABLE_HEIGHT], isHorizontal: false },
    ];
  }, [TABLE_WIDTH, TABLE_HEIGHT, CUSHION_HEIGHT, CUSHION_THICKNESS]);

  // 다이 설정
  const rails = useMemo(() => {
    const railThickness = (TABLE_OUTER_WIDTH - TABLE_WIDTH) / 2;
    const railDepth = (TABLE_OUTER_HEIGHT - TABLE_HEIGHT) / 2;
    
    return {
      straight: [
        { pos: [0, CUSHION_HEIGHT / 2, -(TABLE_HEIGHT / 2 + railDepth / 2)], size: [TABLE_OUTER_WIDTH, CUSHION_HEIGHT, railDepth] },
        { pos: [0, CUSHION_HEIGHT / 2, (TABLE_HEIGHT / 2 + railDepth / 2)], size: [TABLE_OUTER_WIDTH, CUSHION_HEIGHT, railDepth] },
        { pos: [-(TABLE_WIDTH / 2 + railThickness / 2), CUSHION_HEIGHT / 2, 0], size: [railThickness, CUSHION_HEIGHT, TABLE_OUTER_HEIGHT] },
        { pos: [(TABLE_WIDTH / 2 + railThickness / 2), CUSHION_HEIGHT / 2, 0], size: [railThickness, CUSHION_HEIGHT, TABLE_OUTER_HEIGHT] },
      ],
      corners: [],
    };
  }, [TABLE_WIDTH, TABLE_HEIGHT, TABLE_OUTER_WIDTH, TABLE_OUTER_HEIGHT, CUSHION_HEIGHT]);

  // 다이아몬드 마커
  const diamondMarkers = useMemo(() => {
    const markers: { pos: [number, number, number]; rot: [number, number, number] }[] = [];
    const railThickness = (TABLE_OUTER_WIDTH - TABLE_WIDTH) / 2;
    const railDepth = (TABLE_OUTER_HEIGHT - TABLE_HEIGHT) / 2;
    
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      markers.push(
        { pos: [TABLE_WIDTH / 2 - t * TABLE_WIDTH, CUSHION_HEIGHT + 0.005, -TABLE_HEIGHT / 2 - railDepth / 2], rot: [-Math.PI / 2, 0, 0] },
        { pos: [-TABLE_WIDTH / 2 + t * TABLE_WIDTH, CUSHION_HEIGHT + 0.005, TABLE_HEIGHT / 2 + railDepth / 2], rot: [-Math.PI / 2, 0, 0] }
      );
    }
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      markers.push(
        { pos: [-TABLE_WIDTH / 2 - railThickness / 2, CUSHION_HEIGHT + 0.005, TABLE_HEIGHT / 2 - t * TABLE_HEIGHT], rot: [-Math.PI / 2, 0, 0] },
        { pos: [TABLE_WIDTH / 2 + railThickness / 2, CUSHION_HEIGHT + 0.005, -TABLE_HEIGHT / 2 + t * TABLE_HEIGHT], rot: [-Math.PI / 2, 0, 0] }
      );
    }
    return markers;
  }, []);

  return (
    <group>
      {/* 테이블 천 */}
      <mesh position={[0, 0.002, 0]} receiveShadow>
        <boxGeometry args={[TABLE_WIDTH, 0.004, TABLE_HEIGHT]} />
        <meshStandardMaterial color={COLORS.TABLE_CLOTH} roughness={1.0} metalness={0} />
      </mesh>

      {/* 천 질감 레이어 */}
      <mesh position={[0, 0.004, 0]} receiveShadow>
        <boxGeometry args={[TABLE_WIDTH - 0.01, 0.001, TABLE_HEIGHT - 0.01]} />
        <meshStandardMaterial color={COLORS.TABLE_CLOTH} roughness={1} metalness={0} transparent opacity={0.4} />
      </mesh>

      {/* 4개 직선 다이 */}
      {rails.straight.map((rail, idx) => (
        <mesh key={`rail-${idx}`} position={rail.pos as [number, number, number]} castShadow>
          <boxGeometry args={rail.size as [number, number, number]} />
          <meshStandardMaterial color={COLORS.TABLE_RAIL} roughness={0.6} />
        </mesh>
      ))}

      {/* 쿠션 - 개별 컴포넌트로 deformation 지원 */}
      {cushions.map((cushion) => (
        <CushionMesh
          key={cushion.id}
          ref={cushionRefs.current[cushion.id]}
          id={cushion.id}
          position={cushion.pos as [number, number, number]}
          size={cushion.size as [number, number, number]}
          isHorizontal={cushion.isHorizontal}
          cushionThickness={CUSHION_THICKNESS}
        />
      ))}

      {/* 다이아몬드 마커 */}
      {diamondMarkers.map((marker, idx) => (
        <mesh key={idx} position={marker.pos} rotation={marker.rot}>
          <circleGeometry args={[0.006, 6]} />
          <meshBasicMaterial color={0xffffff} opacity={0.6} transparent />
        </mesh>
      ))}

      {/* 포켓 */}
      {[
        [-TABLE_WIDTH/2, -TABLE_HEIGHT/2],
        [TABLE_WIDTH/2, -TABLE_HEIGHT/2],
        [-TABLE_WIDTH/2, TABLE_HEIGHT/2],
        [TABLE_WIDTH/2, TABLE_HEIGHT/2],
      ].map(([x, z], idx) => (
        <mesh key={`pocket-${idx}`} position={[x, -0.02, z]}>
          <cylinderGeometry args={[0.05, 0.04, 0.04, 16]} />
          <meshStandardMaterial color={0x1a1a1a} />
        </mesh>
      ))}
    </group>
  );
});

BilliardTable.displayName = 'BilliardTable';
