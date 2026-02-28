import { Vector3 } from 'three';

export interface BallState {
  id: 'cueBall' | 'objectBall1' | 'objectBall2';
  position: Vector3;
  isPocketed: boolean;
}

export interface ShotInput {
  shotDirectionDeg: number;
  cueElevationDeg: number;
  dragPx: number;
  impactOffsetX: number;
  impactOffsetY: number;
}

export interface TableDimensions {
  width: number;
  height: number;
  cushionHeight: number;
  ballRadius: number;
}

export type RailId = 'bottom' | 'right' | 'top' | 'left';

export interface RailPoint {
  rail: RailId;
  index50: number;
}

export interface HalfSystemInput {
  startIndex: number;
  arrivalIndex: number;
  sideEnglish: number;
  verticalEnglish: number;
  incidenceAngleDeg: number;
}

export interface HalfSystemResult {
  baseAim: number;
  finalAim: number;
  spinCorrection: number;
  angleCorrection: number;
}

export type GamePhase = 'AIMING' | 'SHOOTING' | 'SIMULATING' | 'SCORING' | 'WAITING' | 'FINISHED';

export interface AngularVelocity {
  omegaX: number;
  omegaZ: number;
}

export interface GameState {
  phase: GamePhase;
  currentPlayer: string;
  scores: Record<string, number>;
  cushionContacts: number;
  objectBallsHit: Set<string>;
}
