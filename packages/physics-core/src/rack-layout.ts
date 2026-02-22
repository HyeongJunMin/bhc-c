export type Vec2 = {
  x: number;
  y: number;
};

export type StartRackLayout = {
  cueBall: Vec2;
  objectBall1: Vec2;
  objectBall2: Vec2;
};

export const START_RACK_LAYOUT: StartRackLayout = {
  cueBall: { x: 0.45, y: 0.711 },
  objectBall1: { x: 2.394, y: 0.521 },
  objectBall2: { x: 2.394, y: 0.901 },
};
