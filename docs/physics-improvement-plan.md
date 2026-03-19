# BHC 물리엔진 — 현실과의 차이 분석 및 개선 계획

## Context

3쿠션 당구 게임(bhc)의 물리엔진이 현실 물리와 다르게 동작하는 부분들을 코드 레벨에서 식별하고, 각각에 대해 원인·현실 물리·수정 방법을 정리한 문서. 다른 세션에서 이어서 구현할 수 있도록 상세히 기록.

**참고 문서:**
- `docs/Billiards-Physics-Research_kr.md` — 물리 연구 문서 (공식, 검증 시나리오 정의)
- `tmp/물리엔진비교_Codex.md` — bhc vs bhc2 비교 리포트
- `scripts/compare-physics.ts` — 두 엔진 비교 스크립트 (6개 시나리오)

---

## CRITICAL 1: 팔로우/드로우 샷이 작동하지 않음

### 현상
탑스핀(팔로우)으로 치든 백스핀(드로우)으로 치든, 수구가 목적구 충돌 후 거의 동일하게 움직임. `tmp/물리엔진비교_Codex.md`에서도 `headon-spin-follow-draw` 테스트 FAIL 확인됨.

### 원인 1: 공-공 충돌 시 질량 하드코딩

**파일:** `packages/physics-core/src/room-physics-step.ts` L182-191
```typescript
function applyImpulse(first, second, normalX, normalY): boolean {
  const result = solveBallBallImpulse(first, second, {
    normalX, normalY,
    restitution: ballBallRestitution,
    mass1Kg: 1,    // ← 여기! 0.21kg이어야 함
    mass2Kg: 1,    // ← 여기! 0.21kg이어야 함
    contactFriction: ballBallContactFriction,
    ballRadiusM: ballRadiusM,
  });
  return result.collided;
}
```

**임펄스 솔버 내부 영향** (`solver/impulse-solver.ts` L127-131):
```typescript
const mass = invMass1 > 0 ? 1 / invMass1 : 1;  // mass=1일 때 → 1kg
const inertia = (2 / 5) * mass * radius * radius;
// mass=1.0 → inertia = 0.4 * 1.0 * 0.03075² = 0.000378
// mass=0.21 → inertia = 0.4 * 0.21 * 0.03075² = 0.0000794
// 관성모멘트가 4.76배 과대 → 스핀 전달량 4.76배 과소
```

등질량이므로 법선방향 속도 교환 비율 자체는 정확하지만, **접선 임펄스(스핀 전달) 계산의 관성모멘트가 ~4.76배 잘못됨**.

### 원인 2: 공-공 충돌 시 spinX/spinY 무시

**파일:** `packages/physics-core/src/solver/impulse-solver.ts` L89-153

현재 `solveBallBallImpulse`는 `ImpulseBody2D` 타입을 받으며, 이 타입에는 `spinZ`만 존재 (L1-6):
```typescript
export type ImpulseBody2D = {
  vx: number; vy: number;
  spinZ?: number;  // 좌우 회전(side english)만
};
```

**누락된 것:** spinX(탑/백스핀), spinY(롤링 스핀)가 충돌 시 전혀 고려되지 않음.

현실에서는 접촉점의 상대속도에 모든 스핀 성분이 기여:
```
v_contact = v_linear + ω × r_contact
r_contact = R * n̂ (접촉 법선 방향으로 반지름)
```

### 수정 방법

1. **`room-physics-step.ts` L187-188**: `mass1Kg: config.ballMassKg` 로 변경
   → `resolveBallBallCollisions` 함수 시그니처에 `ballMassKg: number` 파라미터 추가 필요
2. **`solver/impulse-solver.ts`**: `ImpulseBody2D`에 `spinX`, `spinY` 추가, 접촉점 상대속도 계산에 3축 스핀 반영
3. 충돌 후 양 공의 spinX, spinY도 업데이트

**접촉점 상대속도 공식 (3축 스핀 포함):**
```
// 충돌 법선이 (nx, ny)일 때, 접촉점에서의 스핀 기여분:
// ω × R*n = (spinX, spinY, spinZ) × R*(nx, ny, 0)
//         = R * (spinZ*ny, -spinZ*nx, spinX*ny - spinY*nx)  ← z 성분은 2D에서 무시
//
// 접선방향 상대속도에 spinX, spinY의 기여:
// v_slip_tangent += R * (spinX_1*ny - spinY_1*nx) - R * (spinX_2*ny - spinY_2*nx)
```

**z방향 임펄스를 별도 계산해 spinX/spinY 업데이트:**
```typescript
// z방향 상대 슬립
const zRelVel = radius * (spinX_1*ny - spinY_1*nx - spinX_2*ny + spinY_2*nx);
// z방향 유효 컴플라이언스: 2*r²/I = 5/m
const zEffCompliance = (2 * radius * radius) / inertia;
const impulseZ = clamp(-zRelVel / zEffCompliance, -mu*impulseN, mu*impulseN);
// 양 공 동일하게 spinX/spinY 업데이트
const spinXDelta = (5 * ny * impulseZ) / (2 * mass * radius);
const spinYDelta = (-5 * nx * impulseZ) / (2 * mass * radius);
```

---

## CRITICAL 2: 스워브(커브볼)가 구현되지 않음

### 현상
사이드 잉글리시(spinZ)를 줘도 공이 직선으로만 이동. 3쿠션의 핵심 기술인 커브 궤적 불가.

### 원인

**파일:** `packages/physics-core/src/ball-surface-friction.ts` L62-65
```typescript
const vSlipX = vx + radius * spinY;   // spinY(롤링)만 반영
const vSlipY = vy - radius * spinX;   // spinX(롤링)만 반영
// spinZ(수직축 스핀)는 슬립 속도에 전혀 기여하지 않음!
```

**L102-104에서 spinZ는 단순 지수감쇠만:**
```typescript
const spinZDampingFactor = clamp01(1 - spinZDampingPerSec * dt);
spinZ *= spinZDampingFactor;  // 그냥 사라짐, 공 궤적에 영향 없음
```

### 현실 물리
큐를 약간 들고(elevation) 사이드를 치면, 수직축 스핀이 발생. 이 스핀은 천과의 접촉 마찰을 통해 공의 진행 방향에 수직인 힘을 발생시킴 → 곡선 궤적.

### 수정 방법 (Option B — 경험적 스워브 항)

**파일:** `packages/physics-core/src/ball-surface-friction.ts`

슬라이딩 구간(L67-89)에서 스워브 가속도 추가:
```typescript
// 슬라이딩 중일 때만 스워브 적용
if (vSlip > slipThreshold) {
  // ... 기존 마찰 코드 ...

  // 스워브: spinZ가 진행방향에 수직인 힘 생성
  const speed = Math.hypot(vx, vy);
  if (speed > 0.01 && Math.abs(spinZ) > 0.1) {
    const k_swerve = 0.0008;  // 튜닝 필요
    const perpX = -vy / speed;  // 진행방향에 수직
    const perpY = vx / speed;
    vx += k_swerve * spinZ * perpX * dt;
    vy += k_swerve * spinZ * perpY * dt;
  }
}
```

`BallSurfaceFrictionInput`에 `swerveCoefficient?: number` 추가.
`StepRoomPhysicsConfig`에 `swerveCoefficient?: number` 추가.
`room-physics-config.ts`에 `ROOM_PHYSICS_SWERVE_COEFFICIENT = 0.0008` 상수 추가.

---

## CRITICAL 3: 공이 회전 중인데 샷이 끝남

### 현상
선속도 0 + 각속도 높음(spinZ로 제자리 회전) → 턴 종료 판정. 시각적으로 부자연스럽고, 회전으로 인한 미세 이동이 득점에 영향 가능.

### 원인

**파일:** `packages/physics-core/src/shot-end.ts` L4-10
```typescript
export type ShotMotionSample = {
  linearSpeedMps: number;  // 각속도 필드 없음!
};

export function isBelowShotEndThreshold(sample: ShotMotionSample): boolean {
  return sample.linearSpeedMps <= SHOT_END_LINEAR_SPEED_THRESHOLD_MPS;  // 선속도만 체크
}
```

### 수정 방법

```typescript
export type ShotMotionSample = {
  linearSpeedMps: number;
  angularSpeedRadps: number;  // 추가
};

const SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS = 0.2;  // ball-surface-friction의 임계값과 일치

export function isBelowShotEndThreshold(sample: ShotMotionSample): boolean {
  return sample.linearSpeedMps <= SHOT_END_LINEAR_SPEED_THRESHOLD_MPS
      && sample.angularSpeedRadps <= SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS;
}
```

**연쇄 수정 필요:**
- `standalone-simulator.ts` — ShotMotionSample 생성 시 `angularSpeedRadps: maxAngularSpeed` 포함
- `apps/game-server/src/lobby/http.ts` — `areRoomBallsSettled()` 함수에 각속도 체크 추가:
  ```typescript
  const ANGULAR_THRESHOLD = 0.2;
  if (Math.hypot(ball.spinX, ball.spinY, ball.spinZ) >= ANGULAR_THRESHOLD) return false;
  ```

---

## CRITICAL 4: 쿠션 throw 각도 범위가 비현실적 (15도)

### 현상
회전 걸고 쿠션에 느리게 맞췄을 때 반사각 변화가 현실보다 작음.

### 원인

**파일:** `packages/physics-core/src/room-physics-config.ts` L19
```typescript
export const ROOM_PHYSICS_CUSHION_MAX_THROW_ANGLE_DEG = 15;  // 너무 보수적
```

비교: bhc2는 55도 (과도), 현실은 약 25~35도.

### 수정 방법
`ROOM_PHYSICS_CUSHION_MAX_THROW_ANGLE_DEG = 25` 로 변경 후 테스트.
`scripts/compare-physics.ts` 시나리오 5 (side spin + cushion)로 검증.

---

## CRITICAL 5: 무접촉 백스핀 급반전 버그

### 현상
강한 백스핀을 건 공이 다른 공과 충돌 없이 이동하다가, 부드러운 감속 없이 갑자기 방향 전환.

### 원인

**파일:** `packages/physics-core/src/ball-surface-friction.ts` L78-89
```typescript
const nextSlipX = vx + radius * spinY;
const nextSlipY = vy - radius * spinX;
const nextDot = nextSlipX * vSlipX + nextSlipY * vSlipY;
if (nextDot < 0) {
  // 슬립 반전 → 즉시 롤링 조건으로 스냅
  const vxRoll = (5 * vx - 2 * radius * spinY) / 7;
  const vyRoll = (5 * vy + 2 * radius * spinX) / 7;
  vx = vxRoll;  vy = vyRoll;
  spinY = -vx / radius;  spinX = vy / radius;
}
```

서브스텝(~4.17ms)에서 이 전환이 한 프레임에 일어남 → 급격한 방향 변화.

### 수정 방법

슬립이 이번 서브스텝 내에 0에 도달하는 시점 `t*`를 정확히 계산해 전환:

```typescript
// 슬립 감소율: (7/2)*muS*g*dt
const totalSlipDecrease = linearDelta + radius * angularDelta;

if (vSlip <= totalSlipDecrease) {
  // 이번 스텝 내 슬립 소멸 → t*에서 정확히 전환
  const tStar = vSlip / totalSlipDecrease;
  // t*까지 슬라이딩 적용
  vx -= linearDelta * tStar * slipDirX;
  vy -= linearDelta * tStar * slipDirY;
  spinY -= angularDelta * tStar * slipDirX;
  spinX += angularDelta * tStar * slipDirY;
  // 롤링 조건으로 스냅
  vx = (5*vx - 2*radius*spinY) / 7;
  vy = (5*vy + 2*radius*spinX) / 7;
  spinY = -vx / radius;  spinX = vy / radius;
  // 나머지 (1-tStar) 구간은 롤링 마찰 적용
  const dtRemain = dt * (1 - tStar);
  const speedRemain = Math.hypot(vx, vy);
  if (speedRemain > 0) {
    vx *= Math.max(0, speedRemain - muR*g*dtRemain) / speedRemain;
    vy *= Math.max(0, speedRemain - muR*g*dtRemain) / speedRemain;
  }
  spinY = -vx / radius;  spinX = vy / radius;
} else {
  // 슬립이 이번 스텝에서 소멸하지 않음 → 기존 코드 (nextDot 체크 불필요)
  vx -= linearDelta * slipDirX;
  vy -= linearDelta * slipDirY;
  spinY -= angularDelta * slipDirX;
  spinX += angularDelta * slipDirY;
}
```

1. C1 수정 후 재검증 (충돌 시 스핀 전달이 정상화되면 완화 가능)
2. 그래도 문제 시 위 방법 적용

---

## MEDIUM 1: 적분 순서 — 즉시 개선 가능

### 현상
현재 순서 (explicit Euler):
위치 업데이트(L348-349) → 쿠션 체크 → 공-공 충돌 → **마찰 업데이트(L525-541)**

### 수정
마찰(가속도)를 먼저 적용한 후 위치를 업데이트하면 semi-implicit Euler.
`room-physics-step.ts`에서 서브스텝 내 순서만 변경:
1. 마찰 업데이트 (속도 변경)
2. 위치 업데이트 (`ball.x += ball.vx * dt`)
3. 쿠션/충돌 처리

---

## MEDIUM 2: SpinZ 감쇠 모델 비물리적

### 현상
**파일:** `ball-surface-friction.ts` L102-104
```typescript
spinZ *= (1 - 0.15 * dt);  // 지수감쇠 — 속도·상태 무관
```

### 현실
일정 토크 모델: `dωz/dt = -(5·μ_spin·g)/(2R)·sign(ωz)`, μ_spin ≈ 0.01~0.03

### 수정
```typescript
const muSpin = 0.02;
const spinZDecel = (5 * muSpin * g) / (2 * radius);
const spinZReduction = spinZDecel * dt;
if (Math.abs(spinZ) <= spinZReduction) {
  spinZ = 0;
} else {
  spinZ -= Math.sign(spinZ) * spinZReduction;
}
```

---

## MEDIUM 3: 이산 쿠션 감지 (터널링 가능)

### 현상
최대속도 13.89m/s × 서브스텝 0.00417s = **5.8cm/서브스텝** > 공 반지름 3.075cm

### 수정
쿠션에도 공-공과 동일한 sweep 감지 적용. 이전 위치에서 현재 위치까지의 직선이 테이블 경계를 교차하는 시점을 계산:
```
t_hit = (boundary - prev_x) / (curr_x - prev_x)
```
**파일:** `room-physics-step.ts` 쿠션 감지 로직

---

## MEDIUM 4: 코너 처리가 임의적

### 현상
**파일:** `room-physics-step.ts` L483-506 — 고정 감쇠 (spinX/Y × 0.85, spinZ × 0.9)

### 수정
두 번의 연속 쿠션 충돌(`applyCushionContactThrow` 두 번 호출)로 모델링.

---

## MEDIUM 5: 미스큐 임계값 과도하게 관대

### 현상
**파일:** `packages/physics-core/src/miscue.ts` — 0.9R에서 미스큐 발생

### 현실
0.5R 이상에서 점진적 위험 증가, 0.7R 이상에서 높은 확률.

---

## MEDIUM 6: Config 파라미터 4개 미사용

### 현상
`StepRoomPhysicsConfig`에 선언되어 있고 FAH 프로파일에 값이 설정되어 있지만, `stepRoomPhysicsWorld` 루프에서 전혀 참조되지 않는 파라미터:
- `linearDampingPerTick` — 선속도 감쇠
- `spinDampingPerTick` — 스핀 감쇠
- `cushionPostCollisionSpeedScale` — 쿠션 충돌 후 속도 스케일
- `clothLinearSpinCouplingPerSec` — 천-스핀 결합 계수

### 원인

**파일:** `packages/physics-core/src/room-physics-step.ts`

해당 필드들이 config 타입과 FAH 프로파일에는 존재하지만, 실제 물리 루프(`stepRoomPhysicsWorld`)에서 사용되지 않음. 설정값이 게임에 반영되지 않으므로 튜닝 효과가 없음.

### 수정 방법

1. `room-physics-step.ts` 내 각 파라미터 사용 위치를 확인하고, 해당 로직(감쇠 적용, 쿠션 후처리 등)에 config 값을 참조하도록 수정.
2. 또는 의도적으로 제거할 파라미터라면 `StepRoomPhysicsConfig` 타입 및 FAH 프로파일에서도 삭제하여 혼선 방지.

---

## MEDIUM 7: 저속 쿠션 충돌 에너지 주입

### 현상
공이 매우 느린 속도(예: 0.02 m/s)로 쿠션에 접근할 때, 반발 후 속도가 오히려 **증가**하는 에너지 생성 버그. 예:
- 접근 속도: 0.02 m/s → 반발 후: **0.06 m/s** (3배 증가)

공이 쿠션 근처에서 멈추지 않고 이상하게 튕겨 나오거나 진동하는 현상 발생 가능.

### 원인

**파일:** `packages/physics-core/src/room-physics-step.ts` L304, L406~413

```typescript
const minCushionReleaseNormalSpeedMps = 0.06;
// ...
if (normalSpeedOut < minCushionReleaseNormalSpeedMps) {
  normalSpeedOut = minCushionReleaseNormalSpeedMps;  // 저속일 때 최솟값으로 강제 상향
}
```

`minCushionReleaseNormalSpeedMps = 0.06`으로 인해, 반발 후 법선 속도가 0.06 m/s보다 작으면 0.06 m/s로 강제 올림. 이는 에너지 보존 원칙을 위반함.

### 수정 방법

1. **단순 수정:** `minCushionReleaseNormalSpeedMps`를 0 또는 매우 작은 값(예: 0.001)으로 변경.
2. **물리적 수정:** 최솟값 클램프 대신, 쿠션 restitution이 너무 낮을 때 자연스럽게 멈추도록 허용. 반발 계수(`cushionRestitution`)만으로 속도를 결정:
   ```typescript
   // normalSpeedOut = normalSpeedIn * cushionRestitution (이미 위에서 계산됨)
   // minCushionReleaseNormalSpeedMps 클램프 제거
   ```
3. 변경 후 **에너지 단조감소** 검증 (아래 검증 방법 4번 항목) 필수.

---

## LOW (지연 가능)

| 항목 | 설명 |
|------|------|
| 천 비등방성(Nap) | 천의 결 방향에 따라 마찰이 다름 |
| 큐 샤프트 휨 | squirt 정확도에 영향 |
| 마세/점프 샷 | 순수 2D이므로 불가 |
| 온도/습도 | 마찰 계수에 영향 |

---

## 구현 우선순위

| 순서 | 항목 | 난이도 | 수정 파일 |
|------|------|--------|-----------|
| 1 | **C1** 팔로우/드로우 | 높 | `impulse-solver.ts`, `room-physics-step.ts` |
| 2 | **C3** 샷 종료 각속도 | 낮 | `shot-end.ts`, `standalone-simulator.ts`, `http.ts` |
| 3 | **C4** 쿠션 throw 25도 | 낮 | `room-physics-config.ts` |
| 4 | **M7** 저속 쿠션 에너지 주입 | 낮 | `room-physics-step.ts` |
| 5 | **C5** 백스핀 반전 | 중 | `ball-surface-friction.ts` |
| 6 | **C2** 스워브 | 높 | `ball-surface-friction.ts`, `room-physics-config.ts` |
| 7 | **M1** 적분 순서 | 낮 | `room-physics-step.ts` |
| 8 | **M2** SpinZ 감쇠 | 낮 | `ball-surface-friction.ts` |
| 9 | **M3** 쿠션 sweep | 중 | `room-physics-step.ts` |
| 10 | **M6** Config 파라미터 미사용 | 낮 | `room-physics-step.ts` |

---

## 검증 방법

1. **compare-physics.ts 실행**: `npx tsx scripts/compare-physics.ts` — 6개 시나리오 before/after 비교
2. **웹 테스트 페이지**: `/test` 경로의 내장 7개 시나리오로 시각적 확인
3. **팔로우/드로우 검증**: 정면 충돌 + 탑스핀 → 수구 전진 확인, 백스핀 → 수구 후진 확인
4. **에너지 단조감소**: 반복 쿠션 충돌 시 총 운동에너지가 증가하지 않는지 확인
5. **스워브 검증**: 사이드 잉글리시 + 느린 샷 → 곡선 궤적 확인
