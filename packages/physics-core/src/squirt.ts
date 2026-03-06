export type SquirtInput = {
  impactOffsetX: number;
  ballRadiusM: number;
  squirtCoefficient?: number;
  maxSquirtAngleDeg?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

export function computeSquirtAngleRad(input: SquirtInput): number {
  const squirtCoefficient = input.squirtCoefficient ?? 0.1;
  const maxSquirtAngleDeg = input.maxSquirtAngleDeg ?? 4;
  const normalizedOffset = clamp(input.impactOffsetX / Math.max(1e-6, input.ballRadiusM), -1, 1);
  const angleRad = normalizedOffset * squirtCoefficient;
  const maxAngleRad = (maxSquirtAngleDeg * Math.PI) / 180;
  return clamp(angleRad, -maxAngleRad, maxAngleRad);
}
