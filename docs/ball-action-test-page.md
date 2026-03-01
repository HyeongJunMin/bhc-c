# 물리 테스트 페이지 구현 계획

## 목적
물리 엔진의 정확성을 검증하기 위해, 마우스 입력 대신 **정해진 수치(공 위치, 파워, 회전)**로 샷을 실행하고 결과를 관찰할 수 있는 전용 테스트 페이지를 만든다.
예측 경로와 실제 물리 시뮬레이션이 일치하는지 확인하는 것이 목적.

## 단위 규칙
- 좌표: **미터(m)** 그대로 사용 (테이블: 2.844m x 1.422m)
- 파워: **dragPx** 그대로 사용 (10~400)
- 회전: **impactOffset** 그대로 사용 (-0.03075 ~ 0.03075)

## 좌표계 참고
- 원점: 테이블 중앙
- X축: 좌(-) → 우(+) (가로 2.844m, 범위 -1.422 ~ +1.422)
- Z축: 하(-) → 상(+) (세로 1.422m, 범위 -0.711 ~ +0.711)
- Y축: 높이 (공 반지름 0.03075에 고정)
- 쿠션 두께: 0.05m (유효 범위는 쿠션+공반지름 만큼 줄어듦)

## 구조 변경

### 1. react-router-dom 추가
현재 라우팅 없음 → `react-router-dom` 설치 후 라우팅 추가

| 경로 | 페이지 |
|------|--------|
| `/` | 기존 게임 (App.tsx) |
| `/test` | 테스트 시나리오 목록 |
| `/test/:testId` | 개별 테스트 실행 페이지 |

### 2. 테스트 페이지 레이아웃 (`TestPage.tsx`)

```
┌──────────────────────────────┬─────────────────────────┐
│                              │  시나리오: straight-right│
│                              │  설명: 직선 히트 테스트  │
│    3D 당구대 뷰              │─────────────────────────│
│    (탑다운 고정 카메라)       │  [공 위치]              │
│                              │  수구:   x=-0.50  z=0.00│
│                              │  1적구:  x= 0.50  z=0.00│
│                              │  2적구:  x= 0.00  z=0.50│
│                              │─────────────────────────│
│                              │  [샷 파라미터]           │
│                              │  방향: 90°              │
│                              │  dragPx: 127            │
│                              │  elevation: 0°          │
│                              │  offsetX: 0  offsetY: 0 │
│                              │─────────────────────────│
│                              │  [Execute Shot] [Reset] │
│                              │─────────────────────────│
│                              │  [충돌 이벤트 로그]      │
│                              │  00.12s BALL cueBall↔obj1│
│                              │  00.45s CUSHION obj1→top │
│                              │─────────────────────────│
│                              │  [최종 위치]             │
│                              │  수구:   x=0.48  z=0.00 │
│                              │  1적구:  x=1.20  z=0.00 │
│                              │  2적구:  x=0.00  z=0.50 │
└──────────────────────────────┴─────────────────────────┘
```

**3D 뷰 특징:**
- BilliardTable, Ball 컴포넌트 재활용
- 탑다운 고정 카메라 (테스트 관찰에 최적)
- 마우스 입력/큐스틱/가이드라인 없음
- 시뮬레이션 중 공 이동 시각화

**컨트롤 패널 특징:**
- 시나리오 정보 (이름, 설명)
- 공 위치 표시 (읽기 전용, 시나리오에서 로드)
- 샷 파라미터 표시
- Execute Shot / Reset 버튼
- 충돌 이벤트 실시간 로그
- 시뮬레이션 종료 후 최종 공 위치

### 3. 테스트 시나리오 데이터 구조

```typescript
interface TestScenario {
  id: string;
  name: string;
  description: string;
  balls: {
    cueBall: { x: number; z: number };      // 미터(m)
    objectBall1: { x: number; z: number };
    objectBall2: { x: number; z: number };
  };
  shot: {
    directionDeg: number;       // 0~360°
    elevationDeg: number;       // 0~89°
    dragPx: number;             // 10~400
    impactOffsetX: number;      // -0.03075~0.03075
    impactOffsetY: number;      // -0.03075~0.03075
  };
  expected?: {
    description: string;        // 예상 결과 설명
  };
}
```

### 4. 초기 시나리오 5개

#### 1) `straight-right` - 직선 히트 (90°)
- **수구** (-0.5, 0), **1적구** (0.5, 0), **2적구** (0, 0.5)
- 방향 90°, dragPx 127, 회전 없음
- **기대:** 수구가 +X방향 직진 → 1적구 정면 충돌

#### 2) `straight-up` - 직진 + 쿠션 반사 (0°)
- **수구** (0, -0.3), **1적구** (0.5, 0.3), **2적구** (-0.5, 0.3)
- 방향 0°, dragPx 205, 회전 없음
- **기대:** 수구가 +Z방향 직진 → 상단 쿠션 반사

#### 3) `angle-45` - 45도 샷
- **수구** (-0.5, -0.3), **1적구** (0.2, 0.4), **2적구** (0.6, -0.2)
- 방향 45°, dragPx 166, 회전 없음
- **기대:** 대각선 방향 진행, 경로 확인

#### 4) `cushion-bounce` - 쿠션 반사 관찰
- **수구** (0, 0), **1적구** (1.0, 0.5), **2적구** (-0.8, 0.3)
- 방향 0°, dragPx 244, 회전 없음
- **기대:** 쿠션 반사 경로 확인

#### 5) `spin-english` - 좌 English 회전
- **수구** (-0.5, 0), **1적구** (0.5, 0), **2적구** (0, 0.5)
- 방향 90°, dragPx 127, impactOffsetX: -0.02
- **기대:** 충돌 후 수구 경로에 좌회전 영향 관찰

## 수정/생성할 파일

| 파일 | 작업 | 설명 |
|------|------|------|
| `apps/web/package.json` | 수정 | `react-router-dom` 의존성 추가 |
| `apps/web/src/main.tsx` | 수정 | BrowserRouter + Routes 설정 |
| `apps/web/src/pages/TestPage.tsx` | 새 파일 | 테스트 실행 페이지 |
| `apps/web/src/pages/TestListPage.tsx` | 새 파일 | 시나리오 목록 페이지 |
| `apps/web/src/test-scenarios/scenarios.ts` | 새 파일 | 시나리오 데이터 정의 |

## 재활용할 기존 코드

| 코드 | 파일 | 용도 |
|------|------|------|
| `SimplePhysics` 클래스 | `apps/web/src/core/SimplePhysics.ts` | 새 인스턴스로 독립 물리 시뮬레이션 |
| `computeShotVelocity()` | `apps/web/src/lib/physics-calculator.ts` | 샷 속도 계산 |
| `BilliardTable` 컴포넌트 | `apps/web/src/components/BilliardTable.tsx` | 3D 테이블 렌더링 |
| `Ball` 컴포넌트 | `apps/web/src/components/Ball.tsx` | 3D 공 렌더링 |
| `PHYSICS`, `COLORS` 상수 | `apps/web/src/lib/constants.ts` | 물리/색상 상수 |

## 검증 방법
1. `pnpm install` (react-router-dom 추가 후)
2. `pnpm dev` (apps/web)
3. `http://localhost:5173/test` → 시나리오 목록 확인
4. 시나리오 클릭 → 3D 뷰에서 공 위치/파라미터 확인
5. "Execute Shot" 클릭 → 시뮬레이션 관찰
6. 충돌 로그 확인 (시간순, 타입, 관련 공/쿠션)
7. 최종 위치 확인 (시뮬레이션 종료 후)
