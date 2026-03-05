# Physics Impulse Refactor Design (정밀 설계안)

## 1. 목표
- 목표: 현재 `stepRoomPhysicsWorld`의 축별/보정 중심 충돌 처리를, 공-공/공-쿠션 공통 **Impulse Solver** 기반으로 통합한다.
- 핵심 결과:
  - top/back/center 샷에서 `v`(선속도)와 `w`(각속도)가 일관되게 갱신된다.
  - 쿠션/코너에서 "붙음(sticking)" 없이 안정적으로 이탈한다.
  - 튜닝 파라미터가 물리 의미(반발계수, 마찰계수, 접선 충격 상한)로 분리된다.

## 2. 현재 코드 기준 문제 요약
- 현재 충돌 처리는 [room-physics-step.ts](/Users/seokjin/dev/tutorial/bhc-c-main/packages/physics-core/src/room-physics-step.ts)에서 경계축(`x`,`y`)별 반사 + 보정 방식.
- `applyCushionContactThrow` 기반의 경험식이 강하게 작동하며, 코너/저속 구간에서 반복 접촉이 쉽게 발생.
- 최근 핫픽스로 최소 이탈 속도/분리 epsilon을 추가했지만, 이는 안정화용 가드이며 근본적으로는 충돌 해석의 일관화가 필요.

## 3. 타겟 물리 모델

### 3.1 상태 변수(2D 평면 + 3D 회전)
- 공 상태:
  - 위치: `p = (x, y)` (테이블 평면 좌표)
  - 선속도: `v = (vx, vy)`
  - 각속도: `w = (wx, wy, wz)` (`spinX, spinY, spinZ`)
- 상수:
  - 질량 `m`
  - 반지름 `R`
  - 관성 `I = 2/5 * m * R^2` (실구체 가정)

### 3.2 접점 상대속도
- 접점 속도:
  - `v_contact = v + (w x r_contact)`
- 접점 기준 상대속도:
  - 법선 성분 `vn = dot(v_rel, n)`
  - 접선 성분 `vt = dot(v_rel, t)`

### 3.3 충돌 충격량(Impulse)
- 법선 충격량:
  - `Jn = -(1+e) * vn / K_n` (단 `vn < 0`)
- 접선 충격량:
  - `Jt_unc = -vt / K_t`
  - `|Jt| <= mu * |Jn|` (Coulomb cone clamp)
- 속도 갱신:
  - `v' = v + (J / m)`
  - `w' = w + I^{-1} * (r x J)`

### 3.4 바닥(천) 마찰 모델
- 슬라이딩/롤링 전이:
  - `u = v - R * (k x w)`의 크기로 구분
  - `|u| > eps_slide`: kinetic friction 적용
  - `|u| <= eps_slide`: rolling constraint 근사(속도-회전 결합)

## 4. 아키텍처 리팩터링 구조

## 4.1 모듈 분리(신규)
- `packages/physics-core/src/dynamics/rigid-ball.ts`
  - 공 상태/상수 타입
- `packages/physics-core/src/dynamics/contact-kinematics.ts`
  - 접점 상대속도 계산
- `packages/physics-core/src/solver/impulse-solver.ts`
  - `solveBallBallImpulse`, `solveBallCushionImpulse`
- `packages/physics-core/src/solver/coulomb-clamp.ts`
  - `clampTangentialImpulse`
- `packages/physics-core/src/dynamics/cloth-friction.ts`
  - 슬라이딩/롤링 전이 업데이트
- `packages/physics-core/src/solver/corner-contact.ts`
  - 코너 다중 접촉 동시 해결(2-contact projection)

## 4.2 기존 파일 역할 재정의
- [room-physics-step.ts](/Users/seokjin/dev/tutorial/bhc-c-main/packages/physics-core/src/room-physics-step.ts)
  - 오케스트레이터만 담당:
    1. 예측 이동
    2. 접촉 후보 생성
    3. impulse solver 호출
    4. cloth friction 적용
    5. 안정화/가드(energy cap, NaN guard)
- [cushion-contact-throw.ts](/Users/seokjin/dev/tutorial/bhc-c-main/apps/game-server/src/game/cushion-contact-throw.ts)
  - 1차 단계에서는 "guide/debug용 fallback"으로만 유지
  - 2차 단계에서 solver 기반 API로 대체 예정

## 5. 정확한 타입/시그니처 제안

```ts
// packages/physics-core/src/dynamics/rigid-ball.ts
export type RigidBallState = {
  id: string;
  p: { x: number; y: number };
  v: { x: number; y: number };
  w: { x: number; y: number; z: number };
  isPocketed: boolean;
};

export type RigidBallParams = {
  massKg: number;
  radiusM: number;
  inertiaKgM2: number; // 2/5 mR^2
};
```

```ts
// packages/physics-core/src/solver/impulse-solver.ts
export type ContactMaterial = {
  restitution: number;      // e
  friction: number;         // mu
  spinTransfer: number;     // spin-to-tangent coupling scalar
};

export type BallBallContact = {
  aIndex: number;
  bIndex: number;
  normal: { x: number; y: number };
  penetrationM: number;
  contactPoint: { x: number; y: number };
};

export type BallCushionContact = {
  ballIndex: number;
  cushionId: 'left' | 'right' | 'top' | 'bottom';
  normal: { x: number; y: number };
  penetrationM: number;
  contactPoint: { x: number; y: number };
};

export function solveBallBallImpulse(
  balls: RigidBallState[],
  contact: BallBallContact,
  params: RigidBallParams,
  mat: ContactMaterial,
): void;

export function solveBallCushionImpulse(
  balls: RigidBallState[],
  contact: BallCushionContact,
  params: RigidBallParams,
  mat: ContactMaterial,
): void;
```

```ts
// packages/physics-core/src/dynamics/cloth-friction.ts
export type ClothFrictionConfig = {
  kineticMu: number;
  rollingMu: number;
  spinDampingPerSec: number;
  slideToRollSpeedEps: number;
};

export function applyClothFrictionStep(
  ball: RigidBallState,
  params: RigidBallParams,
  cfg: ClothFrictionConfig,
  dtSec: number,
): void;
```

## 6. 스텝 파이프라인(타겟)

1. `predict`: `p += v * dt_sub`
2. `detect contacts`:
   - ball-ball pair
   - ball-cushion (single or corner dual)
3. `solve impulses`:
   - ball-ball
   - ball-cushion
   - corner dual-contact projection (최대 2~3회 반복)
4. `positional correction`:
   - Baumgarte or split impulse (`beta`, `slop`)
5. `cloth friction update`:
   - sliding -> rolling transition
6. `stability guards`:
   - speed cap
   - energy cap
   - finite guard

## 7. 코너(모서리) 처리 정확안
- 조건: 동일 substep에서 `x`,`y` 경계 동시 침투.
- 처리:
  - 접촉 2개를 독립 반사하지 않고, `[(n1,t1), (n2,t2)]` 접촉 집합으로 반복 해결.
  - 반복(2~3회):
    1. 각 접촉의 `Jn/Jt` 계산
    2. 누적 impulse 적용
    3. 접촉 재평가
  - 종료 후 침투가 남으면 split impulse로 위치만 보정.

## 8. 마이그레이션 단계(실행 순서)

### Phase 0: 안전장치 유지
- 현재 가드(최소 이탈 속도/epsilon)는 유지.
- 회귀 테스트 baseline 확보.

### Phase 1: 타입 정규화
- `PhysicsBallState` <-> `RigidBallState` adapter 추가.
- 기존 API 호환 레이어 유지.

### Phase 2: Ball-Ball impulse 교체
- 기존 `resolveBallBallCollisions` 내부를 solver 호출로 치환.
- 기존 테스트 모두 green 유지.

### Phase 3: Ball-Cushion impulse 교체
- `applyCushionContactThrow` 호출 경로를 solver 기반으로 대체.
- guide line 계산도 동일 solver를 사용하도록 전환.

### Phase 4: Cloth friction 전이 모델 도입
- 현재 damping 계수 기반 감쇠를 sliding/rolling 분기형으로 전환.

### Phase 5: 코너 다중접촉 + 파라미터 캘리브레이션
- 코너 반복 solver 도입
- QA 스크립트 기반 회귀 곡선 측정 후 계수 확정

## 9. 검증 기준(테스트 계약)

## 9.1 단위 테스트
- `impulse-solver.ball-ball.test.ts`
  - 정면충돌 운동량/에너지(반발계수 반영) 검증
- `impulse-solver.ball-cushion.test.ts`
  - center/top/back 스핀별 반사각/속도 감소 검증
- `corner-contact.test.ts`
  - 코너 진입 시 정지(stick) 없이 이탈하는지 검증
- `cloth-friction.test.ts`
  - slide->roll 전이 곡선 검증

## 9.2 통합 테스트
- 기존 [room-physics-step.test.ts](/Users/seokjin/dev/tutorial/bhc-c-main/packages/physics-core/src/room-physics-step.test.ts) 확장:
  - top spin 목적구 충돌 후 follow 거리
  - back spin 목적구 충돌 후 draw 거리
  - cushion 다중 반사 후 에너지/각속도 안정성

## 9.3 시나리오 QA
- `scripts/qa/headon-spin-follow-draw.ts` 기준치 업데이트
- 코너 반복 접촉 soak 시:
  - stuck frame 0회
  - trace truncation과 물리 이벤트 수의 비정상 폭증 없음

## 10. 파라미터 캘리브레이션 정책
- 우선순위:
  1. 반발계수 `e` (쿠션/공)
  2. 마찰계수 `mu` (접선/천)
  3. spin transfer 계수
- 방법:
  - 기준 샷 셋(센터/탑/백, 강/중/약) 9~12개 고정
  - 관측값: 반사각, 첫/둘째 쿠션 도달점, object-ball 분리 속도
  - 오차 함수 최소화(가중 least squares)

## 11. 위험/완화
- 위험: 기존 플레이 감각 급변.
  - 완화: 어댑터 계층 + feature flag(`PHYSICS_SOLVER_V2`)로 단계 롤아웃.
- 위험: 계산량 증가.
  - 완화: substep 내 contact iteration 상한(2~3), branchless clamp 최적화.
- 위험: 디버그 난이도 상승.
  - 완화: `PhysicsDebugFrame`(접촉별 `Jn/Jt/vn/vt`) 로그 구조체 추가.

## 12. 완료 정의(DoD)
- 공-공/공-쿠션이 공통 impulse solver 경로로 처리된다.
- 코너 stuck 재현 케이스 0건.
- follow/draw regression 테스트 pass.
- 기존 런타임 안정성 테스트 + 에너지/NaN guard 테스트 pass.
- `GameScene` 가이드 라인이 runtime solver와 동일 응답을 사용한다.
