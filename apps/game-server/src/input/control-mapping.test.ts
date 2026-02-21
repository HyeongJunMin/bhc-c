import test from 'node:test';
import assert from 'node:assert/strict';

import {
  clampDragPx,
  clampCueElevationDeg,
  mapDragPxToSpeedMps,
  mapHorizontalRotation,
  mapVerticalRotation,
  normalizeDirectionDeg,
} from './control-mapping.ts';

const FLOAT_EPSILON = 0.0001;

function assertAlmostEqual(actual: number, expected: number): void {
  assert.ok(Math.abs(actual - expected) < FLOAT_EPSILON, `expected ${expected}, got ${actual}`);
}

test('수평 방향은 0 이상 360 미만으로 정규화한다', () => {
  assert.equal(normalizeDirectionDeg(370), 10);
  assert.equal(normalizeDirectionDeg(-30), 330);
  assert.equal(normalizeDirectionDeg(720), 0);
});

test('좌우 회전 입력은 360도 기준으로 순환 누적된다', () => {
  const nextFromRight = mapHorizontalRotation(350, 20);
  const nextFromLeft = mapHorizontalRotation(10, -30);

  assert.equal(nextFromRight, 10);
  assert.equal(nextFromLeft, 340);
});

test('수직 각도는 0~89 범위로 클램프한다', () => {
  assert.equal(clampCueElevationDeg(-10), 0);
  assert.equal(clampCueElevationDeg(40), 40);
  assert.equal(clampCueElevationDeg(120), 89);
});

test('상하 회전 입력은 누적 후 0~89 범위로 제한된다', () => {
  const nextUp = mapVerticalRotation(80, 15);
  const nextDown = mapVerticalRotation(5, -20);

  assert.equal(nextUp, 89);
  assert.equal(nextDown, 0);
});

test('드래그 픽셀은 10~1000 범위로 클램프된다', () => {
  assert.equal(clampDragPx(1), 10);
  assert.equal(clampDragPx(500), 500);
  assert.equal(clampDragPx(1200), 1000);
});

test('드래그 픽셀을 선속도로 선형 매핑한다', () => {
  assertAlmostEqual(mapDragPxToSpeedMps(10), 1);
  assertAlmostEqual(mapDragPxToSpeedMps(1000), 13.89);
  assertAlmostEqual(mapDragPxToSpeedMps(505), 7.445);
});
