# 굴절문제 - cushion-bounce테스트1구간굴절문제

- **Topic**: cushion-bounce테스트1구간굴절문제
- **Key**: 굴절문제
- **Work ID**: 굴절문제1
- **Model**: gemini

## 배경 (Background)
`/test/cushion-bounce` 구간 1에서 공이 비정상적으로 굴절(곡선 운동)하는 현상이 발견됨. 샷 직후 아무런 충돌이 없고 의도적인 맛세이(Massé) 샷이 아님에도 불구하고, 톱스핀이나 백스핀이 걸린 상태에서 공이 진행 방향을 벗어나 옆으로 휘어지는 문제가 발생함.

## 쟁점 (Issue)
1. **샷 초기화 시의 회전축 벡터 회전 누락**: `apps/game-server/src/lobby/http.ts`의 `applyShotToRoomBalls`에서 상/하단 회전(`omegaX`)을 부여할 때, 샷의 실제 진행 방향(`finalDirectionRad`)을 고려하여 `spinX`, `spinZ`로 분산시켜야 하나 항상 월드 좌표계의 `spinX`로만 고정 할당됨.
2. **물리 엔진 내부의 축 정의 혼선**: `packages/physics-core/src/ball-surface-friction.ts`와 `apps/game-server/src/game/cushion-contact-throw.ts` 간에 `spinX`, `spinY`, `spinZ`가 각각 사이드 스핀인지 구름 스핀인지 정의가 통일되지 않음.
3. **쿠션 토크 업데이트 버그**: 쿠션 충돌 시 발생하는 구름 회전 변화(Torque)가 충돌 면(X축 vs Z축)에 상관없이 항상 `spinX`에만 가해지고 있음.

## 선택지 (Options)
1. **임시방편 (Claude's patch)**: `cushion-contact-throw.ts`에서 `ROLLING_SPIN_HEIGHT_FACTOR` (0.1)를 도입하여 구름 회전이 Throw에 주는 영향을 인위적으로 축소함 (증상은 완화되나 근본적인 축 혼선은 유지).
2. **근본 해결 (Proposed)**: 
    - 샷 방향에 따른 회전 벡터 변환(`sin`/`cos` 적용) 로직 도입.
    - 프로젝트 전역의 회전축 표준화 (`spinY`=Side, `spinX`=Z-Roll, `spinZ`=X-Roll).
    - 쿠션 충돌 축에 따른 정확한 토크 업데이트 로직 구현.

## 결정 (Decision)
**선택지 2 (근본 해결)** 방식을 채택함. 물리적 정확성을 보장하고 향후 고도화된 물리 기능(마세, 점프 등) 추가 시의 정합성을 위해 축 표준화와 벡터 회전 변환이 필수적임.

## 근거 (Evidence)
- **`apps/game-server/src/lobby/http.ts`**: `initialization.omegaX`가 진행 방향과 관계없이 항상 `cueBall.spinX`에 할당되어, 샷 방향과 회전축이 어긋남을 확인.
- **`packages/physics-core/src/ball-surface-friction.ts`**: 슬립 속도 계산(`vSlipX = vx + radius * spinZ`, `vSlipY = vy - radius * spinX`) 시 속도와 회전축이 수직이 아닐 경우 횡력이 발생하여 굴절을 유도함.
- **`apps/game-server/src/game/cushion-contact-throw.ts`**: 쿠션 충돌 시 `spinX += contactTorqueSpinDelta * normalDirection` 로직이 항상 `spinX`만 수정하는 버그 확인.

## 후속 작업 (Next Steps)
1. `packages/physics-core/src/initial-angular-velocity.ts`의 `omegaZ`를 `omegaY`(사이드 스핀)로 명칭 및 의미 변경.
2. `apps/game-server/src/lobby/http.ts`에서 샷 방향 각도를 이용해 상/하단 회전 벡터를 월드 좌표계(`spinX`, `spinZ`)로 회전 변환하여 할당.
3. `apps/game-server/src/game/cushion-contact-throw.ts`에서 쿠션 축(`axis`)에 따라 토크를 `spinX` 또는 `spinZ`에 배분하도록 수정.
4. 전역 물리 테스트 수행 및 굴절 현상 제거 확인.
