import { useMemo } from 'react';
import { Line } from '@react-three/drei';
import type { TrajectoryFrame } from '@physics-core/standalone-simulator';
import { PHYSICS } from '../../lib/constants';

const TABLE_W = PHYSICS.TABLE_WIDTH;
const TABLE_H = PHYSICS.TABLE_HEIGHT;
const BALL_Y = PHYSICS.BALL_RADIUS;

/** Convert physics coordinates (0-based) to Three.js scene coordinates (centred). */
function toThree(physX: number, physZ: number): [number, number, number] {
  return [physX - TABLE_W / 2, BALL_Y, physZ - TABLE_H / 2];
}

const BALL_COLORS: Record<string, string> = {
  cueBall:     '#ffffff',
  objectBall1: '#ff4444',
  objectBall2: '#ffd700',
};

type Props = {
  frames: TrajectoryFrame[];
  ballId: string;
  dashed?: boolean;
  opacity?: number;
  currentFrame?: number;
};

export function TrajectoryLine({ frames, ballId, dashed = false, opacity = 1, currentFrame }: Props) {
  const points = useMemo(() => {
    const limit = currentFrame !== undefined ? currentFrame + 1 : frames.length;
    const pts: [number, number, number][] = [];
    for (let i = 0; i < Math.min(limit, frames.length); i += 1) {
      const ball = frames[i]?.balls.find((b) => b.id === ballId);
      if (!ball) {
        continue;
      }
      pts.push(toThree(ball.x, ball.z));
    }
    return pts;
  }, [frames, ballId, currentFrame]);

  if (points.length < 2) {
    return null;
  }

  const color = BALL_COLORS[ballId] ?? '#ffffff';

  return (
    <Line
      points={points}
      color={color}
      lineWidth={dashed ? 1.5 : 2.5}
      dashed={dashed}
      dashSize={dashed ? 0.03 : 0}
      gapSize={dashed ? 0.02 : 0}
      transparent
      opacity={opacity}
    />
  );
}
