// node --experimental-strip-types scripts/test-fah-all.ts
// 모든 FAH 시나리오: 당점 -0.007(11시)로 통일 후 시뮬레이션 검증

import { runSimulation } from '../packages/physics-core/src/standalone-simulator.ts';

const scenarios = [
  { id: 'fah-pos10', directionDeg: 61.0 },
  { id: 'fah-pos20', directionDeg: 57.1 },
  { id: 'fah-pos30', directionDeg: 52.1 },
  { id: 'fah-pos40', directionDeg: 45.6 },
  { id: 'fah-pos50', directionDeg: 37.3 },
];

const balls = [{ id: 'cueBall', x: 0.03075, y: 0.03075 }];

console.log('=== 모든 FAH 시나리오: impactOffsetX=-0.007 (11시 당점) ===\n');

for (const sc of scenarios) {
  const shotParams = {
    cueBallId: 'cueBall',
    directionDeg: sc.directionDeg,
    dragPx: 70,
    impactOffsetX: -0.007,  // 11시 당점 통일
    impactOffsetY: 0.007,
  };

  const result = runSimulation(balls, shotParams, undefined, 'fahTest');
  const cushionEvents = result.events.filter(e => e.type === 'CUSHION' && e.ballId === 'cueBall');
  const seq: string[] = [];
  for (const ev of cushionEvents) {
    if (seq[seq.length - 1] !== ev.targetId) seq.push(ev.targetId);
  }

  console.log(`--- ${sc.id} (deg=${sc.directionDeg}) ---`);
  console.log(`Cushion sequence: ${seq.join(' → ')}`);
  for (const ev of cushionEvents.slice(0, 5)) {
    const frame = result.frames[ev.frameIndex];
    const ball = frame?.balls.find(b => b.id === 'cueBall');
    if (ball) {
      console.log(`  [frame ${ev.frameIndex}] ${ev.targetId} | pos=(${ball.x.toFixed(3)}, ${ball.y.toFixed(3)}) vel=(${ball.vx.toFixed(3)}, ${ball.vy.toFixed(3)}) speed=${ball.speed.toFixed(3)}`);
    }
  }
  console.log();
}
