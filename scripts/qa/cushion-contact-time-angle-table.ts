import assert from 'node:assert/strict';

import { applyCushionContactThrow } from '../../apps/game-server/src/game/cushion-contact-throw.ts';

function dragPxToSpeedMps(dragPx: number): number {
  const minPx = 10;
  const maxPx = 400;
  const minSpeed = 1;
  const maxSpeed = 13.89;
  const clamped = Math.max(minPx, Math.min(maxPx, dragPx));
  const alpha = (clamped - minPx) / (maxPx - minPx);
  return minSpeed + (maxSpeed - minSpeed) * alpha;
}

async function run(): Promise<void> {
  const rows: Array<{ strokePct: number; speedMps: number; angleDeg: number }> = [];
  const spinZ = 0.38745; // 0.63R 당점을 런타임 spin 단위로 변환한 기준값

  for (let pct = 10; pct <= 100; pct += 10) {
    const dragPx = (pct / 100) * 400;
    const speedMps = dragPxToSpeedMps(dragPx);
    const result = applyCushionContactThrow({
      axis: 'x',
      vx: -speedMps,
      vy: 0,
      spinZ,
      restitution: 0.82,
      contactFriction: 0.14,
      referenceNormalSpeedMps: 5.957692307692308,
      contactTimeExponent: 1.2,
      maxSpinMagnitude: 0.615,
      maxThrowAngleDeg: 55,
    });

    rows.push({ strokePct: pct, speedMps, angleDeg: result.throwAngleDeg });
  }

  for (let index = 1; index < rows.length; index += 1) {
    assert.ok(rows[index - 1].angleDeg > rows[index].angleDeg, '스트로크 증가 시 반사각이 단조 감소해야 합니다.');
  }

  console.log('strokePct\tspeedMps\tangleDeg');
  for (const row of rows) {
    console.log(`${row.strokePct}\t${row.speedMps.toFixed(6)}\t${row.angleDeg.toFixed(3)}`);
  }
  console.log('PHYS-CT-QA pass: contact-time throw angle table generated');
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
