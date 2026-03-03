# cushion-bounce테스트1구간굴절문제

- key: 굴절문제
- work_id: 굴절문제1
- model_name: claude
- created_at: 2026-03-01 22:46:06 +0900

> 작성 규칙: 모든 섹션을 실제 분석 내용으로 채우고, 근거에는 파일 경로/라인을 포함한다.

## 배경

- 증상: `/test/cushion-bounce` 페이지에서 구간1을 호버할 때, 일부 구간에서는 톱스핀, 다른 구간에서는 백스핀으로 표시됨. 구간1 내에 시각적 굴절(꺾임)이 존재하는데, 공과의 충돌도 없고 당점도 center(0, 0)인데 굴절이 발생하는 것처럼 보임.
- 관찰 범위: `apps/web/src/components/test/CueBallSegmentedTrajectory.tsx` 의 세그먼트 렌더링 및 툴팁 로직, `packages/physics-core/src/standalone-simulator.ts` 의 물리 루프.

## 쟁점

- 논쟁 포인트: 구간1 내의 시각적 굴절과 백스핀 표시가 물리 버그인가, 아니면 세그먼트 경계 정의 문제인가?
- 세부 쟁점 1: `getSpinLabel()` 함수의 순방향 스핀 투영 공식이 잘못되어 있었음 (별도 수정 완료).
- 세부 쟁점 2: 세그먼트 경계 프레임(이벤트 프레임)이 앞 세그먼트의 **마지막 점**으로 포함되기 때문에, 충돌 후 상태(방향 전환 + 백스핀)가 구간1 꼬리에 붙어 "구간1 내부 굴절"처럼 보임.

## 선택지

- 선택지 A: 세그먼트 렌더링 시 이벤트 프레임을 앞 세그먼트에서 제외 (`fi < endF`)하고, 이벤트 프레임은 다음 세그먼트의 첫 점으로만 사용한다.
- 선택지 B: 현행 유지 (이벤트 프레임을 양쪽 세그먼트에 포함). 단, 툴팁에서 "이 지점은 충돌 직후 프레임입니다"라는 안내 문구를 추가한다.

## 결정

- 최종 결론: **선택지 A 채택** — 이벤트 프레임(충돌 후 스냅샷)을 앞 세그먼트에서 제외하여, 굴절이 세그먼트 경계에서만 가시화되도록 수정한다. 각 세그먼트는 충돌 **직전** 프레임까지만 포함하고, 충돌 **후** 프레임은 다음 세그먼트의 시작점이 된다.

## 근거

- 코드 근거 1 — 스냅샷 타이밍 (`standalone-simulator.ts:578-580`):
  ```typescript
  for (let frameIndex = 1; frameIndex <= maxFrames; frameIndex += 1) {
    stepPhysics(balls, events, frameIndex);  // 쿠션 충돌 + 이벤트 push
    frames.push(snapshotBalls(balls));       // 충돌 후 상태로 스냅샷
  }
  ```
  이벤트의 `frameIndex`는 충돌이 처리된 후의 스냅샷 인덱스이므로, `frames[F_ev]`는 이미 충돌 후 상태다.

- 코드 근거 2 — 세그먼트 루프 (`CueBallSegmentedTrajectory.tsx:196`):
  ```typescript
  for (let fi = startF; fi <= endF; fi++) {  // 양쪽 inclusive → 이벤트 프레임이 앞 세그먼트에 포함됨
  ```
  `fi <= endF` 조건으로 인해 `F_ev`(충돌 후)가 구간1의 마지막 점으로 들어가 꺾임이 생김.

- 코드 근거 3 — 충돌 후 백스핀 발생 원리 (`ball-surface-friction.ts:64-65`):
  Z쿠션 충돌 시 `vz` 부호 반전, `spinX`는 유지됨.
  → 충돌 후: `spinX > 0`, 새 방향 기준 rolling 조건 `spinX_roll = vz_new/R < 0` → 백스핀 상태 (물리적으로 정확).

- 코드 근거 4 — getSpinLabel 공식 버그 (수정 완료, commit `bce504f`):
  `CueBallSegmentedTrajectory.tsx:52`:
  - 수정 전: `const forwardSpin = spinZ * ux + spinX * uz;` (방향에 따라 순수 롤링도 백스핀 표시)
  - 수정 후: `const forwardSpin = spinX * uz - spinZ * ux;` (rolling axis 올바른 투영)

## 후속 작업

- 작업 1: `CueBallSegmentedTrajectory.tsx` 세그먼트 루프를 `fi < endF` (마지막 세그먼트 제외)로 수정하여 이벤트 프레임이 앞 세그먼트에 포함되지 않도록 처리.
- 작업 2: 수정 후 `/test/cushion-bounce` 에서 구간1이 직선으로만 표시되는지, 구간 경계에서만 굴절이 나타나는지 재검증.
- 작업 3: 다른 테스트 시나리오(`straight-up-cushion`, `angle-45` 등)에서도 동일 현상 없는지 확인.
