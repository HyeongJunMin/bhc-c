// node --experimental-strip-types scripts/test-fah30.ts
// FAH-30 시뮬레이션 실행 및 수락조건 검증

import { runSimulation } from '../packages/physics-core/src/standalone-simulator.ts';

const shotParams = {
  cueBallId: 'cueBall',
  directionDeg: 52.1,
  dragPx: 70,
  impactOffsetX: -0.007,
  impactOffsetY: 0.007,
};
const balls = [{ id: 'cueBall', x: 0.03075, y: 0.03075 }];

// Run both profiles for comparison
const resultDefault = runSimulation(balls, shotParams, undefined, 'default');
const resultFah = runSimulation(balls, shotParams, undefined, 'fahTest');

function analyzeResult(label: string, result: typeof resultDefault) {
  const cushionEvents = result.events.filter(
    (e) => e.type === 'CUSHION' && e.ballId === 'cueBall',
  );
  const seq: string[] = [];
  for (const ev of cushionEvents) {
    if (seq[seq.length - 1] !== ev.targetId) seq.push(ev.targetId);
  }
  console.log(`\n=== ${label} ===`);
  console.log(`Frames: ${result.totalFrames}, time: ${result.totalTimeSec.toFixed(2)}s`);
  console.log(`Cushion sequence: ${seq.join(' → ')}`);
  for (const ev of cushionEvents.slice(0, 6)) {
    const frame = result.frames[ev.frameIndex];
    const ball = frame?.balls.find((b) => b.id === 'cueBall');
    if (ball) {
      console.log(
        `  [frame ${ev.frameIndex}] ${ev.targetId} | pos=(${ball.x.toFixed(3)}, ${ball.y.toFixed(3)}) vel=(${ball.vx.toFixed(3)}, ${ball.vy.toFixed(3)}) speed=${ball.speed.toFixed(3)}`,
      );
    }
  }
  const finalBall = result.frames[result.frames.length - 1]?.balls.find((b) => b.id === 'cueBall');
  if (finalBall) {
    console.log(`Final: pos=(${finalBall.x.toFixed(3)}, ${finalBall.y.toFixed(3)}) speed=${finalBall.speed.toFixed(3)}`);
  }
}

analyzeResult('DEFAULT profile (= real game)', resultDefault);
analyzeResult('fahTest profile', resultFah);

const result = resultFah;

// Extract cushion events for cueBall
const cushionEvents = result.events.filter(
  (e) => e.type === 'CUSHION' && e.ballId === 'cueBall',
);

// Deduplicate consecutive same-cushion hits
const cushionSequence: string[] = [];
for (const ev of cushionEvents) {
  if (cushionSequence[cushionSequence.length - 1] !== ev.targetId) {
    cushionSequence.push(ev.targetId);
  }
}

console.log('=== FAH-30 Simulation Results ===');
console.log(`Total frames: ${result.totalFrames}, time: ${result.totalTimeSec.toFixed(2)}s`);
console.log(`Cushion sequence: ${cushionSequence.join(' → ')}`);
console.log(`Cushion events (raw): ${cushionEvents.length}`);

// Show first 5 cushion hits with details
for (const ev of cushionEvents.slice(0, 8)) {
  const frame = result.frames[ev.frameIndex];
  const ball = frame?.balls.find((b) => b.id === 'cueBall');
  if (ball) {
    console.log(
      `  [frame ${ev.frameIndex}] ${ev.targetId} | pos=(${ball.x.toFixed(3)}, ${ball.y.toFixed(3)}) vel=(${ball.vx.toFixed(3)}, ${ball.vy.toFixed(3)}) speed=${ball.speed.toFixed(3)}`,
    );
  }
}

// Find state after 3rd cushion hit
const thirdCushionFrame = cushionEvents[2]
  ? result.frames[cushionEvents[2].frameIndex]
  : undefined;
const afterThird = thirdCushionFrame?.balls.find((b) => b.id === 'cueBall');

// Final frame
const finalFrame = result.frames[result.frames.length - 1];
const finalBall = finalFrame?.balls.find((b) => b.id === 'cueBall');

console.log('\n=== Acceptance Criteria ===');

// 1. Cushion order: bottom → right → top
const expectedSeq = ['bottom', 'right', 'top'];
const seqMatch = expectedSeq.every((c, i) => cushionSequence[i] === c);
console.log(`1. Cushion order [bottom→right→top]: ${seqMatch ? 'PASS ✓' : 'FAIL ✗'} (got: ${cushionSequence.slice(0, 3).join('→')})`);

// 2. After 3rd cushion: vx < 0 (left), vy > 0 (down)
if (afterThird) {
  const dirOk = afterThird.vx < 0 && afterThird.vy > 0;
  console.log(`2. Direction after 3rd [vx<0, vy>0]: ${dirOk ? 'PASS ✓' : 'FAIL ✗'} (vx=${afterThird.vx.toFixed(3)}, vy=${afterThird.vy.toFixed(3)})`);
} else {
  console.log('2. Direction after 3rd: FAIL ✗ (no 3rd cushion hit)');
}

// 3. After 3rd cushion: x < 1.5m
if (afterThird) {
  const posOk = afterThird.x < 1.5;
  console.log(`3. Position after 3rd [x<1.5]: ${posOk ? 'PASS ✓' : 'FAIL ✗'} (x=${afterThird.x.toFixed(3)})`);
} else {
  console.log('3. Position after 3rd: FAIL ✗ (no 3rd cushion hit)');
}

// 4. Speed after 3rd cushion > 0.5 m/s
if (afterThird) {
  const speedOk = afterThird.speed > 0.5;
  console.log(`4. Speed after 3rd [>0.5]: ${speedOk ? 'PASS ✓' : 'FAIL ✗'} (speed=${afterThird.speed.toFixed(3)})`);
} else {
  console.log('4. Speed after 3rd: FAIL ✗ (no 3rd cushion hit)');
}

if (finalBall) {
  console.log(`\nFinal: pos=(${finalBall.x.toFixed(3)}, ${finalBall.y.toFixed(3)}) vel=(${finalBall.vx.toFixed(3)}, ${finalBall.vy.toFixed(3)}) speed=${finalBall.speed.toFixed(3)}`);
}
