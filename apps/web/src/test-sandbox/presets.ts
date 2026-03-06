import type { SandboxConfig } from './types.ts';

export type PresetName = 'straight' | 'cushion' | 'angle-45' | 'cushion-bounce' | 'spin-english';

export const SANDBOX_PRESETS: Record<PresetName, SandboxConfig> = {
  straight: {
    balls: [
      { id: 'cueBall', x: 0.5, y: 0.711, enabled: true },
      { id: 'objectBall1', x: 1.9, y: 0.711, enabled: true },
      { id: 'objectBall2', x: 2.5, y: 0.711, enabled: true },
    ],
    shot: { cueBallId: 'cueBall', directionDeg: 90, dragPx: 200, impactOffsetX: 0, impactOffsetY: 0 },
  },
  cushion: {
    balls: [
      { id: 'cueBall', x: 1.422, y: 0.5, enabled: true },
      { id: 'objectBall1', x: 0.7, y: 1.2, enabled: true },
      { id: 'objectBall2', x: 2.1, y: 1.2, enabled: true },
    ],
    shot: { cueBallId: 'cueBall', directionDeg: 0, dragPx: 200, impactOffsetX: 0, impactOffsetY: 0 },
  },
  'angle-45': {
    balls: [
      { id: 'cueBall', x: 0.5, y: 0.4, enabled: true },
      { id: 'objectBall1', x: 1.5, y: 1.0, enabled: true },
      { id: 'objectBall2', x: 2.2, y: 0.4, enabled: true },
    ],
    shot: { cueBallId: 'cueBall', directionDeg: 45, dragPx: 200, impactOffsetX: 0, impactOffsetY: 0 },
  },
  'cushion-bounce': {
    balls: [
      { id: 'cueBall', x: 0.7, y: 0.711, enabled: true },
      { id: 'objectBall1', x: 2.1, y: 0.3, enabled: true },
      { id: 'objectBall2', x: 1.0, y: 1.2, enabled: true },
    ],
    shot: { cueBallId: 'cueBall', directionDeg: 60, dragPx: 250, impactOffsetX: 0, impactOffsetY: 0 },
  },
  'spin-english': {
    balls: [
      { id: 'cueBall', x: 1.0, y: 0.711, enabled: true },
      { id: 'objectBall1', x: 2.3, y: 1.1, enabled: true },
      { id: 'objectBall2', x: 0.5, y: 1.1, enabled: true },
    ],
    shot: { cueBallId: 'cueBall', directionDeg: 90, dragPx: 200, impactOffsetX: 0.025, impactOffsetY: 0 },
  },
};

export const PRESET_NAMES = Object.keys(SANDBOX_PRESETS) as PresetName[];
