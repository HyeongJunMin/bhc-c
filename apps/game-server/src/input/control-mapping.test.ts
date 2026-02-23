import test from 'node:test';
import assert from 'node:assert/strict';

import {
  applyWASDImpactOffset,
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

test('드래그 픽셀은 10~400 범위로 클램프된다', () => {
  assert.equal(clampDragPx(1), 10);
  assert.equal(clampDragPx(300), 300);
  assert.equal(clampDragPx(1200), 400);
});

test('드래그 픽셀을 선속도로 선형 매핑한다', () => {
  assertAlmostEqual(mapDragPxToSpeedMps(10), 1);
  assertAlmostEqual(mapDragPxToSpeedMps(400), 13.89);
  assertAlmostEqual(mapDragPxToSpeedMps(205), 7.445);
});

test('WASD 입력으로 당점 오프셋을 누적 이동한다', () => {
  const nextOffset = applyWASDImpactOffset({ x: 0, y: 0 }, ['W', 'D']);

  assertAlmostEqual(nextOffset.x, 0.005);
  assertAlmostEqual(nextOffset.y, 0.005);
});

test('상반된 WASD 입력은 상쇄된다', () => {
  const nextOffset = applyWASDImpactOffset({ x: 0.01, y: -0.01 }, ['A', 'D', 'W', 'S']);

  assertAlmostEqual(nextOffset.x, 0.01);
  assertAlmostEqual(nextOffset.y, -0.01);
});

test('당점 오프셋은 최대 반지름 범위를 넘지 않는다', () => {
  const nextOffset = applyWASDImpactOffset({ x: 0.03, y: -0.03 }, ['D', 'S'], 0.01);

  assertAlmostEqual(nextOffset.x, 0.03075);
  assertAlmostEqual(nextOffset.y, -0.03075);
});
