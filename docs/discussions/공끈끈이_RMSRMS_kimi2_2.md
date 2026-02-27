# 공 끈끈이 현상 원인 분석

**일감번호**: RMSRMS1  
**주제**: 공끈끈이  
**Key**: RMSRMS  
**작성**: kimi2

---

## 증상

공 간 충돌 시 입사각-반사각이 현실과 다름. 붙어서 엉김/끈끈이가 있는 것처럼 보임.

---

## 핵심 원인: 침투 보정 불완전 + 연속 충돌 감지 루프

**위치**: `apps/game-server/src/lobby/http.ts:614-621`

```typescript
const correction = ((penetration - 1e-4 > 0 ? penetration - 1e-4 : 0) / 2) * 0.8;
```

---

## 문제 메커니즘 상세

### 1. 보정률 80%만 적용 (`* 0.8`)

| 상황 | 예상 보정 | 실제 보정 | 남는 침투 |
|------|----------|----------|----------|
| 1cm 겹침 | 0.5cm씩 | 0.4cm씩 | 0.2cm |
| 5mm 겹침 | 2.5mm씩 | 2mm씩 | 1mm |

- 두 공이 겹친 상태에서 100% 분리되지 않음
- 20% 침투가 남아있는 상태로 다음 프레임 진행

### 2. 다음 프레임에서 또 충돌 감지 (`http.ts:609`)

```typescript
if (Number.isFinite(distanceSq) && distanceSq <= minDistanceSq) {
```

- 남은 침투 때문에 두 공 중심 거리가 `2R`보다 작음
- 충돌로 재판정 → impulse 다시 적용
- 속도 교환이 다시 발생하여 서로 마주보는 속도 생김

### 3. 무한 루프 구조

```
[Frame N]   공 A → ← 공 B (충돌)
                ↓
            impulse 적용 (속도 교환)
                ↓
            위치 보정 (80%만 - 불완전)
                ↓
[Frame N+1] 여전히 distance <= 2R
                ↓
            다시 충돌 판정
                ↓
            반복...
```

---

## 관련 코드 경로

| 파일 | 라인 | 내용 |
|------|------|------|
| `apps/game-server/src/lobby/http.ts` | 609 | 충돌 감지 조건 |
| `apps/game-server/src/lobby/http.ts` | 614-621 | 침투 보정 로직 |
| `apps/game-server/src/lobby/http.ts` | 613 | impulse 적용 |

---

## 검증 및 수정 제안

### 옵션 A: 보정률 100%로 변경 (간단)

```typescript
// 변경 전
const correction = ((penetration - 1e-4 > 0 ? penetration - 1e-4 : 0) / 2) * 0.8;

// 변경 후
const correction = ((penetration - 1e-4 > 0 ? penetration - 1e-4 : 0) / 2) * 1.0;
```

### 옵션 B: Iterative Solver 적용 (안정적)

```typescript
// 여러 번 반복 보정
for (let i = 0; i < 3; i++) {
  const distance = Math.hypot(deltaX, deltaZ);
  const penetration = minDistance - distance;
  if (penetration <= 0) break;
  
  const normalX = deltaX / distance;
  const normalZ = deltaZ / distance;
  const correction = (penetration / 2) * 1.0;
  
  first.x -= normalX * correction;
  setBallZ(first, getBallZ(first) - normalZ * correction);
  second.x += normalX * correction;
  setBallZ(second, getBallZ(second) + normalZ * correction);
}
```

---

## 참고

- Physics-Spec의 공-공 반발계수: `e_bb = 0.92 ~ 0.98`
- 현재 상수: `BALL_BALL_RESTITUTION = 0.95` (정상)
- 문제는 반발계수가 아닌 **위치 보정**에 있음
