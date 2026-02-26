import { useRef, useMemo } from 'react';
import { Vector3, Group } from 'three';
import { useFrame } from '@react-three/fiber';
import { PHYSICS, COLORS } from '../lib/constants';

interface CueStickProps {
  cueBallPosition: Vector3;
  directionDeg: number;
  elevationDeg: number;
  power: number; // 0~1
  isVisible: boolean;
}

export function CueStick({
  cueBallPosition,
  directionDeg,
  elevationDeg,
  power,
  isVisible,
}: CueStickProps) {
  const groupRef = useRef<Group>(null);
  
  const cueLength = 1.2;
  const cueRadius = 0.008;
  const tipLength = 0.03;
  const tipRadius = 0.007;

  // 큐 위치와 방향 계산
  const { position, lookAtPosition } = useMemo(() => {
    // directionDeg: 0° = +Z, 90° = +X, 180° = -Z, 270° = -X
    // 즉 큐가 가리키는 방향 (샷 방향)
    const horizontalRad = (directionDeg * Math.PI) / 180;
    const verticalRad = (elevationDeg * Math.PI) / 180;
    
    // 큐가 가리키는 방향 벡터 (샷 방향)
    const shotDirection = new Vector3(
      Math.sin(horizontalRad) * Math.cos(verticalRad),
      Math.sin(verticalRad),
      Math.cos(horizontalRad) * Math.cos(verticalRad)
    ).normalize();
    
    // 파워에 따른 후퇴 거리 (줄을 당긴 정도)
    const pullbackDistance = 0.1 + power * 0.3; // 0.1 ~ 0.4m
    
    // 큐 팁 위치 (공 뒤에서 pullbackDistance만큼 떨어짐)
    // 공 - 샷방향 * (반지름 + 후퇴거리)
    const tipPosition = cueBallPosition.clone().sub(
      shotDirection.clone().multiplyScalar(PHYSICS.BALL_RADIUS + pullbackDistance)
    );
    
    // 큐 중심 위치 (팁에서 큐 길이의 절반만큼 뒤로)
    const centerPosition = tipPosition.clone().sub(
      shotDirection.clone().multiplyScalar(cueLength / 2)
    );
    
    // 큐가 바라볼 위치 (팁 앞쪽 = 공 방향)
    const lookAtPos = tipPosition.clone().add(shotDirection.multiplyScalar(cueLength));
    
    return {
      position: centerPosition,
      lookAtPosition: lookAtPos,
    };
  }, [cueBallPosition, directionDeg, elevationDeg, power]);

  useFrame(() => {
    if (groupRef.current) {
      groupRef.current.position.copy(position);
      // lookAt으로 방향 설정 (큐 끝이 lookAtPosition을 향함)
      groupRef.current.lookAt(lookAtPosition);
      // 기본 큐 방향이 Y+이므로 Z+ 방향으로 회전
      groupRef.current.rotateX(-Math.PI / 2);
      groupRef.current.visible = isVisible;
    }
  });

  if (!isVisible) return null;

  return (
    <group ref={groupRef}>
      {/* 큐 본체 - Y축 방향으로 생성 */}
      <mesh castShadow>
        <cylinderGeometry args={[cueRadius, cueRadius * 0.7, cueLength, 16]} />
        <meshStandardMaterial color={COLORS.CUE_STICK} roughness={0.3} />
      </mesh>
      
      {/* 큐 팁 (하단 - 공 쪽) */}
      <mesh position={[0, -cueLength / 2 - tipLength / 2, 0]} castShadow>
        <cylinderGeometry args={[tipRadius * 0.8, tipRadius, tipLength, 16]} />
        <meshStandardMaterial color={0xf5f5f5} roughness={0.8} />
      </mesh>
      
      {/* 큐 끝 (그립 - 상단) */}
      <mesh position={[0, cueLength / 2 - 0.1, 0]}>
        <cylinderGeometry args={[cueRadius * 1.2, cueRadius * 1.3, 0.25, 16]} />
        <meshStandardMaterial color={0x2c1810} roughness={0.5} />
      </mesh>
    </group>
  );
}
