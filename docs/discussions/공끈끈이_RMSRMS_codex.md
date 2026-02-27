# 공끈끈이

- key: RMSRMS
- work_id: RMSRMS1
- model_name: codex
- created_at: 2026-02-27 23:36:22 +0900

## 배경
- 증상: 공-공 충돌 시 입사각/반사각이 비현실적이고, 충돌 후 공이 잠깐 붙어서 엉기는 느낌이 발생한다.
- 관찰 범위: `apps/web`의 로컬 물리 엔진(`SimplePhysics`) 경로에서 재현된다.

## 쟁점
- 논쟁 포인트: 주 원인이 "마찰/반발계수 튜닝 문제"인지, "충돌 임펄스 적용 조건의 부호 로직 버그"인지.

## 선택지
- 선택지 A: 마찰/반발계수(`BALL_BALL_RESTITUTION`, 접선 마찰 계수)만 조정한다.
- 선택지 B: 상대속도-법선 내적의 부호 판정을 수정해 임펄스 스킵 버그를 먼저 해결한다.

## 결정
- 최종 결론: 선택지 B를 우선 적용해야 한다. 현재 증상은 튜닝보다 먼저 충돌 판정/임펄스 적용 조건이 뒤집힌 구조적 문제에 가깝다.

## 근거
- 코드 근거 1: 충돌 법선은 `ball1 -> ball2`로 계산한다. [SimplePhysics.ts:190](/Users/minhyeongjun/IdeaProjects/bhc/apps/web/src/core/SimplePhysics.ts:190)
- 코드 근거 2: 상대속도를 `ball1 - ball2`로 잡고 `velocityAlongNormal > 0`이면 임펄스를 스킵한다. [SimplePhysics.ts:221](/Users/minhyeongjun/IdeaProjects/bhc/apps/web/src/core/SimplePhysics.ts:221), [SimplePhysics.ts:224](/Users/minhyeongjun/IdeaProjects/bhc/apps/web/src/core/SimplePhysics.ts:224)
- 코드 근거 3: 임펄스 스킵 전에도 위치 분리(`separation`)는 먼저 적용되어 겹침-분리 반복이 발생할 수 있다. [SimplePhysics.ts:217](/Users/minhyeongjun/IdeaProjects/bhc/apps/web/src/core/SimplePhysics.ts:217)
- 코드 근거 4: 프레임당 충돌 처리 루프를 4회 반복해 잘못된 판정의 체감이 커진다. [SimplePhysics.ts:79](/Users/minhyeongjun/IdeaProjects/bhc/apps/web/src/core/SimplePhysics.ts:79)

## 후속 작업
- 작업 1: `resolveBallCollision`에서 상대속도 정의/스킵 조건을 일관된 부호 규약으로 수정한다.
- 작업 2: 수정 후 동일 샷에서 반사각/분리 거리 회귀 테스트를 추가한다.
- 작업 3: 필요 시 그 다음 단계에서만 마찰/반발계수 튜닝을 진행한다.
