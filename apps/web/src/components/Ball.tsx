import { useRef, useMemo } from 'react';
import { Mesh, Vector3 } from 'three';
import { useFrame } from '@react-three/fiber';
import { PHYSICS, COLORS } from '../lib/constants';

interface BallProps {
  id: string;
  color: number;
  position: Vector3;
  isActive?: boolean;
  onClick?: (id: string) => void;
}

export function Ball({ id, color, position, isActive = false, onClick }: BallProps) {
  const meshRef = useRef<Mesh>(null);
  
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

  useFrame(() => {
    if (meshRef.current) {
      // 시각적 강조 효과
      if (isActive) {
        meshRef.current.scale.setScalar(1.05);
      } else {
        meshRef.current.scale.setScalar(1.0);
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
