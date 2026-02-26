import { useMemo } from 'react';
import { PHYSICS } from '../lib/constants';

export function BilliardTable() {
  const { TABLE_WIDTH, TABLE_HEIGHT, TABLE_OUTER_WIDTH, TABLE_OUTER_HEIGHT, CUSHION_HEIGHT } = PHYSICS;
  
  // 쿠션 위치 계산
  const cushions = useMemo(() => {
    const railThickness = (TABLE_OUTER_WIDTH - TABLE_WIDTH) / 2;
    const railDepth = (TABLE_OUTER_HEIGHT - TABLE_HEIGHT) / 2;
    
    return [
      // 상단 쿠션 (단쿠션)
      {
        pos: [0, CUSHION_HEIGHT / 2, -TABLE_HEIGHT / 2 - railDepth / 2],
        size: [TABLE_OUTER_WIDTH, CUSHION_HEIGHT, railDepth],
      },
      // 하단 쿠션 (단쿠션)
      {
        pos: [0, CUSHION_HEIGHT / 2, TABLE_HEIGHT / 2 + railDepth / 2],
        size: [TABLE_OUTER_WIDTH, CUSHION_HEIGHT, railDepth],
      },
      // 좌측 쿠션 (장쿠션)
      {
        pos: [-TABLE_WIDTH / 2 - railThickness / 2, CUSHION_HEIGHT / 2, 0],
        size: [railThickness, CUSHION_HEIGHT, TABLE_HEIGHT],
      },
      // 우측 쿠션 (장쿠션)
      {
        pos: [TABLE_WIDTH / 2 + railThickness / 2, CUSHION_HEIGHT / 2, 0],
        size: [railThickness, CUSHION_HEIGHT, TABLE_HEIGHT],
      },
    ];
  }, []);

  // 다이아몬드 마커 위치
  const diamondMarkers = useMemo(() => {
    const markers: { pos: [number, number, number]; rot: [number, number, number] }[] = [];
    const railThickness = (TABLE_OUTER_WIDTH - TABLE_WIDTH) / 2;
    const railDepth = (TABLE_OUTER_HEIGHT - TABLE_HEIGHT) / 2;
    
    // 장쿠션 (긴 쪽): 8등분
    for (let i = 0; i <= 8; i++) {
      const t = i / 8;
      
      // 상단 레일 (장쿠션)
      markers.push({
        pos: [TABLE_WIDTH / 2 - t * TABLE_WIDTH, CUSHION_HEIGHT + 0.005, -TABLE_HEIGHT / 2 - railDepth / 2],
        rot: [-Math.PI / 2, 0, 0],
      });
      
      // 하단 레일 (장쿠션)
      markers.push({
        pos: [-TABLE_WIDTH / 2 + t * TABLE_WIDTH, CUSHION_HEIGHT + 0.005, TABLE_HEIGHT / 2 + railDepth / 2],
        rot: [-Math.PI / 2, 0, 0],
      });
    }
    
    // 단쿠션 (짧은 쪽): 4등분
    for (let i = 0; i <= 4; i++) {
      const t = i / 4;
      
      // 좌측 레일 (단쿠션)
      markers.push({
        pos: [-TABLE_WIDTH / 2 - railThickness / 2, CUSHION_HEIGHT + 0.005, TABLE_HEIGHT / 2 - t * TABLE_HEIGHT],
        rot: [-Math.PI / 2, 0, 0],
      });
      
      // 우측 레일 (단쿠션)
      markers.push({
        pos: [TABLE_WIDTH / 2 + railThickness / 2, CUSHION_HEIGHT + 0.005, -TABLE_HEIGHT / 2 + t * TABLE_HEIGHT],
        rot: [-Math.PI / 2, 0, 0],
      });
    }
    
    return markers;
  }, []);

  return (
    <group>
      {/* 테이블 천 (플레이 영역) - 파란색 당구 천 #1978bc */}
      <mesh position={[0, 0.002, 0]} receiveShadow>
        <boxGeometry args={[TABLE_WIDTH, 0.004, TABLE_HEIGHT]} />
        <meshStandardMaterial 
          color={0x1978bc}  // 정확한 당구대 파란색
          roughness={1.0}   // 완전히 거친 천 느낌
          metalness={0}     // 금속광 없음
        />
      </mesh>

      {/* 천 질감 레이어 */}
      <mesh position={[0, 0.004, 0]} receiveShadow>
        <boxGeometry args={[TABLE_WIDTH - 0.01, 0.001, TABLE_HEIGHT - 0.01]} />
        <meshStandardMaterial 
          color={0x2288cc}  // 약간 더 밝은 파란색
          roughness={1}
          metalness={0}
          transparent
          opacity={0.4}
        />
      </mesh>

      {/* 외곽 프레임 (다이) - #631d08 */}
      <mesh position={[0, -0.08, 0]}>
        <boxGeometry args={[TABLE_OUTER_WIDTH, 0.16, TABLE_OUTER_HEIGHT]} />
        <meshStandardMaterial 
          color={0x631d08}  // 정확한 다이 색상
          roughness={0.6}
        />
      </mesh>

      {/* 상판 (프레임 상단) */}
      <mesh position={[0, -0.02, 0]}>
        <boxGeometry args={[TABLE_OUTER_WIDTH, 0.04, TABLE_OUTER_HEIGHT]} />
        <meshStandardMaterial 
          color={0x6e2009}  // 약간 밝은 다이 색상
          roughness={0.5}
        />
      </mesh>

      {/* 쿠션 */}
      {cushions.map((cushion, idx) => (
        <mesh key={idx} position={cushion.pos as [number, number, number]} castShadow>
          <boxGeometry args={cushion.size as [number, number, number]} />
          <meshStandardMaterial 
            color={0x2d4a3e}  // 쿠션 색 (어두운 녹색/갈색)
            roughness={0.7}
          />
        </mesh>
      ))}

      {/* 쿠션 날 (고무 부분) */}
      {cushions.map((cushion, idx) => (
        <mesh 
          key={`nose-${idx}`}
          position={[
            cushion.pos[0],
            cushion.pos[1] + 0.015,
            cushion.pos[2]
          ]}
          castShadow
        >
          <boxGeometry args={[
            cushion.size[0] * 0.95,
            0.015,
            cushion.size[2] * 0.95
          ]} />
          <meshStandardMaterial 
            color={0x1a3d2f}
            roughness={0.8}
          />
        </mesh>
      ))}

      {/* 다이아몬드 마커 */}
      {diamondMarkers.map((marker, idx) => (
        <mesh key={idx} position={marker.pos} rotation={marker.rot}>
          <circleGeometry args={[0.006, 6]} />
          <meshBasicMaterial color={0xffffff} opacity={0.6} transparent />
        </mesh>
      ))}

      {/* 포켓 (4개 모서리) */}
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
}
