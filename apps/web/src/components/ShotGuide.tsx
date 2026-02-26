import { useMemo, useRef, useEffect } from 'react';
import { Vector3, Line, BufferGeometry, LineDashedMaterial } from 'three';

interface ShotGuideProps {
  cueBallPosition: Vector3;
  directionDeg: number;
  isVisible: boolean;
}

// 청색 바닥 위에서 잘 보이는 밝은 색상
const GUIDE_COLOR = 0xffffff; // 흰색

/**
 * 큐 방향으로 직진 가이드라인 (점선)
 * - 수구 앞으로 큐가 가리키는 방향으로 점선 표시
 */
export function ShotGuide({ cueBallPosition, directionDeg, isVisible }: ShotGuideProps) {
  const lineRef = useRef<Line>(null);

  const { geometry, material } = useMemo(() => {
    if (!isVisible) {
      return { geometry: new BufferGeometry(), material: null };
    }
    
    // directionDeg: 0° = +Z, 90° = +X (게임 좌표계)
    const horizontalRad = (directionDeg * Math.PI) / 180;
    
    // 큐 방향 벡터
    const direction = new Vector3(
      Math.sin(horizontalRad),
      0,
      Math.cos(horizontalRad)
    ).normalize();
    
    // 시작점: 수구 표면 앞 약간 떨어진 곳
    const start = cueBallPosition.clone().add(direction.clone().multiplyScalar(0.05));
    
    // 끝점: 2m 앞
    const end = start.clone().add(direction.multiplyScalar(2));
    
    const geo = new BufferGeometry().setFromPoints([start, end]);
    
    const mat = new LineDashedMaterial({
      color: GUIDE_COLOR,
      dashSize: 0.03,
      gapSize: 0.02,
      opacity: 0.9,
      transparent: true,
      linewidth: 2,
    });
    
    return { geometry: geo, material: mat };
  }, [cueBallPosition, directionDeg, isVisible]);

  // 점선 거리 계산
  useEffect(() => {
    if (lineRef.current && isVisible) {
      lineRef.current.computeLineDistances();
    }
  }, [geometry, isVisible]);

  if (!isVisible || !material) return null;

  return (
    <primitive object={new Line(geometry, material)} ref={lineRef} />
  );
}
