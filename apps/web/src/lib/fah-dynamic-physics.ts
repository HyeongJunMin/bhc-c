import type { StepRoomPhysicsConfig } from '../../../../packages/physics-core/src/room-physics-step.ts';
import type { FahRailSide } from './fah-index-system';

export type FahDynamicPhysicsProfile = {
  targetIndex: number;
  firstCushionSide: FahRailSide;
  grazingFactor: number;
  cornerFactor: number;
  overrides: Partial<StepRoomPhysicsConfig>;
};

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

// FAH 테스트 전용 동적 물리 보정:
// - 포인트가 코너로 갈수록(cornerFactor↑) 쿠션 반발이 조금 줄고, 접촉 마찰/스핀 결합이 늘어난다.
// - 입사각이 얕을수록(grazingFactor↑) 동일하게 throw 성분을 조금 키운다.
// 이 값은 샷마다 연속적으로 계산되며 특정 포인트 상수 하드코딩을 피한다.
export function deriveFahDynamicPhysicsProfile(
  base: StepRoomPhysicsConfig,
  targetIndex: number,
  shotDirectionDeg: number,
  firstCushionSide: FahRailSide,
): FahDynamicPhysicsProfile {
  const targetClamped = clamp(targetIndex, 0, 110);
  const targetRatio = targetClamped / 110;
  const cornerFactor = Math.abs(targetRatio - 0.5) * 2; // center=0, corner=1

  const directionRad = (shotDirectionDeg * Math.PI) / 180;
  const sideNormal = Math.abs(Math.sin(directionRad));
  const sideTangent = Math.abs(Math.cos(directionRad));
  const grazingFactor = clamp(1 - sideNormal / Math.max(1e-6, sideNormal + sideTangent), 0, 1);

  const blend = clamp(0.35 * cornerFactor + 0.65 * grazingFactor, 0, 1);

  const restitution = clamp(base.cushionRestitution * (1 - 0.04 * blend), 0.86, 0.94);
  const contactFriction = clamp(base.cushionContactFriction * (1 + 0.28 * blend), 0.03, 0.09);
  const postSpeedScale = clamp((base.cushionPostCollisionSpeedScale ?? 1.0) * (1 - 0.015 * blend), 0.985, 1.01);
  const clothSpinCoupling = clamp((base.clothLinearSpinCouplingPerSec ?? 1.0) * (1 + 0.2 * blend), 0.7, 1.8);
  const spinDamping = clamp((base.spinDampingPerTick ?? 1.0) * (1 - 0.008 * blend), 0.975, 0.997);
  const linearDamping = clamp((base.linearDampingPerTick ?? 1.0) * (1 + 0.002 * (1 - blend)), 0.975, 0.995);
  const maxThrowDeg = clamp(base.cushionMaxThrowAngleDeg * (1 + 0.08 * blend), 45, 70);

  return {
    targetIndex: round3(targetClamped),
    firstCushionSide,
    grazingFactor: round3(grazingFactor),
    cornerFactor: round3(cornerFactor),
    overrides: {
      cushionRestitution: round3(restitution),
      cushionContactFriction: round3(contactFriction),
      cushionPostCollisionSpeedScale: round3(postSpeedScale),
      clothLinearSpinCouplingPerSec: round3(clothSpinCoupling),
      spinDampingPerTick: round3(spinDamping),
      linearDampingPerTick: round3(linearDamping),
      cushionMaxThrowAngleDeg: round3(maxThrowDeg),
    },
  };
}
