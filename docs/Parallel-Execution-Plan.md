# 병렬 실행 계획 (Codex 에이전트용)

## 1. 목적
- `docs/Execution-Backlog-Micro.md`의 102개 마이크로 태스크를 충돌 없이 병렬 실행한다.
- 에이전트 간 파일 충돌, 상태 경합, 선행 의존 위반을 방지한다.

## 2. 기준 문서
- 실행 단위: `docs/Execution-Backlog-Micro.md`
- 진척도 보드: `docs/Execution-Status.md`
- 제품/규칙: `docs/GDD.md`, `docs/GDD_kr.md`
- 물리/입력: `docs/Physics-Spec.md`, `docs/Input-Schema.md`, `schemas/shot-input-v1.json`
- 규칙 강제: `AGENTS.md`

## 3. 에이전트 역할 분담
- Agent A (`web`):
  - 담당 경로: `apps/web/**`
  - 주요 업무: 로그인/로비/게임방 UI, 입력 UI, 채팅 UI, E2E UI 시나리오 일부

- Agent B (`game-server`):
  - 담당 경로: `apps/game-server/**`
  - 주요 업무: 룸 상태/권한/턴/점수/채팅 서버/입장제어/경기 규칙

- Agent C (`shared/physics/docs/tests`):
  - 담당 경로: `packages/**`, `schemas/**`, `docs/**`, 공통 테스트/CI
  - 주요 업무: shared types, 물리 계산, 스키마/문서, 통합 검증

## 4. 충돌 방지 규칙
1. 같은 파일은 동시에 2개 에이전트가 수정하지 않는다.
2. 공용 파일(`package.json`, `turbo.json`, CI, 루트 설정)은 Wave 시작/종료에 1명만 수정한다.
3. `in_progress` 상태는 동일 Task ID에 대해 1명만 가질 수 있다.
4. 의존 태스크가 `done`이 아니면 후속 태스크를 시작하지 않는다.
5. Wave 종료 시 통합 검증이 실패하면 다음 Wave로 넘어가지 않는다.

## 5. 상태 관리 규칙
- 단일 소스: `docs/Execution-Status.md`
- 상태값: `todo | in_progress | done | blocked`
- 각 에이전트는 세션 종료 시 아래 4개를 반드시 업데이트한다.
  1. selected task ID
  2. done/not done
  3. validation results
  4. next task ID

## 6. Wave 계획

### Wave 0 (직렬, 기반 세팅)
- 범위:
  - `INF-001A~C`
  - `INF-002A~C`
  - `INF-003A~C`
- 담당:
  - Agent C 단독 수행 권장 (루트/공용 설정 집중)
- 게이트:
  - 워크스페이스 인식
  - turbo lint 스모크 통과

### Wave 1 (병렬, 인증 기반)
- Agent A:
  - 인증 UI 골격(웹 화면/폼 구조) 관련 태스크
- Agent B:
  - `AUTH-001A~C`, `AUTH-003A~B`
- Agent C:
  - `AUTH-002A~C`, shared auth types
- 통합:
  - `AUTH-003C`

### Wave 2 (병렬, 로비/정렬)
- Agent A:
  - 로비 리스트 렌더링, 생성 폼, 실패 처리 UI
- Agent B:
  - `LOB-002A~B`, `LOB-003A~B`
- Agent C:
  - `LOB-001A~C`, `LOB-003C`
- 통합:
  - 목록 API + UI 연동 E2E 스모크

### Wave 3 (병렬, 방/권한)
- Agent A:
  - 게임방 기본 레이아웃/방장 버튼 노출 UI
- Agent B:
  - `ROOM-001A~C`, `ROOM-003A~B`
- Agent C:
  - `ROOM-002A~C`, 권한/위임 테스트
- 통합:
  - `ROOM-003C`

### Wave 4 (병렬, 경기 코어)
- Agent A:
  - 턴/타이머/점수판 UI 상태 반영
- Agent B:
  - `GAME-001A~C`, `GAME-002A~C`
- Agent C:
  - `GAME-003A~C`, `GAME-004A~C`
- 통합:
  - 시작->턴->종료->재경기 기본 플로우 테스트

### Wave 5 (병렬, 입력/물리)
- Agent A:
  - `INPUT-002A`, `INPUT-002B`, `INPUT-002D`
- Agent B:
  - `INPUT-001A~C` (서버 입력 검증)
- Agent C:
  - `INPUT-002C`, `PHY-001A~C`, `PHY-002A~C`
- 통합:
  - 입력 payload -> 물리 계산 -> 서버 판정 흐름 검증

### Wave 6 (병렬, 채팅)
- Agent A:
  - `CHAT-002C` + 채팅 UI 마감
- Agent B:
  - `CHAT-001A~C`, `CHAT-002A~B`
- Agent C:
  - 채팅 통합 테스트/경계 케이스
- 통합:
  - 룸 내부 전파 + 3초 제한 확인

### Wave 7 (병렬, GDD 보강 RULE)
- Agent A:
  - `RULE-006B`, `RULE-007B`
- Agent B:
  - `RULE-001A~D`, `RULE-002A~C`, `RULE-003A~B`, `RULE-005A~C`, `RULE-006A`, `RULE-007A`
- Agent C:
  - `RULE-001E`, `RULE-002D`, `RULE-003C`, `RULE-004A~C`, `RULE-005D`, `RULE-006C`, `RULE-007C`, `RULE-008A~C`, `RULE-009A~C`, `RULE-010A~D`
- 통합:
  - 3쿠션 판정/정지 판정/동시성 회귀 테스트

### Wave 8 (직렬, 릴리스 검증)
- 범위:
  - `QA-001A~C`
  - `QA-002A~C`
- 담당:
  - Agent C 주도, Agent A/B 지원
- 게이트:
  - 핵심 E2E pass
  - 스모크/로그 점검 완료

## 7. Wave별 공통 게이트
1. `docs/Execution-Status.md` 요약 수치 업데이트
2. 실패 테스트 0건 또는 block 사유 명시
3. 다음 Wave 시작 전 `blocked` 해소 여부 확인
4. 스펙 변경이 있었다면 `spec_guard.py` 검증

## 8. 블로커 처리 프로토콜
1. 상태를 즉시 `blocked`로 변경
2. `Note`에 재현 조건/에러 로그/영향 Task 기록
3. 동일 Wave 내 해결 가능하면 우선 처리
4. 불가하면 다음 직렬 슬롯(Hotfix)로 승격

## 9. 권장 실행 순서
1. Wave 0 완료
2. Wave 1~7 병렬 수행 (각 Wave 게이트 통과 조건)
3. Wave 8에서 최종 검증

## 10. 완료 선언 기준
- `docs/Execution-Status.md`에서 `Done = 102`
- `Blocked = 0`
- 핵심 E2E/스모크 테스트 통과
- GDD 정책 위반 케이스 없음
