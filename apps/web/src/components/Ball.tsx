import { useRef, useMemo } from 'react';
import { Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { PHYSICS, COLORS } from '../lib/constants';

interface BallProps {
  id: string;
  color: number;
  position: Vector3;
  angularVelocity?: Vector3; // 스핀 각속도
  isActive?: boolean;
  onClick?: (id: string) => void;
}

export function Ball({ id, color, position, angularVelocity, isActive = false, onClick }: BallProps) {
  const meshRef = useRef<Mesh>(null);
  const rotationRef = useRef({ x: 0, y: 0, z: 0 });
  
  const radius = PHYSICS.BALL_RADIUS;

  // 반사 재질
  const material = useMemo(() => {
    return (
      <meshPhysicalMaterial
        color={color}
        roughness={0.1}
        metalness={0.1}
        clearcoat={1.0}
        clearcoatRoughness={0.1}
      />
    );
  }, [color]);

  useFrame((_, delta) => {
    if (meshRef.current) {
      // 시각적 강조 효과
      if (isActive) {
        meshRef.current.scale.setScalar(1.05);
      } else {
        meshRef.current.scale.setScalar(1.0);
      }
      
      // 스핀에 따른 회전 적용
      if (angularVelocity) {
        rotationRef.current.x += angularVelocity.x * delta;
        rotationRef.current.y += angularVelocity.y * delta;
        rotationRef.current.z += angularVelocity.z * delta;
        
        meshRef.current.rotation.x = rotationRef.current.x;
        meshRef.current.rotation.y = rotationRef.current.y;
        meshRef.current.rotation.z = rotationRef.current.z;
      }
    }
  });

  return (
    <mesh
      ref={meshRef}
      position={position}
      castShadow
      receiveShadow
      onClick={() => onClick?.(id)}
    >
      <sphereGeometry args={[radius, 32, 32]} />
      {material}
      {/* 스핀 시각화 마커 (빨간 점) */}
      <mesh position={[0, radius * 0.95, 0]}>
        <sphereGeometry args={[radius * 0.08, 16, 16]} />
        <meshBasicMaterial color={0xff0000} />
      </mesh>
      
      {/* 공 번호 표시 (흰색 공 제외) */}
      {color !== COLORS.CUE_BALL && (
        <mesh position={[0, 0, radius * 0.9]}>
          <circleGeometry args={[radius * 0.3, 32]} />
          <meshBasicMaterial color={0xffffff} />
        </mesh>
      )}
    </mesh>
  );
}
