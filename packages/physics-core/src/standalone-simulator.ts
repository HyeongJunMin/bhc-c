export type SimBallInit = { id: string; x: number; y: number };

export type SimShotParams = {
  cueBallId: string;
  directionDeg: number;
  dragPx: number;
  impactOffsetX: number;
  impactOffsetY: number;
};

export type SimFrameBall = {
  id: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  spinX: number;
  spinY: number;
  spinZ: number;
  speed: number;
};

export type SimFrame = {
  frameIndex: number;
  timeSec: number;
  balls: SimFrameBall[];
};

export type SimEvent = {
  type: 'CUSHION' | 'BALL_BALL';
  frameIndex: number;
  timeSec: number;
  ballId: string;
  targetId: string;
};

export type SimResult = {
  frames: SimFrame[];
  events: SimEvent[];
  totalTimeSec: number;
  totalFrames: number;
};
