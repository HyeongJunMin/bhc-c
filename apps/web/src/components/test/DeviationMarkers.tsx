import { useMemo } from 'react';
import * as THREE from 'three';
import type { SimFrame } from '../../../../../packages/physics-core/src/standalone-simulator.ts';

type Props = {
  actualFrames: SimFrame[];
  baselineFrames: SimFrame[];
  tableWidthM: number;
  tableHeightM: number;
  ballRadiusM: number;
  divergeThresholdM?: number;
};

function deviationColor(devM: number, maxDevM: number): THREE.Color {
  const t = maxDevM > 0 ? Math.min(1, devM / maxDevM) : 0;
  return new THREE.Color().setHSL(0.33 - t * 0.33, 1, 0.5);
}

export function DeviationMarkers({
  actualFrames,
  baselineFrames,
  tableWidthM,
  tableHeightM,
  ballRadiusM,
  divergeThresholdM = 0.005,
}: Props) {
  const markers = useMemo(() => {
    const result: Array<{ key: string; x: number; y: number; z: number; devM: number }> = [];
    const commonFrames = Math.min(actualFrames.length, baselineFrames.length);
    let maxDevM = 0;

    for (let i = 0; i < commonFrames; i += 5) {
      const af = actualFrames[i];
      const bf = baselineFrames[i];
      if (!af || !bf) continue;

      for (const ab of af.balls) {
        const bb = bf.balls.find((b) => b.id === ab.id);
        if (!bb) continue;
        const devM = Math.hypot(ab.x - bb.x, ab.y - bb.y);
        if (devM > divergeThresholdM) {
          maxDevM = Math.max(maxDevM, devM);
          result.push({
            key: `${i}-${ab.id}`,
            x: ab.x - tableWidthM / 2,
            y: ballRadiusM + 0.005,
            z: ab.y - tableHeightM / 2,
            devM,
          });
        }
      }
    }

    return { markers: result, maxDevM };
  }, [actualFrames, baselineFrames, tableWidthM, tableHeightM, ballRadiusM, divergeThresholdM]);

  return (
    <group>
      {markers.markers.map((m) => {
        const color = deviationColor(m.devM, markers.maxDevM);
        return (
          <mesh key={m.key} position={[m.x, m.y, m.z]}>
            <sphereGeometry args={[0.008, 6, 6]} />
            <meshBasicMaterial color={color} transparent opacity={0.7} />
          </mesh>
        );
      })}
    </group>
  );
}
