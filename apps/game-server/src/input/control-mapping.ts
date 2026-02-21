export function normalizeDirectionDeg(directionDeg: number): number {
  const normalized = directionDeg % 360;
  return normalized < 0 ? normalized + 360 : normalized;
}

export function mapHorizontalRotation(currentDirectionDeg: number, deltaDeg: number): number {
  return normalizeDirectionDeg(currentDirectionDeg + deltaDeg);
}

export function clampCueElevationDeg(cueElevationDeg: number): number {
  if (cueElevationDeg < 0) {
    return 0;
  }

  if (cueElevationDeg > 89) {
    return 89;
  }

  return cueElevationDeg;
}

export function mapVerticalRotation(currentCueElevationDeg: number, deltaDeg: number): number {
  return clampCueElevationDeg(currentCueElevationDeg + deltaDeg);
}

const MIN_DRAG_PX = 10;
const MAX_DRAG_PX = 1000;
const MIN_SPEED_MPS = 1;
const MAX_SPEED_MPS = 13.89;

export function clampDragPx(dragPx: number): number {
  if (dragPx < MIN_DRAG_PX) {
    return MIN_DRAG_PX;
  }

  if (dragPx > MAX_DRAG_PX) {
    return MAX_DRAG_PX;
  }

  return dragPx;
}

export function mapDragPxToSpeedMps(dragPx: number): number {
  const normalizedDragPx = clampDragPx(dragPx);
  const ratio = (normalizedDragPx - MIN_DRAG_PX) / (MAX_DRAG_PX - MIN_DRAG_PX);

  return MIN_SPEED_MPS + ratio * (MAX_SPEED_MPS - MIN_SPEED_MPS);
}
