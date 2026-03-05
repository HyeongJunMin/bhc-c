import { applyCushionContactThrow } from '../../apps/game-server/src/game/cushion-contact-throw.ts';
import { createRoomPhysicsStepConfig } from '../../packages/physics-core/src/room-physics-config.ts';
import {
  stepRoomPhysicsWorld,
  type PhysicsBallState,
  type CushionContactThrowInput,
  type CushionContactThrowResult,
  type CushionId,
} from '../../packages/physics-core/src/room-physics-step.ts';

type SectionCase = {
  id: string;
  startRatioX: number;
  startRatioY: number;
  directionDeg: number;
};

type SweepCase = {
  sectionId: string;
  spinLabel: string;
  spinZ: number;
  flow: string;
  collisions: number;
  finalSpeedMps: number;
};

type CollisionLog = {
  index: number;
  cushionId: CushionId;
  axis: 'x' | 'y';
  speedBefore: number;
  speedAfter: number;
  headingBeforeDeg: number;
  headingAfterDeg: number;
  signedTurnDeg: number;
  turnDir: 'L' | 'R' | 'S';
  spinZ: number;
};

const SECTION_CASES: SectionCase[] = [
  { id: 'S1(top-left)', startRatioX: 0.2, startRatioY: 0.2, directionDeg: 35 },
  { id: 'S2(top-right)', startRatioX: 0.8, startRatioY: 0.2, directionDeg: 145 },
  { id: 'S3(bottom-right)', startRatioX: 0.8, startRatioY: 0.8, directionDeg: 225 },
  { id: 'S4(bottom-left)', startRatioX: 0.2, startRatioY: 0.8, directionDeg: 315 },
];

const SPIN_SWEEP = [
  { spinLabel: 'L80', spinZ: -0.8 },
  { spinLabel: 'L40', spinZ: -0.4 },
  { spinLabel: 'C00', spinZ: 0 },
  { spinLabel: 'R40', spinZ: 0.4 },
  { spinLabel: 'R80', spinZ: 0.8 },
] as const;

function directionToVelocity(directionDeg: number, speedMps: number): { vx: number; vy: number } {
  const rad = (directionDeg * Math.PI) / 180;
  return {
    vx: Math.cos(rad) * speedMps,
    vy: Math.sin(rad) * speedMps,
  };
}

function headingDeg(vx: number, vy: number): number {
  const deg = (Math.atan2(vy, vx) * 180) / Math.PI;
  return deg >= 0 ? deg : deg + 360;
}

function signedDeltaDeg(beforeDeg: number, afterDeg: number): number {
  let delta = afterDeg - beforeDeg;
  while (delta > 180) delta -= 360;
  while (delta <= -180) delta += 360;
  return delta;
}

function buildCueBall(config: ReturnType<typeof createRoomPhysicsStepConfig>, section: SectionCase, spinZ: number): PhysicsBallState {
  const startX = config.ballRadiusM + (config.tableWidthM - config.ballRadiusM * 2) * section.startRatioX;
  const startY = config.ballRadiusM + (config.tableHeightM - config.ballRadiusM * 2) * section.startRatioY;
  const v = directionToVelocity(section.directionDeg, 8.5);

  return {
    id: 'cueBall',
    x: startX,
    y: startY,
    vx: v.vx,
    vy: v.vy,
    spinX: 0,
    spinY: 0,
    spinZ,
    isPocketed: false,
  };
}

function simulateFlow(section: SectionCase, spinLabel: string, spinZ: number): { summary: SweepCase; details: CollisionLog[] } {
  const config = createRoomPhysicsStepConfig();
  const cueBall = buildCueBall(config, section, spinZ);
  const balls: PhysicsBallState[] = [cueBall];
  const details: CollisionLog[] = [];

  const pendingContacts: Array<{
    axis: 'x' | 'y';
    speedBefore: number;
    headingBeforeDeg: number;
    spinZ: number;
    speedAfter: number;
    headingAfterDeg: number;
  }> = [];

  const wrappedThrow = (input: CushionContactThrowInput): CushionContactThrowResult => {
    const speedBefore = Math.hypot(input.vx, input.vy);
    const headingBeforeDeg = headingDeg(input.vx, input.vy);
    const result = applyCushionContactThrow(input);
    const speedAfter = Math.hypot(result.vx, result.vy);
    const headingAfterDeg = headingDeg(result.vx, result.vy);
    pendingContacts.push({
      axis: input.axis,
      speedBefore,
      headingBeforeDeg,
      spinZ: input.spinZ,
      speedAfter,
      headingAfterDeg,
    });
    return result;
  };

  let ticks = 0;
  const maxTicks = 1400;
  while (ticks < maxTicks) {
    stepRoomPhysicsWorld(balls, config, {
      applyCushionContactThrow: wrappedThrow,
      onCushionCollision: (_ball, cushionId) => {
        const contact = pendingContacts.shift();
        if (!contact) {
          return;
        }
        details.push({
          index: details.length + 1,
          cushionId,
          axis: contact.axis,
          speedBefore: contact.speedBefore,
          speedAfter: contact.speedAfter,
          headingBeforeDeg: contact.headingBeforeDeg,
          headingAfterDeg: contact.headingAfterDeg,
          signedTurnDeg: signedDeltaDeg(contact.headingBeforeDeg, contact.headingAfterDeg),
          turnDir: signedDeltaDeg(contact.headingBeforeDeg, contact.headingAfterDeg) > 0.1
            ? 'L'
            : signedDeltaDeg(contact.headingBeforeDeg, contact.headingAfterDeg) < -0.1
              ? 'R'
              : 'S',
          spinZ: contact.spinZ,
        });
      },
    });

    ticks += 1;

    const speed = Math.hypot(cueBall.vx, cueBall.vy);
    if (speed < config.shotEndLinearSpeedThresholdMps) {
      break;
    }
    if (details.length >= 6) {
      break;
    }
  }

  const flow = details.map((row) => row.cushionId).join(' -> ');
  return {
    summary: {
      sectionId: section.id,
      spinLabel,
      spinZ,
      flow: flow || '(none)',
      collisions: details.length,
      finalSpeedMps: Math.hypot(cueBall.vx, cueBall.vy),
    },
    details,
  };
}

function printSummary(rows: SweepCase[]): void {
  console.log('=== Cushion Flow Sandbox (spin by section) ===');
  console.log('section\tspin\tspinZ\tcollisions\tflow\tfinalSpeed');
  for (const row of rows) {
    console.log(`${row.sectionId}\t${row.spinLabel}\t${row.spinZ.toFixed(2)}\t${row.collisions}\t${row.flow}\t${row.finalSpeedMps.toFixed(3)}`);
  }
}

function printDetails(sectionId: string, spinLabel: string, details: CollisionLog[]): void {
  console.log(`\n--- detail: ${sectionId} / ${spinLabel} ---`);
  if (details.length === 0) {
    console.log('(no cushion collision)');
    return;
  }
  console.log('idx\tcushion\taxis\theadBefore\theadAfter\tturnDeg\tturnDir\tspeedBefore\tspeedAfter\tspinZ');
  for (const row of details) {
    console.log(
      `${row.index}\t${row.cushionId}\t${row.axis}\t${row.headingBeforeDeg.toFixed(1)}\t${row.headingAfterDeg.toFixed(1)}\t${row.signedTurnDeg.toFixed(1)}\t${row.turnDir}\t${row.speedBefore.toFixed(3)}\t${row.speedAfter.toFixed(3)}\t${row.spinZ.toFixed(3)}`,
    );
  }
}

async function run(): Promise<void> {
  const summaries: SweepCase[] = [];

  for (const section of SECTION_CASES) {
    for (const spinCase of SPIN_SWEEP) {
      const { summary, details } = simulateFlow(section, spinCase.spinLabel, spinCase.spinZ);
      summaries.push(summary);
      printDetails(section.id, spinCase.spinLabel, details);
    }
  }

  console.log('');
  printSummary(summaries);
  console.log('\nPHYS-SPIN-FLOW-QA pass: generated section/spin cushion flow report');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
