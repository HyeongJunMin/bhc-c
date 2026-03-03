import { TABLE_GEOMETRY, TABLE_PLAYFIELD_BOUNDS } from '../../packages/shared-types/src/table-geometry.ts';
import { createRoomPhysicsStepConfig } from '../../packages/physics-core/src/room-physics-config.ts';
import { PHYSICS } from '../../apps/web/src/lib/constants.ts';

function assertAlmostEqual(name: string, actual: number, expected: number, eps = 1e-12): void {
  if (Math.abs(actual - expected) > eps) {
    throw new Error(`${name} mismatch: actual=${actual}, expected=${expected}`);
  }
}

function main(): void {
  const config = createRoomPhysicsStepConfig();

  assertAlmostEqual('tableWidthM', config.tableWidthM, TABLE_GEOMETRY.tableInnerWidthM);
  assertAlmostEqual('tableHeightM', config.tableHeightM, TABLE_GEOMETRY.tableInnerHeightM);
  assertAlmostEqual('ballRadiusM', config.ballRadiusM, TABLE_GEOMETRY.ballRadiusM);
  assertAlmostEqual('cushionHeightM', PHYSICS.CUSHION_HEIGHT, TABLE_GEOMETRY.cushionHeightM);
  assertAlmostEqual('cushionThicknessM', PHYSICS.CUSHION_THICKNESS, TABLE_GEOMETRY.cushionThicknessM);
  assertAlmostEqual(
    'effectiveCollisionPlaneOffsetM',
    TABLE_GEOMETRY.effectiveCollisionPlaneOffsetM,
    TABLE_GEOMETRY.ballRadiusM,
  );

  assertAlmostEqual('playfield.minXM', TABLE_PLAYFIELD_BOUNDS.minXM, TABLE_GEOMETRY.effectiveCollisionPlaneOffsetM);
  assertAlmostEqual(
    'playfield.maxXM',
    TABLE_PLAYFIELD_BOUNDS.maxXM,
    config.tableWidthM - TABLE_GEOMETRY.effectiveCollisionPlaneOffsetM,
  );
  assertAlmostEqual('playfield.minYM', TABLE_PLAYFIELD_BOUNDS.minYM, TABLE_GEOMETRY.effectiveCollisionPlaneOffsetM);
  assertAlmostEqual(
    'playfield.maxYM',
    TABLE_PLAYFIELD_BOUNDS.maxYM,
    config.tableHeightM - TABLE_GEOMETRY.effectiveCollisionPlaneOffsetM,
  );

  console.log(
    `PHYS-GEO-QA pass: width=${config.tableWidthM}, height=${config.tableHeightM}, ballRadius=${config.ballRadiusM}`,
  );
}

main();
