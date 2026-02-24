import assert from 'node:assert/strict';

import { applyCushionContactThrow } from '../../apps/game-server/src/game/cushion-contact-throw.ts';

const CUE_BALL_RADIUS_M = 0.03075;

function dragPxToSpeedMps(dragPx: number): number {
  const minPx = 10;
  const maxPx = 400;
  const minSpeed = 1;
  const maxSpeed = 13.89;
  const clamped = Math.max(minPx, Math.min(maxPx, dragPx));
  const alpha = (clamped - minPx) / (maxPx - minPx);
  return minSpeed + (maxSpeed - minSpeed) * alpha;
}

function spinFromOffsetRatio(offsetRatioR: number): number {
  const offsetMeters = offsetRatioR * CUE_BALL_RADIUS_M;
  return offsetMeters * 20;
}

async function run(): Promise<void> {
  const case1Rows: Array<{ strokePct: number; speedMps: number; angleDeg: number }> = [];
  const fixedSpinZ = spinFromOffsetRatio(0.8);

  for (let pct = 10; pct <= 100; pct += 10) {
    const dragPx = (pct / 100) * 400;
    const speedMps = dragPxToSpeedMps(dragPx);
    const result = applyCushionContactThrow({
      axis: 'x',
      vx: -speedMps,
      vy: 0,
      spinZ: fixedSpinZ,
      restitution: 0.82,
      contactFriction: 0.14,
      referenceNormalSpeedMps: 5.957692307692308,
      contactTimeExponent: 1.2,
      maxSpinMagnitude: 0.615,
      maxThrowAngleDeg: 55,
    });

    case1Rows.push({ strokePct: pct, speedMps, angleDeg: result.throwAngleDeg });
  }

  for (let index = 1; index < case1Rows.length; index += 1) {
    assert.ok(case1Rows[index - 1].angleDeg > case1Rows[index].angleDeg, '스트로크 증가 시 반사각이 단조 감소해야 합니다.');
  }

  const case2Rows: Array<{ offsetRatioR: number; spinZ: number; angleDeg: number }> = [];
  const fixedStrokeSpeed = dragPxToSpeedMps(0.4 * 400);
  for (let ratioPct = 10; ratioPct <= 80; ratioPct += 10) {
    const offsetRatioR = ratioPct / 100;
    const spinZ = spinFromOffsetRatio(offsetRatioR);
    const result = applyCushionContactThrow({
      axis: 'x',
      vx: -fixedStrokeSpeed,
      vy: 0,
      spinZ,
      restitution: 0.82,
      contactFriction: 0.14,
      referenceNormalSpeedMps: 5.957692307692308,
      contactTimeExponent: 1.2,
      maxSpinMagnitude: 0.615,
      maxThrowAngleDeg: 55,
    });
    case2Rows.push({ offsetRatioR, spinZ, angleDeg: result.throwAngleDeg });
  }
  for (let index = 1; index < case2Rows.length; index += 1) {
    assert.ok(case2Rows[index - 1].angleDeg < case2Rows[index].angleDeg, '회전 증가 시 반사각이 단조 증가해야 합니다.');
  }

  console.log('CASE1 stroke sweep (fixed spin = 0.8R)');
  console.log('strokePct\tspeedMps\tangleDeg');
  for (const row of case1Rows) {
    console.log(`${row.strokePct}\t${row.speedMps.toFixed(6)}\t${row.angleDeg.toFixed(3)}`);
  }
  console.log('');
  console.log('CASE2 spin sweep (fixed stroke = 40%)');
  console.log('offsetRatioR\tspinZ\tangleDeg');
  for (const row of case2Rows) {
    console.log(`${row.offsetRatioR.toFixed(1)}R\t${row.spinZ.toFixed(6)}\t${row.angleDeg.toFixed(3)}`);
  }
  console.log('PHYS-CT-QA pass: monotonic checks passed for stroke sweep and spin sweep');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
