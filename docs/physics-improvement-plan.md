# BHC 물리엔진 — 현실과의 차이 분석 및 개선 계획

## Context

3쿠션 당구 게임(bhc)의 물리엔진이 현실 물리와 다르게 동작하는 부분들을 코드 레벨에서 식별하고, 각각에 대해 원인·현실 물리·수정 방법을 정리한 문서. 다른 세션에서 이어서 구현할 수 있도록 상세히 기록.

**참고 문서:**
- `docs/Billiards-Physics-Research_kr.md` — 물리 연구 문서 (공식, 검증 시나리오 정의)
- `tmp/물리엔진비교_Codex.md` — bhc vs bhc2 비교 리포트
- `scripts/compare-physics.ts` — 두 엔진 비교 스크립트 (6개 시나리오)

**컨텍스트 관리 가이드:**
- 각 태스크는 Sonnet 컨텍스트 윈도우 60% (~120K tokens) 이내로 수행 가능하도록 설계됨
- 태스크 시작 시 해당 섹션만 참조하고, 수정 대상 파일만 로드할 것
- 태스크 간 의존성이 있는 경우 `[선행: Tx.y]` 표기

---

## CRITICAL 1: 팔로우/드로우 샷이 작동하지 않음

### 현상
탑스핀(팔로우)으로 치든 백스핀(드로우)으로 치든, 수구가 목적구 충돌 후 거의 동일하게 움직임. `tmp/물리엔진비교_Codex.md`에서도 `headon-spin-follow-draw` 테스트 FAIL 확인됨.

### 원인 1: 공-공 충돌 시 질량 하드코딩

**파일:** `packages/physics-core/src/room-physics-step.ts` L182-191

`applyImpulse` 함수에서 `mass1Kg: 1, mass2Kg: 1`로 하드코딩. 실제 당구공 질량은 0.21kg.
등질량이므로 법선방향 속도 교환 비율은 정확하지만, 관성모멘트 `I = (2/5)mR²`가 4.76배 과대 계산되어 **접선 임펄스(스핀 전달)가 4.76배 과소**.

### 원인 2: 공-공 충돌 시 spinX/spinY 무시

**파일:** `packages/physics-core/src/solver/impulse-solver.ts` L1-6

`ImpulseBody2D` 타입에 `spinZ`만 존재. spinX(탑/백스핀), spinY(롤링 스핀)가 충돌 시 전혀 고려되지 않음. 현실에서는 접촉점의 상대속도에 모든 스핀 성분이 기여.

### 태스크 분할

#### Task C1.1: 공-공 충돌 질량 하드코딩 수정
- **난이도:** 낮
- **수정 파일:** `packages/physics-core/src/room-physics-step.ts`
- **예상 컨텍스트:** ~20K tokens (파일 1개 + 대화)

**작업 내용:**
1. `room-physics-step.ts` L187-188의 `mass1Kg: 1, mass2Kg: 1`을 `mass1Kg: ballMassKg, mass2Kg: ballMassKg`로 변경
2. `resolveBallBallCollisions` 함수 파라미터에서 `ballMassKg`가 전달되는지 확인 (이미 config에 `ballMassKg: 0.21` 존재)
3. `applyImpulse` 클로저가 외부 스코프의 config 값을 참조하도록 수정

**검증:**
- `npx tsx scripts/compare-physics.ts` 실행 → 스핀 전달량 변화 확인
- 기존 테스트 시나리오에서 충돌 후 속도 교환이 깨지지 않는지 확인 (법선 방향은 변화 없어야 함)

#### Task C1.2: ImpulseBody2D에 spinX/spinY 추가 및 접촉점 상대속도 3축 반영
- **난이도:** 높
- **선행:** C1.1 완료 권장 (질량 정상화 후 스핀 효과가 정확해짐)
- **수정 파일:** `packages/physics-core/src/solver/impulse-solver.ts`
- **참조 파일:** `packages/physics-core/src/room-physics-step.ts` (호출부 확인용)
- **예상 컨텍스트:** ~40K tokens (파일 2개 + 수학 공식 + 대화)

**작업 내용:**

1. `ImpulseBody2D` 타입 확장 (L1-6):
```typescript
export type ImpulseBody2D = {
  vx: number; vy: number;
  spinX?: number;  // 탑/백스핀 (Y축 롤링)
  spinY?: number;  // X축 롤링
  spinZ?: number;  // 수직축 사이드 잉글리시
};
```

2. `solveBallBallImpulse` 함수 (L89-153) 수정:
   - 접촉점 상대속도에 spinX, spinY 기여분 추가:
     ```
     v_slip_tangent += R * (spinX_1*ny - spinY_1*nx) - R * (spinX_2*ny - spinY_2*nx)
     ```
   - z방향(테이블 수직) 상대 슬립 별도 계산:
     ```
     zRelVel = R * (spinX_1*ny - spinY_1*nx - spinX_2*ny + spinY_2*nx)
     ```
   - z방향 임펄스를 쿨롱 마찰 한도 내에서 계산
   - 반환 타입 `BallBallImpulseResult`에 `spinXDelta`, `spinYDelta` 추가

3. `BallBallImpulseResult` 타입 확장:
```typescript
export type BallBallImpulseResult = {
  collided: boolean;
  impulseN: number;
  tangentialImpulse: number;
  spinXDelta?: number;  // 추가
  spinYDelta?: number;  // 추가
};
```

**핵심 수학:**
```
// 충돌 법선이 (nx, ny)일 때:
// ω × R*n = (spinX, spinY, spinZ) × R*(nx, ny, 0)
//         = R * (spinZ*ny, -spinZ*nx, spinX*ny - spinY*nx)
//
// z방향 유효 컴플라이언스: 2*r²/I = 5/m
// impulseZ = clamp(-zRelVel / zEffCompliance, -mu*impulseN, mu*impulseN)
// spinXDelta = (5 * ny * impulseZ) / (2 * mass * radius)
// spinYDelta = (-5 * nx * impulseZ) / (2 * mass * radius)
```

**검증:**
- 정면 충돌(nx=1, ny=0) + 탑스핀(spinX > 0) → 수구가 충돌 후 전진(팔로우)
- 정면 충돌 + 백스핀(spinX < 0) → 수구가 충돌 후 후진(드로우)
- 사이드 충돌에서도 스핀 전달이 자연스러운지 확인

#### Task C1.3: 충돌 호출부에서 spinX/spinY 전달 및 업데이트
- **난이도:** 중
- **선행:** C1.2 완료 필수
- **수정 파일:** `packages/physics-core/src/room-physics-step.ts`
- **예상 컨텍스트:** ~30K tokens

**작업 내용:**
1. `applyImpulse` 함수 (L182-191)에서 `solveBallBallImpulse` 호출 시 `first`/`second` 객체에 `spinX`, `spinY` 포함:
   - 현재 `first`/`second`는 `ImpulseBody2D` 타입 → 확장된 타입에 맞게 spinX, spinY 전달
   - 볼 데이터에서 `ball.spinX`, `ball.spinY` 참조

2. 충돌 결과의 `spinXDelta`, `spinYDelta`를 양 공에 적용:
   - `first.spinX += result.spinXDelta`
   - `first.spinY += result.spinYDelta`
   - `second.spinX -= result.spinXDelta`
   - `second.spinY -= result.spinYDelta`

3. `resolveBallBallCollisions` 내부에서 공 데이터 구조가 spinX/spinY를 직접 mutate 가능한지 확인

**검증:**
- `npx tsx scripts/compare-physics.ts` — headon-spin-follow-draw 시나리오 PASS 확인
- 웹 테스트 `/test` → 팔로우/드로우 시나리오 시각적 확인
- 에너지 단조감소 확인 (충돌 전후 총 운동에너지 + 회전에너지)

---

## CRITICAL 2: 스워브(커브볼)가 구현되지 않음

### 현상
사이드 잉글리시(spinZ)를 줘도 공이 직선으로만 이동. 3쿠션의 핵심 기술인 커브 궤적 불가.

### 원인
**파일:** `packages/physics-core/src/ball-surface-friction.ts` L62-65

`vSlipX/vSlipY` 계산에 spinZ가 빠져 있음. L102-104에서 spinZ는 단순 지수감쇠만 적용되어 궤적에 영향을 주지 않음.

### 태스크 분할

#### Task C2.1: 스워브 가속도 로직 구현
- **난이도:** 중
- **수정 파일:** `packages/physics-core/src/ball-surface-friction.ts`
- **예상 컨텍스트:** ~25K tokens

**작업 내용:**
1. `BallSurfaceFrictionInput` 타입에 `swerveCoefficient?: number` 추가 (L3-18)
2. 슬라이딩 구간 (L67-89) 내에서 스워브 가속도 추가:
```typescript
// spinZ가 진행방향에 수직인 힘 생성 (Marlow swerve model)
const speed = Math.hypot(vx, vy);
if (speed > 0.01 && Math.abs(spinZ) > 0.1) {
  const k_swerve = swerveCoefficient ?? 0.0008;
  const perpX = -vy / speed;  // 진행방향에 수직
  const perpY = vx / speed;
  vx += k_swerve * spinZ * perpX * dt;
  vy += k_swerve * spinZ * perpY * dt;
}
```
3. 슬라이딩이 아닌 롤링 구간에서도 스워브 적용 여부 검토 (현실에서는 롤링 시에도 spinZ 잔존하면 약한 커브 발생)

**주의사항:**
- 스워브는 슬라이딩 상태에서만 강하게 나타남 (천과의 미끄럼 마찰이 횡력 생성)
- 롤링 상태에서는 spinZ가 이미 거의 소멸되어 있으므로 무시해도 됨
- `k_swerve` 계수는 튜닝 필요 — 너무 크면 비현실적 커브

#### Task C2.2: 스워브 Config 연결 및 튜닝
- **난이도:** 낮
- **선행:** C2.1 완료 필수
- **수정 파일:** `packages/physics-core/src/room-physics-config.ts`, `packages/physics-core/src/room-physics-step.ts`
- **예상 컨텍스트:** ~25K tokens

**작업 내용:**
1. `room-physics-config.ts`에 상수 추가:
   ```typescript
   export const ROOM_PHYSICS_SWERVE_COEFFICIENT = 0.0008;
   ```
2. `StepRoomPhysicsConfig` 타입에 `swerveCoefficient` 필드 추가 (L48-92)
3. `createRoomPhysicsStepConfig` 함수에서 기본값 설정
4. `room-physics-step.ts`의 `applyBallSurfaceFriction` 호출부에서 config 값 전달

**검증:**
- 사이드 잉글리시(spinZ ≠ 0) + 느린 샷 → 곡선 궤적 확인
- `k_swerve = 0`일 때 기존 동작과 동일한지 확인 (회귀 테스트)
- 웹 테스트 `/test` → 사이드 스핀 시나리오 시각적 확인

---

## CRITICAL 3: 공이 회전 중인데 샷이 끝남

### 현상
선속도 0 + 각속도 높음(spinZ로 제자리 회전) → 턴 종료 판정. 시각적으로 부자연스럽고, 회전으로 인한 미세 이동이 득점에 영향 가능.

### 원인
**파일:** `packages/physics-core/src/shot-end.ts` L4-10 — `ShotMotionSample`에 `linearSpeedMps`만 존재, 각속도 미체크.

### 태스크 (단일)

#### Task C3.1: 샷 종료 조건에 각속도 체크 추가
- **난이도:** 낮
- **수정 파일 3개:**
  - `packages/physics-core/src/shot-end.ts`
  - `packages/physics-core/src/standalone-simulator.ts`
  - `apps/game-server/src/lobby/http.ts`
- **예상 컨텍스트:** ~30K tokens (파일 3개 모두 짧음)

**작업 내용:**

1. **`shot-end.ts`** (43줄):
   - `ShotMotionSample` 타입에 `angularSpeedRadps: number` 추가
   - 상수 추가: `SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS = 0.2` (ball-surface-friction의 stationaryAngularThresholdRadps와 일치)
   - `isBelowShotEndThreshold` 수정:
     ```typescript
     return sample.linearSpeedMps <= SHOT_END_LINEAR_SPEED_THRESHOLD_MPS
         && sample.angularSpeedRadps <= SHOT_END_ANGULAR_SPEED_THRESHOLD_RADPS;
     ```

2. **`standalone-simulator.ts`** (43줄):
   - `ShotMotionSample` 생성부에서 `angularSpeedRadps: Math.hypot(ball.spinX, ball.spinY, ball.spinZ)` 추가
   - `SimFrameBall` 타입에 이미 spin 값들이 있는지 확인, 없으면 추가

3. **`http.ts`** L571-581 `areRoomBallsSettled()`:
   - 기존 선속도 체크에 각속도 체크 추가:
     ```typescript
     const ANGULAR_THRESHOLD = 0.2;
     if (Math.hypot(ball.spinX, ball.spinY, ball.spinZ) >= ANGULAR_THRESHOLD) return false;
     ```

**검증:**
- 사이드 스핀만 강하게 건 샷 → 공이 제자리 회전 중일 때 샷이 끝나지 않는지 확인
- 일반 샷에서 샷 종료 지연이 과도하지 않은지 확인 (0.2 rad/s는 매우 느린 회전)

---

## CRITICAL 4: 쿠션 throw 각도 범위가 비현실적 (15도)

### 현상
회전 걸고 쿠션에 느리게 맞췄을 때 반사각 변화가 현실보다 작음.

### 원인
**파일:** `packages/physics-core/src/room-physics-config.ts` L19 — `ROOM_PHYSICS_CUSHION_MAX_THROW_ANGLE_DEG = 15` (현실 25~35도)

### 태스크 (단일)

#### Task C4.1: 쿠션 throw 각도 상수 변경
- **난이도:** 매우 낮
- **수정 파일:** `packages/physics-core/src/room-physics-config.ts`
- **예상 컨텍스트:** ~10K tokens

**작업 내용:**
1. L19: `ROOM_PHYSICS_CUSHION_MAX_THROW_ANGLE_DEG = 15` → `25`로 변경

**검증:**
- `npx tsx scripts/compare-physics.ts` 시나리오 5 (side spin + cushion) → 반사각 변화 확인
- 25도에서 과도하면 20도로 하향, 부족하면 30도로 상향 (현실 범위: 25~35도)

---

## CRITICAL 5: 무접촉 백스핀 급반전 버그

### 현상
강한 백스핀을 건 공이 다른 공과 충돌 없이 이동하다가, 부드러운 감속 없이 갑자기 방향 전환.

### 원인
**파일:** `packages/physics-core/src/ball-surface-friction.ts` L78-89

슬립 반전 감지(`nextDot < 0`) 후 즉시 롤링 조건으로 스냅. 서브스텝(~4.17ms) 내에서 한 프레임에 전환이 일어나 급격한 방향 변화.

### 태스크 분할

#### Task C5.1: 슬립 소멸 시점 정밀 계산 및 부드러운 전환
- **난이도:** 중
- **수정 파일:** `packages/physics-core/src/ball-surface-friction.ts`
- **선행:** C1 수정 후 재검증 권장 (충돌 시 스핀 전달 정상화 후 완화 가능)
- **예상 컨텍스트:** ~25K tokens

**작업 내용:**

`ball-surface-friction.ts` L67-89 슬라이딩 구간의 슬립 반전 로직을 교체:

1. 기존 `nextDot < 0` 체크 (L78-89) 제거
2. 슬립 소멸 시점 `t*` 계산으로 교체:
```typescript
const totalSlipDecrease = linearDelta + radius * angularDelta;

if (vSlip <= totalSlipDecrease) {
  // 이번 서브스텝 내에 슬립 소멸 → t*에서 정확히 전환
  const tStar = vSlip / totalSlipDecrease;

  // t*까지 슬라이딩 마찰 적용
  vx -= linearDelta * tStar * slipDirX;
  vy -= linearDelta * tStar * slipDirY;
  spinY -= angularDelta * tStar * slipDirX;
  spinX += angularDelta * tStar * slipDirY;

  // 롤링 조건으로 스냅
  vx = (5*vx - 2*radius*spinY) / 7;
  vy = (5*vy + 2*radius*spinX) / 7;
  spinY = -vx / radius;
  spinX = vy / radius;

  // 나머지 (1 - tStar) 구간은 롤링 마찰 적용
  const dtRemain = dt * (1 - tStar);
  const speedRemain = Math.hypot(vx, vy);
  if (speedRemain > 0) {
    const factor = Math.max(0, speedRemain - muR * g * dtRemain) / speedRemain;
    vx *= factor;
    vy *= factor;
  }
  spinY = -vx / radius;
  spinX = vy / radius;
} else {
  // 슬립이 이번 스텝에서 소멸하지 않음 → 일반 슬라이딩 마찰
  vx -= linearDelta * slipDirX;
  vy -= linearDelta * slipDirY;
  spinY -= angularDelta * slipDirX;
  spinX += angularDelta * slipDirY;
}
```

**주의사항:**
- `linearDelta`는 L70: `muS * g * dt`
- `angularDelta`는 L71: `(5 * muS * g) / (2 * radius) * dt`
- `slipDirX = vSlipX / vSlip`, `slipDirY = vSlipY / vSlip` (L68-69)
- 기존 L90-100 롤링 구간 코드는 유지

**검증:**
- 강한 백스핀 샷 → 부드러운 감속 후 역방향 이동 확인 (급반전 없어야 함)
- 약한 백스핀 → 정지 확인 (역방향 이동 없이 멈춤)
- 일반 샷(스핀 없음) → 기존과 동일한 동작

---

## MEDIUM 1: 적분 순서 — 즉시 개선 가능

### 현상
현재 순서 (explicit Euler): 위치 업데이트 → 쿠션 체크 → 공-공 충돌 → 마찰 업데이트

### 태스크 (단일)

#### Task M1.1: Semi-implicit Euler로 적분 순서 변경
- **난이도:** 낮
- **수정 파일:** `packages/physics-core/src/room-physics-step.ts`
- **예상 컨텍스트:** ~30K tokens (파일이 612줄로 길지만 구조 파악 후 블록 이동)

**작업 내용:**

`stepRoomPhysicsWorld` 내 서브스텝 루프에서 순서 변경:

현재 순서 (L307-591):
1. L348-349: 위치 업데이트 (`ball.x += ball.vx * dt`)
2. L352-481: 쿠션 충돌 감지 및 처리
3. L509-517: 공-공 충돌 처리
4. L519-576: 표면 마찰 적용

변경 후 순서:
1. **표면 마찰 적용** (속도 변경) — 기존 L519-576 블록을 위치 업데이트 앞으로 이동
2. **위치 업데이트** (`ball.x += ball.vx * dt`)
3. **쿠션 충돌** 감지 및 처리
4. **공-공 충돌** 처리

**주의사항:**
- 마찰 블록 이동 시 변수 스코프 문제 확인
- prevPositions 저장(L309)은 위치 업데이트 전에 유지
- NaN 가드(L311-341)는 맨 앞에 유지

**검증:**
- 기존 시나리오 전체 실행 → 결과가 크게 달라지지 않아야 함 (미세한 정확도 개선)
- 에너지 단조감소 확인

---

## MEDIUM 2: SpinZ 감쇠 모델 비물리적

### 현상
`ball-surface-friction.ts` L102-104에서 spinZ가 지수감쇠 (`spinZ *= 1 - 0.15 * dt`). 속도·상태 무관하게 일정 비율로 감소.

### 태스크 (단일)

#### Task M2.1: SpinZ 일정 토크 감쇠 모델로 교체
- **난이도:** 낮
- **수정 파일:** `packages/physics-core/src/ball-surface-friction.ts`
- **예상 컨텍스트:** ~15K tokens

**작업 내용:**

L102-104 교체:
```typescript
// 기존: spinZ *= (1 - spinZDampingPerSec * dt);
// 신규: 일정 토크 모델
const muSpin = 0.02;  // 스핀 마찰 계수 (0.01~0.03 범위)
const spinZDecel = (5 * muSpin * g) / (2 * radius);
const spinZReduction = spinZDecel * dt;
if (Math.abs(spinZ) <= spinZReduction) {
  spinZ = 0;
} else {
  spinZ -= Math.sign(spinZ) * spinZReduction;
}
```

**선택사항:** `BallSurfaceFrictionInput`에 `spinFriction?: number` (default 0.02) 추가하여 config에서 튜닝 가능하게 할 것.

**검증:**
- 높은 spinZ → 선형 감쇠 확인 (지수감쇠가 아닌 일정 속도로 감소)
- spinZ가 0 근처에서 진동하지 않고 깔끔하게 0에 도달

---

## MEDIUM 3: 이산 쿠션 감지 (터널링 가능)

### 현상
최대속도 13.89m/s × 서브스텝 0.00417s = **5.8cm/서브스텝** > 공 반지름 3.075cm → 쿠션 관통 가능.

### 태스크 (단일)

#### Task M3.1: 쿠션 sweep 감지 구현
- **난이도:** 중
- **수정 파일:** `packages/physics-core/src/room-physics-step.ts`
- **예상 컨텍스트:** ~35K tokens

**작업 내용:**

현재 쿠션 감지 (L352, L418)는 위치 업데이트 후 경계 침투 여부만 확인. 이를 sweep 기반으로 교체:

1. 이전 위치(`prevX`, `prevY`)에서 현재 위치(`ball.x`, `ball.y`)까지의 경로에서 경계 교차 시점 계산:
```typescript
// X축 쿠션 (좌/우)
const leftBoundary = ballRadiusM;
const rightBoundary = tableWidthM - ballRadiusM;

// 왼쪽 쿠션 관통 체크
if (prevX > leftBoundary && ball.x <= leftBoundary) {
  const tHit = (leftBoundary - prevX) / (ball.x - prevX);
  // tHit 시점으로 되감기 → 쿠션 충돌 처리 → 남은 시간 진행
}
// 오른쪽 쿠션도 동일 패턴

// Y축 쿠션 (상/하) 동일 패턴
```

2. `prevPositions` 배열은 이미 L309에서 저장하고 있으므로 활용

**주의사항:**
- 기존 경계 클램프 로직(L358 등)은 sweep 감지 실패 시 폴백으로 유지
- 코너 근처에서 X/Y 동시 교차 시 더 이른 교차를 먼저 처리
- 속도가 충분히 느린 경우(이동 거리 < 반지름) sweep 불필요 → 기존 로직 사용

**검증:**
- 최대 속도(13.89 m/s)로 쿠션에 비스듬히 접근 → 관통 없이 반사
- 저속에서 기존과 동일한 동작 확인

---

## MEDIUM 4: 코너 처리가 임의적

### 현상
**파일:** `room-physics-step.ts` L484-506 — 고정 감쇠 (spinX/Y × 0.85, spinZ × 0.9)로 처리.

### 태스크 (단일)

#### Task M4.1: 코너를 두 번의 쿠션 충돌로 모델링
- **난이도:** 중
- **수정 파일:** `packages/physics-core/src/room-physics-step.ts`
- **참조 파일:** `packages/physics-core/src/cushion-contact-throw.ts` (applyCushionContactThrow 함수)
- **예상 컨텍스트:** ~35K tokens

**작업 내용:**

L484-506 코너 처리 블록을 교체:

1. 현재: `hitX && hitY`일 때 고정 감쇠 적용
2. 변경: `applyCushionContactThrow`를 X축, Y축 순서로 2회 호출
```typescript
if (hitX && hitY) {
  // X축 쿠션 충돌 먼저 처리
  applyCushionContactThrow(ball, 'x', cushionConfig);
  // Y축 쿠션 충돌 처리
  applyCushionContactThrow(ball, 'y', cushionConfig);
  // 고정 감쇠 제거
}
```

**주의사항:**
- 두 번 호출 순서가 결과에 영향 → 먼저 맞는 축을 판별해야 할 수 있음
- 에너지가 과도하게 손실되지 않는지 확인

**검증:**
- 코너에 비스듬히 맞추는 샷 → 자연스러운 반사 확인
- 코너 근처에서 에너지 보존 (급격한 속도 손실/증가 없음)

---

## MEDIUM 5: 미스큐 임계값 과도하게 관대

### 현상
**파일:** `packages/physics-core/src/miscue.ts` — 0.9R에서 미스큐 발생. 현실은 0.5R부터 위험 증가, 0.7R 이상에서 높은 확률.

### 태스크 (단일)

#### Task M5.1: 미스큐 확률 모델 도입
- **난이도:** 낮
- **수정 파일:** `packages/physics-core/src/miscue.ts`
- **예상 컨텍스트:** ~10K tokens

**작업 내용:**

현재 (12줄): `offsetDistance > 0.9 * R` → 100% 미스큐

변경 옵션:

**Option A (단순):** 임계값만 변경
```typescript
export const MISCUE_THRESHOLD_RATIO = 0.7;  // 0.9 → 0.7
```

**Option B (확률적):** 점진적 확률 증가
```typescript
export function isMiscue(impactOffsetX: number, impactOffsetY: number, cueBallRadiusM = CUE_BALL_RADIUS_M): boolean {
  const ratio = Math.hypot(impactOffsetX, impactOffsetY) / cueBallRadiusM;
  if (ratio <= 0.5) return false;          // 안전 영역
  if (ratio >= 0.85) return true;          // 확정 미스큐
  // 0.5~0.85 구간: 확률적 (ratio가 클수록 높음)
  const probability = (ratio - 0.5) / (0.85 - 0.5);  // 0~1 선형
  return Math.random() < probability * probability;   // 제곱으로 가속
}
```

**검증:**
- 다양한 offset에서 미스큐 발생 빈도 확인
- 0.5R 이하에서는 절대 미스큐 없음 확인

---

## MEDIUM 6: Config 파라미터 미사용

### 현상
`StepRoomPhysicsConfig`에 선언되어 있고 FAH 프로파일에 값이 있지만, `stepRoomPhysicsWorld`에서 전혀 참조되지 않는 파라미터:
- `linearDampingPerTick` — 선속도 감쇠
- `spinDampingPerTick` — 스핀 감쇠
- `cushionPostCollisionSpeedScale` — 쿠션 충돌 후 속도 스케일
- `clothLinearSpinCouplingPerSec` — 천-스핀 결합 계수
- `cushionSpinMonotonicEnabled` — 쿠션 스핀 단조감소 활성화
- `cushionSpinMonotonicRetention` — 쿠션 스핀 유지율

### 태스크 (단일)

#### Task M6.1: 미사용 Config 파라미터 활성화 또는 제거
- **난이도:** 낮~중 (활성화 시 중)
- **수정 파일:** `packages/physics-core/src/room-physics-step.ts`, `packages/physics-core/src/room-physics-config.ts`
- **예상 컨텍스트:** ~35K tokens

**작업 내용 — 활성화 방향:**

1. **`linearDampingPerTick`**: 서브스텝마다 `ball.vx *= linearDampingPerTick^(1/substeps)` 적용
   - 위치: 마찰 적용 직후
   - FAH 값: 0.983 (프레임당 1.7% 감쇠)

2. **`spinDampingPerTick`**: 서브스텝마다 `ball.spinX/Y/Z *= spinDampingPerTick^(1/substeps)` 적용
   - 위치: 마찰 적용 직후
   - FAH 값: 0.989

3. **`cushionPostCollisionSpeedScale`**: 쿠션 충돌 처리 후 속도에 스케일 곱셈
   - 위치: L406-413 쿠션 처리 직후
   - FAH 값: 1.0 (기본값이라 실질 영향 없음)

4. **`clothLinearSpinCouplingPerSec`**: 천-스핀 결합 — 선속도와 스핀 간 에너지 교환 계수
   - 위치: 마찰 적용 내부 또는 별도 단계
   - FAH 값: 1.0

**작업 내용 — 제거 방향 (대안):**
- `StepRoomPhysicsConfig` 타입에서 해당 필드 삭제
- `FAH_TEST_ROOM_PHYSICS_OVERRIDES`에서 해당 값 삭제
- `createRoomPhysicsStepConfig`에서 기본값 제거

**판단 기준:** 해당 파라미터의 물리적 의미가 다른 구현(M1, M2 등)과 중복되는지 확인. 중복되면 제거, 독립적이면 활성화.

**검증:**
- 활성화 시: FAH 프로파일과 default 프로파일에서 시뮬레이션 결과 비교
- 제거 시: 타입 에러 없이 빌드 통과 확인

---

## MEDIUM 7: 저속 쿠션 충돌 에너지 주입

### 현상
공이 매우 느린 속도(0.02 m/s)로 쿠션에 접근할 때, 반발 후 속도가 0.06 m/s로 **3배 증가**.

### 원인
**파일:** `room-physics-step.ts` L304, L406-413 — `minCushionReleaseNormalSpeedMps = 0.06`으로 저속 반발 시 강제 상향.

### 태스크 (단일)

#### Task M7.1: 쿠션 최소 반발 속도 클램프 제거
- **난이도:** 매우 낮
- **수정 파일:** `packages/physics-core/src/room-physics-step.ts`
- **예상 컨텍스트:** ~20K tokens

**작업 내용:**

1. L304: `minCushionReleaseNormalSpeedMps = 0.06` → `0.001` 또는 `0`으로 변경
2. 또는 L406-413의 클램프 로직 자체를 제거:
```typescript
// 제거 대상:
// if (normalSpeedOut < minCushionReleaseNormalSpeedMps) {
//   normalSpeedOut = minCushionReleaseNormalSpeedMps;
// }
```
3. X축/Y축 쿠션 처리 양쪽에서 동일하게 적용 (L406-413, L468-475 근처)

**주의사항:**
- 최소 속도를 0으로 하면 공이 쿠션에 달라붙을 수 있음 → 0.001 정도가 안전
- 에너지 단조감소 검증 필수

**검증:**
- 저속(0.01~0.05 m/s)으로 쿠션에 접근 → 반발 후 속도 ≤ 접근 속도 확인
- 반복 쿠션 충돌 시 에너지가 증가하지 않는지 확인
- 일반 속도에서 기존 동작과 동일

---

## LOW (지연 가능)

| 항목 | 설명 |
|------|------|
| 천 비등방성(Nap) | 천의 결 방향에 따라 마찰이 다름 |
| 큐 샤프트 휨 | squirt 정확도에 영향 |
| 마세/점프 샷 | 순수 2D이므로 불가 |
| 온도/습도 | 마찰 계수에 영향 |

---

## 구현 우선순위 및 태스크 목록

| 순서 | 태스크 | 난이도 | 예상 컨텍스트 | 수정 파일 | 선행 |
|------|--------|--------|---------------|-----------|------|
| 1 | **C1.1** 질량 하드코딩 수정 | 낮 | ~20K | `room-physics-step.ts` | — |
| 2 | **C1.2** ImpulseBody2D 3축 스핀 확장 | 높 | ~40K | `impulse-solver.ts` | C1.1 |
| 3 | **C1.3** 충돌 호출부 spinX/Y 전달 | 중 | ~30K | `room-physics-step.ts` | C1.2 |
| 4 | **C3.1** 샷 종료 각속도 체크 | 낮 | ~30K | `shot-end.ts`, `standalone-simulator.ts`, `http.ts` | — |
| 5 | **C4.1** 쿠션 throw 25도 | 매우 낮 | ~10K | `room-physics-config.ts` | — |
| 6 | **M7.1** 저속 쿠션 에너지 주입 제거 | 매우 낮 | ~20K | `room-physics-step.ts` | — |
| 7 | **C5.1** 백스핀 반전 부드러운 전환 | 중 | ~25K | `ball-surface-friction.ts` | C1 완료 후 재검증 |
| 8 | **C2.1** 스워브 가속도 구현 | 중 | ~25K | `ball-surface-friction.ts` | — |
| 9 | **C2.2** 스워브 Config 연결 | 낮 | ~25K | `room-physics-config.ts`, `room-physics-step.ts` | C2.1 |
| 10 | **M1.1** 적분 순서 변경 | 낮 | ~30K | `room-physics-step.ts` | — |
| 11 | **M2.1** SpinZ 일정 토크 감쇠 | 낮 | ~15K | `ball-surface-friction.ts` | — |
| 12 | **M3.1** 쿠션 sweep 감지 | 중 | ~35K | `room-physics-step.ts` | — |
| 13 | **M4.1** 코너 이중 쿠션 충돌 | 중 | ~35K | `room-physics-step.ts` | — |
| 14 | **M5.1** 미스큐 임계값 조정 | 낮 | ~10K | `miscue.ts` | — |
| 15 | **M6.1** 미사용 Config 활성화/제거 | 낮~중 | ~35K | `room-physics-step.ts`, `room-physics-config.ts` | — |

**병렬 실행 가능 그룹 (선행 의존성 없음):**
- 그룹 A: C3.1, C4.1, M7.1 (독립적, 간단)
- 그룹 B: C2.1 → C2.2 (순차)
- 그룹 C: M1.1, M2.1, M5.1 (독립적, 간단)
- 그룹 D: M3.1, M4.1, M6.1 (독립적, `room-physics-step.ts` 동시 수정 주의)

---

## 검증 방법

1. **compare-physics.ts 실행**: `npx tsx scripts/compare-physics.ts` — 6개 시나리오 before/after 비교
2. **웹 테스트 페이지**: `/test` 경로의 내장 7개 시나리오로 시각적 확인
3. **팔로우/드로우 검증**: 정면 충돌 + 탑스핀 → 수구 전진 확인, 백스핀 → 수구 후진 확인
4. **에너지 단조감소**: 반복 쿠션 충돌 시 총 운동에너지가 증가하지 않는지 확인
5. **스워브 검증**: 사이드 잉글리시 + 느린 샷 → 곡선 궤적 확인
