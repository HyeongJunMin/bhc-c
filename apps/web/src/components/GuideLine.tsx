import { useMemo } from 'react';
import { Vector3 } from 'three';
import { COLORS, PHYSICS } from '../lib/constants';
import { diamondMapper } from '../lib/diamond-mapper';

interface GuideLineProps {
  cueBallPosition: Vector3;
  directionDeg: number;
  isVisible: boolean;
}

export function GuideLine({ cueBallPosition, directionDeg, isVisible }: GuideLineProps) {
  // 3쿠션 경로 예측
  const pathPoints = useMemo(() => {
    if (!isVisible) return [];
    
    const points: Vector3[] = [cueBallPosition.clone()];
    
    // directionDeg: 0° = +Z, 90° = +X, 180° = -Z, 270° = -X
    const horizontalRad = (directionDeg * Math.PI) / 180;
    
    // 방향 벡터 (XZ 평면)
    let direction = new Vector3(
      Math.sin(horizontalRad),
      0,
      Math.cos(horizontalRad)
    ).normalize();
    
    let current = cueBallPosition.clone();
    
    const table = diamondMapper.tableRect;
    const bounds = {
      minX: -table.width / 2 + PHYSICS.BALL_RADIUS,
      maxX: table.width / 2 - PHYSICS.BALL_RADIUS,
      minZ: -table.height / 2 + PHYSICS.BALL_RADIUS,
      maxZ: table.height / 2 - PHYSICS.BALL_RADIUS,
    };
    
    // 최대 5번 반사
    for (let i = 0; i < 5; i++) {
      const next = intersectWithBounds(current, direction, bounds);
      if (!next) break;
      
      points.push(next.point);
      direction = next.reflectedDirection;
      current = next.point.clone().add(direction.clone().multiplyScalar(0.001));
    }
    
    // 마지막 방향으로 연장
    if (points.length > 1) {
      const last = points[points.length - 1];
      points.push(last.clone().add(direction.multiplyScalar(0.5)));
    }
    
    return points;
  }, [cueBallPosition, directionDeg, isVisible]);

  if (!isVisible || pathPoints.length < 2) return null;

  return (
    <line>
      <bufferGeometry>
        <bufferAttribute
          attach="attributes-position"
          count={pathPoints.length}
          array={new Float32Array(pathPoints.flatMap(p => [p.x, p.y, p.z]))}
          itemSize={3}
        />
      </bufferGeometry>
      <lineBasicMaterial color={COLORS.GUIDE_LINE} opacity={0.6} transparent linewidth={2} />
    </line>
  );
}

interface IntersectionResult {
  point: Vector3;
  reflectedDirection: Vector3;
}

function intersectWithBounds(
  origin: Vector3,
  dir: Vector3,
  bounds: { minX: number; maxX: number; minZ: number; maxZ: number }
): IntersectionResult | null {
  const eps = 0.0001;
  let tMin = Infinity;
  let normal = new Vector3(1, 0, 0);
  
  // X 축 검사 (좌/우 쿠션)
  if (Math.abs(dir.x) > eps) {
    const tLeft = (bounds.minX - origin.x) / dir.x;
    const zLeft = origin.z + tLeft * dir.z;
    if (tLeft > 0.01 && zLeft >= bounds.minZ && zLeft <= bounds.maxZ && tLeft < tMin) {
      tMin = tLeft;
      normal = new Vector3(1, 0, 0);
    }
    
    const tRight = (bounds.maxX - origin.x) / dir.x;
    const zRight = origin.z + tRight * dir.z;
    if (tRight > 0.01 && zRight >= bounds.minZ && zRight <= bounds.maxZ && tRight < tMin) {
      tMin = tRight;
      normal = new Vector3(-1, 0, 0);
    }
  }
  
  // Z 축 검사 (상/하 쿠션)
  if (Math.abs(dir.z) > eps) {
    const tBottom = (bounds.minZ - origin.z) / dir.z;
    const xBottom = origin.x + tBottom * dir.x;
    if (tBottom > 0.01 && xBottom >= bounds.minX && xBottom <= bounds.maxX && tBottom < tMin) {
      tMin = tBottom;
      normal = new Vector3(0, 0, 1);
    }
    
    const tTop = (bounds.maxZ - origin.z) / dir.z;
    const xTop = origin.x + tTop * dir.x;
    if (tTop > 0.01 && xTop >= bounds.minX && xTop <= bounds.maxX && tTop < tMin) {
      tMin = tTop;
      normal = new Vector3(0, 0, -1);
    }
  }
  
  if (!isFinite(tMin)) return null;
  
  const point = origin.clone().add(dir.clone().multiplyScalar(tMin));
  const reflectedDirection = dir.clone().reflect(normal);
  
  return { point, reflectedDirection };
}
