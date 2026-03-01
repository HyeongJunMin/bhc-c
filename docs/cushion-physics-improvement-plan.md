# 쿠션 충돌 물리 개선 계획

## 현황 요약

현재 쿠션 충돌 물리는 `apps/game-server/src/game/cushion-contact-throw.ts`에서 처리되며,
상수는 `packages/physics-core/src/constants.ts`, 시뮬레이션 루프는 `apps/game-server/src/lobby/http.ts`의
`stepRoomPhysics()`에서 동작한다.

---

## 문제점 분석

### 샘플 데이터 (당점 0,0 / 파워 91px / 시작점 0.70, 0.71)

| # | 축 | 입사각 | 반사각 | 속도 전/후 | spinX 전/후 | throw |
|---|-----|--------|--------|-----------|-------------|-------|
| 1 | x | 7.99° | 9.70° | 2.61→1.89 | 11.8→85.3 | 0.19° |
| 2 | z | 44.63° | 49.68° | 1.19→0.94 | 42.2→66.3 | 0.05° |
| 3 | z | 74.10° | 77.04° | 0.45→0.39 | 4.0→7.5 | **8.69°** |

---

### P0: contactTorque에 의한 spinX 폭증

**위치:** `cushion-contact-throw.ts:96-100`

**현상:**
쿠션 접촉 높이(h)에 의한 토크가 강체 충돌 가정으로 과도하게 계산된다.
첫 번째 충돌에서 spinX가 11.8 → 85.3 rad/s로 +73 rad/s 증가.

**원인:**
```
contactTorqueSpinDelta = (h × normalImpulse) / inertia
```
- h = 0.00625m (cushionHeight - ballRadius)
- normalImpulse = mass × (1+restitution) × |preVn| ≈ 0.943 N·s
- inertia = (2/5) × 0.21 × 0.03075² ≈ 7.94e-5 kg·m²
- **delta ≈ 74 rad/s** (비현실적)

**실제 물리:**
쿠션은 탄성 고무이며 접촉 시간 동안 변형되어 토크 전달이 감쇠된다.
실제 당구에서 쿠션 1회 충돌로 전방 스핀이 이렇게 크게 생기지 않는다.

**개선안:**
contactTorqueSpinDelta에 감쇠 계수(cushionTorqueDamping ≈ 0.3~0.5) 도입.
```typescript
const CUSHION_TORQUE_DAMPING = 0.35;
spinX += contactTorqueSpinDelta * normalDirection * CUSHION_TORQUE_DAMPING;
```

---

### P0: 저속 충돌 시 throw 각도 폭증

**위치:** `cushion-contact-throw.ts:81`

**현상:**
세 번째 충돌(속도 0.45 m/s)에서 throw가 8.69°로, 실제 당구 한계(3~5°)를 초과.

**원인:**
```
speedScale = (referenceSpeed / absPostVn) ^ contactTimeExponent
         = (5.96 / 0.39) ^ 1.2 ≈ 25배
```
속도가 낮을수록 speedScale이 역수적으로 발산한다.

**실제 물리:**
저속에서 접촉 시간이 길어져 throw가 증가하는 건 맞지만,
쿠션 고무의 변형 한계와 마찰의 물리적 상한에 의해 5° 이상은 발생하지 않는다.

**개선안 A:** speedScale에 상한 적용
```typescript
const MAX_SPEED_SCALE = 5.0;
const speedScale = Math.min(
  MAX_SPEED_SCALE,
  Math.pow(safeReferenceSpeed / Math.max(absPostVn, minNormalSpeed), contactTimeExponent)
);
```

**개선안 B:** contactTimeExponent를 낮춤 (1.2 → 0.6~0.8)
→ 저속 발산을 근본적으로 완화

**개선안 C:** maxThrowAngleDeg를 15° → 5°로 조정
→ 가장 단순하지만 고의적 english 시나리오까지 제한될 수 있음

**권장:** A + B 조합. maxThrowAngleDeg는 english를 위해 유지.

---

### P1: 속도 의존 반발계수 도입

**위치:** `constants.ts:8`, `cushion-contact-throw.ts:47`

**현상:**
CUSHION_RESTITUTION = 0.72 고정값. 모든 속도에서 동일한 반발 비율 적용.

**실제 물리:**
쿠션 고무의 반발계수는 충격 속도에 따라 비선형적으로 변한다:
- 저속(< 1 m/s): e ≈ 0.85~0.90 (고무 변형이 적어 탄성 회복 높음)
- 중속(1~3 m/s): e ≈ 0.75~0.80
- 고속(> 3 m/s): e ≈ 0.65~0.70 (고무 에너지 흡수 증가)

**개선안:**
```typescript
function speedDependentRestitution(normalSpeed: number): number {
  const baseE = 0.72;
  const lowSpeedE = 0.88;
  const highSpeedE = 0.65;
  const midSpeed = 2.0; // m/s
  const k = 1.5;
  // 시그모이드 보간
  const t = 1 / (1 + Math.exp(-k * (normalSpeed - midSpeed)));
  return lowSpeedE + (highSpeedE - lowSpeedE) * t;
}
```

기존 `restitution` 파라미터를 이 함수로 대체하거나, 옵트인 방식으로 추가.

---

### P1: 쿠션 마찰에 의한 spinZ/spinX 감쇠

**위치:** `cushion-contact-throw.ts:107` (spinZ 그대로 return)

**현상:**
쿠션 충돌 후 spinZ가 전혀 변하지 않는다.
다중 쿠션 충돌을 거쳐도 rolling spin이 그대로 유지됨.

**실제 물리:**
- x축 쿠션 충돌 → 쿠션 면과 공의 접촉 마찰이 spinZ(탑/백스핀)를 감소시킴
- z축 쿠션 충돌 → 마찬가지로 spinX가 감소
- 매 충돌마다 회전 에너지의 일부가 마찰로 소산됨

**개선안:**
접촉점에서의 접선 마찰이 rolling spin에 미치는 임펄스를 계산:
```typescript
// 쿠션 접촉 마찰에 의한 rolling spin 감쇠
const frictionTorqueFactor = contactFriction * 0.3;
if (input.axis === 'x') {
  // x축 쿠션: spinZ 감쇠
  spinZ *= (1 - frictionTorqueFactor);
} else {
  // z축 쿠션: spinX 감쇠 (contactTorque 이후 적용)
  spinX *= (1 - frictionTorqueFactor);
}
```

---

### P2: 접선속도 슬립/그립 전환

**위치:** `cushion-contact-throw.ts:88`

**현상:**
`dampedVt = preVt * (1 - contactFriction)` — 속도/스핀과 무관한 단순 비율 감쇠.

**실제 물리:**
쿠션 접촉점에서 공이 미끄러지는 경우(슬립)와 잡히는 경우(그립)가 구분된다.
접선 임펄스가 최대 정지마찰력을 초과하면 슬립, 이하면 그립.
그립 상태에서는 접선 속도 변화가 스핀에 의해 결정되며 추가 에너지 손실이 없다.

**개선안:**
```typescript
const maxFrictionImpulse = contactFriction * normalImpulse;
const tangentImpulse = ballMassKg * preVt; // 접선 운동량
if (Math.abs(tangentImpulse) <= maxFrictionImpulse) {
  // 그립: 접선속도와 스핀이 커플링
  postVt = preVt; // 마찰 손실 없음
} else {
  // 슬립: 마찰에 의한 감쇠
  postVt = preVt - Math.sign(preVt) * maxFrictionImpulse / ballMassKg;
}
```

---

### P2: spinY 변환 매직넘버 제거

**위치:** `cushion-contact-throw.ts:103-105`

**현상:**
```typescript
const conversion = contactFriction * 0.08 * spinY;
```
0.08은 물리적 근거 없는 임의 상수.

**개선안:**
접촉점 기하학에 기반한 spin 축 변환으로 대체하거나,
효과가 미미하다면(contactFriction × 0.08 = 0.0112) 제거 검토.

---

## 수정 대상 파일

| 파일 | 변경 내용 |
|------|----------|
| `apps/game-server/src/game/cushion-contact-throw.ts` | 핵심 로직 수정 (P0/P1/P2 전체) |
| `packages/physics-core/src/constants.ts` | 새 상수 추가 (감쇠 계수, speedScale 상한 등) |
| `apps/game-server/src/game/cushion-contact-throw.test.ts` | 테스트 케이스 업데이트 |
| `scripts/qa/cushion-contact-time-angle-table.ts` | QA 검증 스크립트 업데이트 |

## 구현 순서

1. **P0 항목 먼저 적용** → spinX 폭증 + throw 폭증 해결
2. **QA 테이블로 검증** → 각 속도/스핀 조합에서 throw 범위 확인
3. **P1 항목 적용** → 반발계수 + spin 감쇠
4. **실제 플레이 테스트** → 다중 쿠션 궤적이 자연스러운지 확인
5. **P2 항목 검토** → 필요 시 적용
