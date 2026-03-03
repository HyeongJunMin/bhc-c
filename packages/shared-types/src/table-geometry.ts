export const TABLE_GEOMETRY = {
  tableInnerWidthM: 2.844,
  tableInnerHeightM: 1.422,
  tableOuterWidthM: 3.1,
  tableOuterHeightM: 1.7,
  cushionHeightM: 0.037,
  cushionThicknessM: 0.05,
  ballDiameterM: 0.0615,
  ballRadiusM: 0.0615 / 2,
  // 실제 충돌 판정은 쿠션 내부면에서 공 반지름만큼 inset된 평면을 기준으로 한다.
  effectiveCollisionPlaneOffsetM: 0.0615 / 2,
} as const;

export const TABLE_PLAYFIELD_BOUNDS = {
  minXM: TABLE_GEOMETRY.effectiveCollisionPlaneOffsetM,
  maxXM: TABLE_GEOMETRY.tableInnerWidthM - TABLE_GEOMETRY.effectiveCollisionPlaneOffsetM,
  minYM: TABLE_GEOMETRY.effectiveCollisionPlaneOffsetM,
  maxYM: TABLE_GEOMETRY.tableInnerHeightM - TABLE_GEOMETRY.effectiveCollisionPlaneOffsetM,
} as const;
