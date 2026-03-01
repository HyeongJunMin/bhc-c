import { useMemo } from 'react';
import { Sphere } from '@react-three/drei';
import type { TrajectoryAnalysis } from '../../physics-sim/trajectory-analyzer';
import type { SimulationResult } from '@physics-core/standalone-simulator';
import { PHYSICS } from '../../lib/constants';

const TABLE_W = PHYSICS.TABLE_WIDTH;
const TABLE_H = PHYSICS.TABLE_HEIGHT;
const BALL_Y = PHYSICS.BALL_RADIUS;

function toThree(physX: number, physZ: number): [number, number, number] {
  return [physX - TABLE_W / 2, BALL_Y, physZ - TABLE_H / 2];
}

type Props = {
  analysis: TrajectoryAnalysis;
  actual: SimulationResult;
  thresholdM?: number;
};

export function DeviationMarkers({ analysis, actual, thresholdM = 0.01 }: Props) {
  const markers = useMemo(() => {
    const result: Array<{ pos: [number, number, number]; intensity: number }> = [];
    const { worstDeviation } = analysis;
    if (worstDeviation.distanceM < thresholdM) {
      return result;
    }
    const frame = actual.frames[worstDeviation.frameIndex];
    if (!frame) {
      return result;
    }
    const ball = frame.balls.find((b) => b.id === worstDeviation.ballId);
    if (!ball) {
      return result;
    }
    const intensity = Math.min(1, worstDeviation.distanceM / 0.05);
    result.push({ pos: toThree(ball.x, ball.z), intensity });
    return result;
  }, [analysis, actual, thresholdM]);

  return (
    <>
      {markers.map((marker, i) => (
        <Sphere key={i} args={[0.015, 16, 16]} position={marker.pos}>
          <meshBasicMaterial
            color={`hsl(${Math.round((1 - marker.intensity) * 120)}, 100%, 50%)`}
            transparent
            opacity={0.85}
          />
        </Sphere>
      ))}
    </>
  );
}
