import { useMemo } from 'react';
import { PHYSICS, COLORS } from '../lib/constants';
import * as THREE from 'three';

export function BilliardTable() {
  const { TABLE_WIDTH, TABLE_HEIGHT, TABLE_OUTER_WIDTH, TABLE_OUTER_HEIGHT, CUSHION_HEIGHT, CUSHION_THICKNESS } = PHYSICS;
  
  // 쿠션 설정
  const cushions = useMemo(() => {
    return [
      { pos: [0, CUSHION_HEIGHT / 2, -(TABLE_HEIGHT / 2 - CUSHION_THICKNESS / 2)], size: [TABLE_WIDTH, CUSHION_HEIGHT, CUSHION_THICKNESS] },
      { pos: [0, CUSHION_HEIGHT / 2, (TABLE_HEIGHT / 2 - CUSHION_THICKNESS / 2)], size: [TABLE_WIDTH, CUSHION_HEIGHT, CUSHION_THICKNESS] },
      { pos: [-(TABLE_WIDTH / 2 - CUSHION_THICKNESS / 2), CUSHION_HEIGHT / 2, 0], size: [CUSHION_THICKNESS, CUSHION_HEIGHT, TABLE_HEIGHT] },
      { pos: [(TABLE_WIDTH / 2 - CUSHION_THICKNESS / 2), CUSHION_HEIGHT / 2, 0], size: [CUSHION_THICKNESS, CUSHION_HEIGHT, TABLE_HEIGHT] },
    ];
  }, [TABLE_WIDTH, TABLE_HEIGHT, CUSHION_HEIGHT, CUSHION_THICKNESS]);

  // 다이 설정
  const rails = useMemo(() => {
    const railThickness = (TABLE_OUTER_WIDTH - TABLE_WIDTH) / 2;
    const railDepth = (TABLE_OUTER_HEIGHT - TABLE_HEIGHT) / 2;
    
    return {
      straight: [
        { pos: [0, CUSHION_HEIGHT / 2, -(TABLE_HEIGHT / 2 + railDepth / 2)], size: [TABLE_WIDTH, CUSHION_HEIGHT, railDepth] },
        { pos: [0, CUSHION_HEIGHT / 2, (TABLE_HEIGHT / 2 + railDepth / 2)], size: [TABLE_WIDTH, CUSHION_HEIGHT, railDepth] },
        { pos: [-(TABLE_WIDTH / 2 + railThickness / 2), CUSHION_HEIGHT / 2, 0], size: [railThickness, CUSHION_HEIGHT, TABLE_HEIGHT] },
        { pos: [(TABLE_WIDTH / 2 + railThickness / 2), CUSHION_HEIGHT / 2, 0], size: [railThickness, CUSHION_HEIGHT, TABLE_HEIGHT] },
      ],
      corners: [
        { pos: [-TABLE_WIDTH / 2, CUSHION_HEIGHT / 2, -TABLE_HEIGHT / 2], rot: 0, rx: railThickness, rz: railDepth },
        { pos: [TABLE_WIDTH / 2, CUSHION_HEIGHT / 2, -TABLE_HEIGHT / 2], rot: Math.PI / 2, rx: railDepth, rz: railThickness },
        { pos: [-TABLE_WIDTH / 2, CUSHION_HEIGHT / 2, TABLE_HEIGHT / 2], rot: -Math.PI / 2, rx: railDepth, rz: railThickness },
        { pos: [TABLE_WIDTH / 2, CUSHION_HEIGHT / 2, TABLE_HEIGHT / 2], rot: Math.PI, rx: railThickness, rz: railDepth },
      ],
    };
  }, []);

  // 부채꼴 모서리 Geometry 생성
  const cornerGeometry = useMemo(() => {
    const shape = new THREE.Shape();
    // 부채꼴 그리기 (0,0) -> (r,0) -> 원호 -> (0,r) -> (0,0)
    shape.moveTo(0, 0);
    shape.lineTo(1, 0);
    shape.absarc(0, 0, 1, 0, Math.PI / 2, false);
    shape.lineTo(0, 0);
    
    const geo = new THREE.ExtrudeGeometry(shape, {
      depth: CUSHION_HEIGHT,
      bevelEnabled: false,
    });
    geo.rotateX(-Math.PI / 2); // 수평으로 눕히기
    geo.translate(0, -CUSHION_HEIGHT / 2, 0); // 중심 조정
    return geo;
  }, [CUSHION_HEIGHT]);

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

      {/* 4개 모서리 - 진짜 부채꼴(Quarter Circle) */}
      {rails.corners.map((corner, idx) => (
        <mesh 
          key={`corner-${idx}`} 
          position={corner.pos as [number, number, number]} 
          rotation={[0, corner.rot, 0]}
          scale={[corner.rx, 1, corner.rz]}
          geometry={cornerGeometry}
          castShadow
        >
          <meshStandardMaterial color={COLORS.TABLE_RAIL} roughness={0.6} />
        </mesh>
      ))}

      {/* 쿠션 */}
      {cushions.map((cushion, idx) => (
        <mesh key={`cushion-${idx}`} position={cushion.pos as [number, number, number]} castShadow>
          <boxGeometry args={cushion.size as [number, number, number]} />
          <meshStandardMaterial color={COLORS.CUSHION} roughness={0.7} />
        </mesh>
      ))}

      {/* 쿠션 날 */}
      {cushions.map((cushion, idx) => {
        const isHorizontal = cushion.size[2] === CUSHION_THICKNESS;
        const noseWidth = isHorizontal ? TABLE_WIDTH - CUSHION_THICKNESS * 2 : CUSHION_THICKNESS * 0.8;
        const noseDepth = isHorizontal ? CUSHION_THICKNESS * 0.8 : TABLE_HEIGHT - CUSHION_THICKNESS * 2;
        return (
          <mesh key={`nose-${idx}`} position={[cushion.pos[0], cushion.pos[1] + 0.015, cushion.pos[2]]} castShadow>
            <boxGeometry args={[noseWidth, 0.015, noseDepth]} />
            <meshStandardMaterial color={COLORS.CUSHION} roughness={0.8} />
          </mesh>
        );
      })}

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
}
