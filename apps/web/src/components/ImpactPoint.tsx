import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Vector3, Group, Mesh } from 'three';
import { PHYSICS, COLORS } from '../lib/constants';
import { useGameStore } from '../hooks/useGameStore';

interface ImpactPointProps {
  ballPosition: Vector3;
  isVisible: boolean;
}

/**
 * 당점 표시 컴포넌트
 * - 공 위에 투명한 원을 표시하여 당점 위치를 시각적으로 보여줌
 * - impactOffsetX: 좌우 (-R ~ +R)
 * - impactOffsetY: 상하 (-R ~ +R)
 */
export function ImpactPoint({ ballPosition, isVisible }: ImpactPointProps) {
  const groupRef = useRef<Group>(null);
  const dotRef = useRef<Mesh>(null);
  const { shotInput } = useGameStore();
  const { impactOffsetX, impactOffsetY } = shotInput;

  // 당점 위치 계산 (공 표면에 투영)
  const impactPosition = useMemo(() => {
    const radius = PHYSICS.BALL_RADIUS;
    // 공 중심 기준 offset을 표면 위치로 변환
    const x = impactOffsetX;
    const y = impactOffsetY;
    // 공 표면의 Z 좌표 (앞면)
    const z = Math.sqrt(Math.max(0, radius * radius - x * x - y * y));
    
    return new Vector3(x, y, z);
  }, [impactOffsetX, impactOffsetY]);

  // 샷 방향에 따라 당점 표시 회전
  const rotation = useMemo(() => {
    const { shotDirectionDeg } = shotInput;
    return (shotDirectionDeg * Math.PI) / 180;
  }, [shotInput]);

  useFrame(() => {
    if (groupRef.current) {
      // 공 위치 + 당점 위치
      const worldPos = ballPosition.clone().add(impactPosition);
      groupRef.current.position.copy(worldPos);
      
      // 샷 방향을 바라볏록 회전
      groupRef.current.rotation.y = rotation;
    }
    
    if (dotRef.current) {
      dotRef.current.visible = isVisible;
    }
  });

  if (!isVisible) return null;

  const radius = PHYSICS.BALL_RADIUS;

  return (
    <group ref={groupRef}>
      {/* 당점 마커 (빨간 점) */}
      <mesh ref={dotRef}>
        <sphereGeometry args={[0.005, 8, 8]} />
        <meshBasicMaterial color={0xff0000} />
      </mesh>
      
      {/* 당점 범위 표시 (반투명 원) */}
      <mesh position={[0, 0, -0.001]}>
        <circleGeometry args={[radius * 0.9, 32]} />
        <meshBasicMaterial 
          color={0xffffff} 
          transparent 
          opacity={0.3} 
          side={2} // DoubleSide
        />
      </mesh>
      
      {/* 중심점 */}
      <mesh position={[0, 0, 0.001]}>
        <sphereGeometry args={[0.002, 8, 8]} />
        <meshBasicMaterial color={0x000000} />
      </mesh>
      
      {/* 십자선 */}
      <lineSegments>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={4}
            array={new Float32Array([
              -radius * 0.9, 0, 0.001,
              radius * 0.9, 0, 0.001,
              0, -radius * 0.9, 0.001,
              0, radius * 0.9, 0.001,
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={0x000000} opacity={0.3} transparent />
      </lineSegments>
    </group>
  );
}
