# cushion-bounce테스트1구간굴절문제

- key: 굴절문제
- work_id: 굴절문제1
- model_name: kimi
- created_at: 2026-03-01 22:44:52 +0900

> 작성 규칙: 모든 섹션을 실제 분석 내용으로 채우고, 근거에는 파일 경로/라인을 포함한다.

## 배경
- 증상: `/test/cushion-bounce` 테스트에서 구간1(출발~첫 쿠션 충돌 전) 중간에 스핀 방향이 톱스핀→백스핀으로 "굴절"처럼 바뀌는 현상 관찰
- 관찰 범위: 
  - 테스트 시나리오: `cushion-bounce.ts` (directionDeg: 30, dragPx: 280, impactOffset: 0,0)
  - 스핀 판정 UI: `CueBallSegmentedTrajectory.tsx` 33-54줄 `getSpinLabel()`
  - 물리 시뮬레이션: `standalone-simulator.ts` 전체 프레임 계산

## 쟁점
- 논쟁 포인트: 이 현상은 버그인가, 아니면 물리적으로 정상적인 현상인가?
  - **버그 주장**: 구간1 내에서 아문 충돌도 없는데 스핀 방향이 바뀌면 안 됨. 톱스핀→백스핀 전환은 공 충돌이나 당점조절(스네이크샷)이 있어야만 가능
  - **정상 주장**: 슬라이딩→롤링 전환은 자연스러운 물리 현상. 마찰력에 의해 공이 구륵게 되면서 스핀 방향이 형성됨

## 선택지
- 선택지 A (버그 수정): 롤링 전환 시 스핀을 부드럽게 보간하거나, 구간 시작/끝에서만 스핀 레이블을 결정하도록 UI 수정
- 선택지 B (의도된 동작): 현재 시뮬레이션은 물리적으로 정확함. 다만 사용자 경험을 위해 시각적 표현 개선 (예: 슬라이딩→롤링 전환점 표시)
- 선택지 C (문서화): 현재 동작이 물리적으로 정확함을 문서화하고, 테스트 시나리오에 예상 스핀 변화 패턴을 주석으로 추가

## 결정
- 최종 결론: **미결정 - 추가 검토 필요**. 물리 엔진의 정확성과 UX 직관성 사이의 트레이드오프.
  - 물리적으로는 `ball-surface-friction.ts` 82-88줄의 롤링 전환 로직이 정확함
  - 하지만 사용자는 "구간1 = 출발→첫 충돌"로 인식하므로 중간 스핀 변화가 혼란스러움

## 근거
- 코드 근거 1: `ball-surface-friction.ts` 82-88줄 - 슬라이딩→롤링 전환 시 `spinZ = -vx / radius`로 설정
  ```ts
  if (nextDot < 0) {  // 슬라이딩 방향 반전 → 롤링 전환
    const vxRoll = (5 * vx - 2 * radius * spinZ) / 7;
    const vyRoll = (5 * vy + 2 * radius * spinX) / 7;
    vx = vxRoll;
    vy = vyRoll;
    spinZ = -vx / radius;  // 롤링 조건: 선속도와 각속도 관계
    spinX = vy / radius;
  }
  ```
- 코드 근거 2: `CueBallSegmentedTrajectory.tsx` 52-53줄 - 스핀 방향 판정 로직
  ```ts
  const forwardSpin = spinX * uz - spinZ * ux;
  return forwardSpin > 0 ? '톱스핀' : '백스핀';
  ```
- 코드 근거 3: `standalone-simulator.ts` 167-169줄 - 초기 스핀 설정 (impactOffset 0,0 시 거의 0)
  ```ts
  ball.spinX = initialization.omegaX;  // ≈ 0
  ball.spinY = initialization.omegaY;  // = 0
  ball.spinZ = 0;
  ```

## 후속 작업
- 작업 1: Physics-Spec.md에 슬라이딩→롤링 전환 시 스핀 형성 메커니즘 문서화
- 작업 2: `CueBallSegmentedTrajectory.tsx`에 슬라이딩/롤링 상태 표시 추가 (선택적)
- 작업 3: 동일 조건에서 실제 3쿠션 당구 공의 행동을 관찰하여 시뮬레이션 검증
- 작업 4: 결정된 방향(A/B/C)에 따라 구현 또는 문서화 작업 진행
