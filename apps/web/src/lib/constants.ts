// 물리 상수 (Physics-Spec.md 기준)
export const PHYSICS = {
  // 공
  BALL_DIAMETER: 0.0615,
  BALL_RADIUS: 0.03075,
  BALL_MASS: 0.21,
  
  // 테이블 (납작 크기)
  TABLE_WIDTH: 2.844,
  TABLE_HEIGHT: 1.422,
  TABLE_OUTER_WIDTH: 3.100,
  TABLE_OUTER_HEIGHT: 1.700,
  CUSHION_HEIGHT: 0.037,
  CUSHION_THICKNESS: 0.05,  // 쿠션 두께 (약 5cm)
  
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
  MISCUE_THRESHOLD_RATIO: 0.9,
  
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
  TURN_TIMEOUT_SEC: 10,
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
  OFFSET_MAX: 0.03075, // 공 반지름
} as const;

// 색상
export const COLORS = {
  CUE_BALL: 0xffffff,      // 흰색 (수구)
  OBJECT_BALL_1: 0xff0000, // 선명한 빨강 (제1적구)
  OBJECT_BALL_2: 0xffd700, // 선명한 금색/노랑 (제2적구)
  TABLE_CLOTH: 0x231fa7,
  TABLE_RAIL: 0x3c3b49,
  CUSHION: 0x1c2ba2,
  CUE_STICK: 0xd4a574,
  GUIDE_LINE: 0x00ff88,
} as const;
