import { TABLE_GEOMETRY } from '../../../../packages/shared-types/src/table-geometry.ts';

// 물리 상수 (Physics-Spec.md 기준)
export const PHYSICS = {
  // 공
  BALL_DIAMETER: TABLE_GEOMETRY.ballDiameterM,
  BALL_RADIUS: TABLE_GEOMETRY.ballRadiusM,
  BALL_MASS: 0.21,
  
  // 테이블 (내경)
  TABLE_WIDTH: TABLE_GEOMETRY.tableInnerWidthM,
  TABLE_HEIGHT: TABLE_GEOMETRY.tableInnerHeightM,
  TABLE_OUTER_WIDTH: TABLE_GEOMETRY.tableOuterWidthM,
  TABLE_OUTER_HEIGHT: TABLE_GEOMETRY.tableOuterHeightM,
  CUSHION_HEIGHT: TABLE_GEOMETRY.cushionHeightM,
  CUSHION_THICKNESS: TABLE_GEOMETRY.cushionThicknessM,
  COLLISION_PLANE_OFFSET: TABLE_GEOMETRY.effectiveCollisionPlaneOffsetM,
  
  // 큐
  CUE_MASS: 0.5,
  TIP_RESTITUTION: 0.7,
  
  // 반발계수
  BALL_BALL_RESTITUTION: 0.95,
  BALL_CUSHION_RESTITUTION: 0.72,
  
  // 마찰
  SLIDING_FRICTION: 0.20,
  ROLLING_FRICTION: 0.012,
  CUSHION_FRICTION: 0.14,
  
  // 미스큐
  MISCUE_SAFE_RATIO: 0.5,
  MISCUE_CERTAIN_RATIO: 0.85,
  
  // 샷 속도 매핑
  MIN_DRAG_PX: 10,
  MAX_DRAG_PX: 400,
  MIN_SPEED_MPS: 1.0,
  MAX_SPEED_MPS: 13.89, // 50 km/h
} as const;

// 게임 규칙
export const RULES = {
  WINNING_SCORE: 10,
  REQUIRED_CUSHIONS: 3,
  TURN_TIMEOUT_SEC: 20,
  MAX_PLAYERS: 6,
} as const;

// 입력 범위
export const INPUT_LIMITS = {
  DIRECTION_MIN: 0,
  DIRECTION_MAX: 360,
  ELEVATION_MIN: 0,
  ELEVATION_MAX: 89,
  DRAG_MIN: 10,
  DRAG_MAX: 400,
  OFFSET_MAX: TABLE_GEOMETRY.ballRadiusM, // 공 반지름
} as const;

// 색상
export const COLORS = {
  CUE_BALL: 0xffffff,
  OBJECT_BALL_1: 0xff0000,
  OBJECT_BALL_2: 0xffd700,
  TABLE_CLOTH: 0x2d8a4e,
  TABLE_RAIL: 0x8B4513,
  CUSHION: 0x2d5a2d,
  CUE_STICK: 0xd4a574,
  GUIDE_LINE: 0x00ff88,
} as const;
