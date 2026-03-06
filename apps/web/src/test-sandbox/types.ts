export type SandboxBallConfig = {
  id: string;
  x: number;
  y: number;
  enabled: boolean;
};

export type SandboxShotConfig = {
  cueBallId: string;
  directionDeg: number;
  dragPx: number;
  impactOffsetX: number;
  impactOffsetY: number;
};

export type SandboxConfig = {
  balls: SandboxBallConfig[];
  shot: SandboxShotConfig;
};
