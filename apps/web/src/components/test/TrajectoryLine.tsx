import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import type { SimFrame } from '../../../../../packages/physics-core/src/standalone-simulator.ts';

const BALL_COLORS: Record<string, string> = {
  cueBall: '#ffffff',
  objectBall1: '#ff4444',
  objectBall2: '#ffd700',
};

const DEFAULT_COLOR = '#88aaff';

type Props = {
  ballId: string;
  frames: SimFrame[];
  tableWidthM: number;
  tableHeightM: number;
  ballRadiusM: number;
  dashed?: boolean;
  opacity?: number;
};

export function TrajectoryLine({ ballId, frames, tableWidthM, tableHeightM, ballRadiusM, dashed = false, opacity = 0.7 }: Props) {
  const points = useMemo<[number, number, number][]>(() => {
    const pts: [number, number, number][] = [];
    for (const frame of frames) {
      const ball = frame.balls.find((b) => b.id === ballId);
      if (!ball) continue;
      const tx = ball.x - tableWidthM / 2;
      const tz = ball.y - tableHeightM / 2;
      pts.push([tx, ballRadiusM + 0.001, tz]);
    }
    return pts;
  }, [ballId, frames, tableWidthM, tableHeightM, ballRadiusM]);

  const color = BALL_COLORS[ballId] ?? DEFAULT_COLOR;

  if (points.length < 2) return null;

  return (
    <Line
      points={points}
      color={color}
      lineWidth={dashed ? 1 : 1.5}
      dashed={dashed}
      dashSize={0.05}
      gapSize={0.03}
      transparent
      opacity={opacity}
    />
  );
}
