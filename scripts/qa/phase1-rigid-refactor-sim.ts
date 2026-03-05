import { mkdirSync, writeFileSync } from 'node:fs';
import { resolve } from 'node:path';

import { createRoomPhysicsStepConfig } from '../../packages/physics-core/src/room-physics-config.ts';
import { computeShotInitialization } from '../../packages/physics-core/src/shot-init.ts';
import { stepRoomPhysicsWorld, type PhysicsBallState } from '../../packages/physics-core/src/room-physics-step.ts';

type SimCase = {
  name: string;
  cue: { x: number; y: number };
  obj1: { x: number; y: number };
  obj2: { x: number; y: number };
  directionDeg: number;
  dragPx: number;
  impactOffsetX: number;
  impactOffsetY: number;
  maxSteps: number;
};

function degToDir(deg: number): { x: number; y: number } {
  const rad = (deg * Math.PI) / 180;
  return { x: Math.sin(rad), y: Math.cos(rad) };
}

function createBalls(simCase: SimCase): PhysicsBallState[] {
  return [
    {
      id: 'cueBall',
      x: simCase.cue.x,
      y: simCase.cue.y,
      vx: 0,
      vy: 0,
      spinX: 0,
      spinY: 0,
      spinZ: 0,
      isPocketed: false,
    },
    {
      id: 'objectBall1',
      x: simCase.obj1.x,
      y: simCase.obj1.y,
      vx: 0,
      vy: 0,
      spinX: 0,
      spinY: 0,
      spinZ: 0,
      isPocketed: false,
    },
    {
      id: 'objectBall2',
      x: simCase.obj2.x,
      y: simCase.obj2.y,
      vx: 0,
      vy: 0,
      spinX: 0,
      spinY: 0,
      spinZ: 0,
      isPocketed: false,
    },
  ];
}

function runCase(simCase: SimCase): string {
  const cfg = createRoomPhysicsStepConfig();
  const balls = createBalls(simCase);
  const cue = balls[0];
  if (!cue) {
    throw new Error('cueBall missing');
  }

  const shot = computeShotInitialization({
    dragPx: simCase.dragPx,
    impactOffsetX: simCase.impactOffsetX,
    impactOffsetY: simCase.impactOffsetY,
  });
  const dir = degToDir(simCase.directionDeg);
  cue.vx = dir.x * shot.initialBallSpeedMps;
  cue.vy = dir.y * shot.initialBallSpeedMps;
  cue.spinX = shot.omegaX * dir.y;
  cue.spinY = -shot.omegaX * dir.x;
  cue.spinZ = shot.omegaZ;

  let cushionHits = 0;
  let ballHits = 0;
  let maxSpeed = Math.hypot(cue.vx, cue.vy);
  let stepsRan = 0;

  for (let i = 0; i < simCase.maxSteps; i += 1) {
    stepsRan += 1;
    stepRoomPhysicsWorld(balls, cfg, {
      onCushionCollision: (ball) => {
        if (ball.id === 'cueBall') {
          cushionHits += 1;
        }
      },
      onBallCollision: (first, second) => {
        if (
          (first.id === 'cueBall' && second.id !== 'cueBall') ||
          (second.id === 'cueBall' && first.id !== 'cueBall')
        ) {
          ballHits += 1;
        }
      },
    });

    const cueNow = balls.find((ball) => ball.id === 'cueBall');
    if (!cueNow) {
      break;
    }
    maxSpeed = Math.max(maxSpeed, Math.hypot(cueNow.vx, cueNow.vy));
    const allStopped = balls.every((ball) => Math.hypot(ball.vx, ball.vy) < cfg.shotEndLinearSpeedThresholdMps);
    if (allStopped) {
      break;
    }
  }

  const cueFinal = balls.find((ball) => ball.id === 'cueBall');
  if (!cueFinal) {
    throw new Error('cueBall missing at final');
  }

  return [
    `CASE=${simCase.name}`,
    `  input.cue=(${simCase.cue.x.toFixed(4)}, ${simCase.cue.y.toFixed(4)})`,
    `  input.obj1=(${simCase.obj1.x.toFixed(4)}, ${simCase.obj1.y.toFixed(4)})`,
    `  input.obj2=(${simCase.obj2.x.toFixed(4)}, ${simCase.obj2.y.toFixed(4)})`,
    `  input.directionDeg=${simCase.directionDeg.toFixed(1)}`,
    `  input.dragPx=${simCase.dragPx.toFixed(1)}`,
    `  input.offset=(${simCase.impactOffsetX.toFixed(4)}, ${simCase.impactOffsetY.toFixed(4)})`,
    `  shot.speedMps=${shot.initialBallSpeedMps.toFixed(6)}`,
    `  shot.omegaX=${shot.omegaX.toFixed(6)} shot.omegaZ=${shot.omegaZ.toFixed(6)}`,
    `  result.stepsRan=${stepsRan}`,
    `  result.cushionHits=${cushionHits} ballHits=${ballHits}`,
    `  result.maxCueSpeed=${maxSpeed.toFixed(6)}`,
    `  result.finalCuePos=(${cueFinal.x.toFixed(6)}, ${cueFinal.y.toFixed(6)})`,
    `  result.finalCueVel=(${cueFinal.vx.toFixed(6)}, ${cueFinal.vy.toFixed(6)})`,
    `  result.finalCueSpin=(${cueFinal.spinX.toFixed(6)}, ${cueFinal.spinY.toFixed(6)}, ${cueFinal.spinZ.toFixed(6)})`,
  ].join('\n');
}

function main(): void {
  const cfg = createRoomPhysicsStepConfig();
  const r = cfg.ballRadiusM;

  const cases: SimCase[] = [
    {
      name: 'CENTER_HEADON',
      cue: { x: cfg.tableWidthM * 0.25, y: cfg.tableHeightM * 0.75 },
      obj1: { x: cfg.tableWidthM * 0.5, y: cfg.tableHeightM * 0.5 },
      obj2: { x: cfg.tableWidthM * 0.75, y: cfg.tableHeightM * 0.35 },
      directionDeg: 116.565,
      dragPx: 360,
      impactOffsetX: 0,
      impactOffsetY: 0,
      maxSteps: 2200,
    },
    {
      name: 'TOPSPIN_HEADON',
      cue: { x: cfg.tableWidthM * 0.25, y: cfg.tableHeightM * 0.75 },
      obj1: { x: cfg.tableWidthM * 0.5, y: cfg.tableHeightM * 0.5 },
      obj2: { x: cfg.tableWidthM * 0.75, y: cfg.tableHeightM * 0.35 },
      directionDeg: 116.565,
      dragPx: 360,
      impactOffsetX: 0,
      impactOffsetY: 0.018,
      maxSteps: 2200,
    },
    {
      name: 'BACKSPIN_HEADON',
      cue: { x: cfg.tableWidthM * 0.25, y: cfg.tableHeightM * 0.75 },
      obj1: { x: cfg.tableWidthM * 0.5, y: cfg.tableHeightM * 0.5 },
      obj2: { x: cfg.tableWidthM * 0.75, y: cfg.tableHeightM * 0.35 },
      directionDeg: 116.565,
      dragPx: 360,
      impactOffsetX: 0,
      impactOffsetY: -0.018,
      maxSteps: 2200,
    },
    {
      name: 'CORNER_RELEASE_TOP_RIGHT',
      cue: { x: cfg.tableWidthM - r - 0.0002, y: r + 0.0002 },
      obj1: { x: cfg.tableWidthM * 0.5, y: cfg.tableHeightM * 0.45 },
      obj2: { x: cfg.tableWidthM * 0.7, y: cfg.tableHeightM * 0.6 },
      directionDeg: 45,
      dragPx: 120,
      impactOffsetX: 0.012,
      impactOffsetY: 0.02,
      maxSteps: 900,
    },
    {
      name: 'CUSHION_REPEAT_LONGRAIL',
      cue: { x: cfg.tableWidthM * 0.35, y: cfg.tableHeightM * 0.2 },
      obj1: { x: cfg.tableWidthM * 0.6, y: cfg.tableHeightM * 0.55 },
      obj2: { x: cfg.tableWidthM * 0.8, y: cfg.tableHeightM * 0.7 },
      directionDeg: 20,
      dragPx: 380,
      impactOffsetX: 0.006,
      impactOffsetY: 0.015,
      maxSteps: 2600,
    },
  ];

  const lines: string[] = [];
  lines.push('PHASE1_RIGID_REFACTOR_SIM_REPORT');
  lines.push(`tableWidthM=${cfg.tableWidthM.toFixed(6)} tableHeightM=${cfg.tableHeightM.toFixed(6)} ballRadiusM=${cfg.ballRadiusM.toFixed(6)}`);
  lines.push(`dtSec=${cfg.dtSec.toFixed(6)} substeps=${cfg.substeps}`);
  lines.push('');

  for (const simCase of cases) {
    lines.push(runCase(simCase));
    lines.push('');
  }

  const output = `${lines.join('\n')}\n`;
  const outDir = resolve(process.cwd(), 'tmp');
  mkdirSync(outDir, { recursive: true });
  const outPath = resolve(outDir, 'phase1-rigid-refactor-sim.txt');
  writeFileSync(outPath, output, 'utf8');
  process.stdout.write(output);
}

main();
