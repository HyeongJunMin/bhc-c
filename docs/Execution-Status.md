# 병렬 실행 진척도 보드

## 사용 규칙
- 상태값은 `todo`, `in_progress`, `done`, `blocked` 중 하나만 사용한다.
- 한 Task ID는 동시에 한 에이전트만 `in_progress`로 잡는다.
- 작업 종료 시 `Validation`과 `Next Task`를 반드시 채운다.
- 업데이트 시간은 `YYYY-MM-DD HH:mm` 형식으로 기록한다.

## 요약
| Metric | Value |
|---|---|
| Total Tasks | 113 |
| Todo | 3 |
| In Progress | 0 |
| Done | 109 |
| Blocked | 1 |
| Last Updated | 2026-02-22 17:22 |

## 에이전트 상태
| Agent | Current Task | Status | Updated At | Note |
|---|---|---|---|---|
| Agent A (web) | WEB-AUTH-001B | done | 2026-02-22 17:22 | 로그인/회원가입/게스트 폼 UI 구성 완료 |
| Agent B (game-server) | - | idle | - | - |
| Agent C (shared/physics/docs) | - | idle | 2026-02-22 10:54 | INF-002C 재시도(출력 없음, 여전히 blocked) |

## 작업 보드
| Task ID | Agent | Status | Updated At | Validation | PR/Commit | Next Task | Note |
|---|---|---|---|---|---|---|---|
| INF-001A | Agent C | done | 2026-02-21 23:17 | `cat package.json` 확인 | - | INF-001B | 루트 package.json 생성 완료 |
| INF-001B | Agent C | done | 2026-02-21 23:18 | `cat pnpm-workspace.yaml` 확인 | - | INF-001C | pnpm workspace 패턴 추가 완료 |
| INF-001C | Agent C | done | 2026-02-21 23:21 | `npx pnpm -v`, `npx pnpm install` 통과 | - | INF-002A | pnpm-lock.yaml 생성 확인 |
| INF-002A | Agent C | done | 2026-02-21 23:22 | `cat turbo.json` 확인 | - | INF-002B | turbo 구성 파일 생성 완료 |
| INF-002B | Agent C | done | 2026-02-21 23:23 | `cat turbo.json` 확인 | - | INF-002C | turbo tasks 정의 완료 |
| INF-002C | Agent C | blocked | 2026-02-22 10:54 | `npx turbo run lint` 재시도했으나 출력 없이 대기 | - | INF-003A | turbo 실행 환경 확인 필요 |
| INF-003A | Agent C | done | 2026-02-21 23:30 | `ls -la apps/web apps/game-server` 확인 | - | INF-003B | web/game-server package 골격 추가 완료 |
| INF-003B | Agent C | done | 2026-02-21 23:32 | `ls -la packages/shared-types packages/physics-core` 확인 | - | INF-003C | packages 골격 추가 완료 |
| INF-003C | Agent C | done | 2026-02-21 23:33 | `npx pnpm -r list --depth -1` 통과 | - | AUTH-001A | workspace 인식 확인 완료 |
| AUTH-001A | Agent C | done | 2026-02-21 23:35 | `cat package.json`, `cat node-pg-migrate.config.js` 확인 | - | AUTH-001B | migration 설정 파일 추가 완료 |
| AUTH-001B | Agent C | done | 2026-02-21 23:36 | `ls migrations`, `sed migration file` 확인 | - | AUTH-001C | users 테이블 migration 추가 완료 |
| AUTH-001C | Agent C | done | 2026-02-21 23:41 | `docker exec psql`로 users up/down 검증 | - | AUTH-002A | npm 네트워크 제한으로 동등 SQL 검증 수행 |
| AUTH-002A | Agent C | done | 2026-02-21 23:42 | `sed password.ts` 확인 | - | AUTH-002B | hashPassword 유틸 추가 완료 |
| AUTH-002B | Agent C | done | 2026-02-21 23:45 | `rg`, `sed password.ts` 확인 | - | AUTH-002C | verifyPassword 구현 완료 |
| AUTH-002C | Agent C | done | 2026-02-21 23:48 | `node --experimental-strip-types --test ...` 통과(3 pass) | - | AUTH-003A | 비밀번호 유닛테스트 추가 완료 |
| AUTH-003A | Agent C | done | 2026-02-21 23:50 | `node --experimental-strip-types -e ... signup duplicate` 확인 | - | AUTH-003B | signup/중복검증 로직 추가 완료 |
| AUTH-003B | Agent C | done | 2026-02-21 23:52 | `node --experimental-strip-types -e ... login` 확인 | - | AUTH-003C | login/JWT 발급 로직 구현 완료 |
| AUTH-003C | Agent C | done | 2026-02-21 23:53 | `node --experimental-strip-types --test http.test.ts` 통과(2 pass) | - | LOB-001A | guest 로그인/통합 테스트 완료 |
| LOB-001A | Agent C | done | 2026-02-21 23:54 | `cat room-summary.ts` 확인 | - | LOB-001B | RoomSummary 타입 추가 완료 |
| LOB-001B | Agent C | done | 2026-02-21 23:55 | `cat room-state.ts`, `cat room-summary.ts` 확인 | - | LOB-001C | RoomState enum 분리 완료 |
| LOB-001C | Agent C | done | 2026-02-21 23:56 | `cat packages/shared-types/src/index.ts` 확인 | - | LOB-002A | shared-types export 경로 정리 완료 |
| LOB-002A | Agent C | done | 2026-02-21 23:58 | `node --experimental-strip-types -e ...` 확인 | - | LOB-002B | 제목 15자 유효성 검사 구현 완료 |
| LOB-002B | Agent C | done | 2026-02-21 23:59 | `node --experimental-strip-types -e ... createRoom` 확인 | - | LOB-002C | 방 생성(중복 허용) 로직 추가 완료 |
| LOB-002C | Agent C | done | 2026-02-22 00:01 | `node --experimental-strip-types --test lobby/http.test.ts` 통과(3 pass) | - | LOB-003A | 방 생성 정책 테스트 완료 |
| LOB-003A | Agent C | done | 2026-02-22 00:02 | `node --experimental-strip-types -e ...` 확인 | - | LOB-003B | WAITING 우선 comparator 구현 완료 |
| LOB-003B | Agent C | done | 2026-02-22 00:03 | `node --experimental-strip-types -e ... sort` 확인 | - | LOB-003C | 2차/3차 정렬 기준 구현 완료 |
| LOB-003C | Agent C | done | 2026-02-22 00:04 | `node --experimental-strip-types --test sort-rooms.test.ts` 통과(1 pass) | - | ROOM-001A | 로비 정렬 테스트 완료 |
| ROOM-001A | Agent C | done | 2026-02-22 00:06 | `node --experimental-strip-types -e ... isRoomFull` 확인 | - | ROOM-001B | 최대 6인 제한 로직 추가 완료 |
| ROOM-001B | Agent C | done | 2026-02-22 00:07 | `node --experimental-strip-types -e ... isJoinBlockedByState` 확인 | - | ROOM-001C | IN_GAME 입장 차단 로직 추가 완료 |
| ROOM-001C | Agent C | done | 2026-02-22 00:08 | `node --experimental-strip-types -e ... evaluateRoomJoin` 확인 | - | ROOM-002A | 입장 거부 코드 표준화 완료 |
| ROOM-002A | Agent C | done | 2026-02-22 00:09 | `node --experimental-strip-types -e ... host` 확인 | - | ROOM-002B | host/입장순 자료구조 추가 완료 |
| ROOM-002B | Agent C | done | 2026-02-22 00:11 | `node --experimental-strip-types -e ... removeMember` 확인 | - | ROOM-002C | host 이탈 자동 위임 로직 완료 |
| ROOM-002C | Agent C | done | 2026-02-22 00:23 | `node --experimental-strip-types --test host-policy.test.ts` 통과(2 pass) | - | ROOM-003A | host 위임 이벤트/테스트 완료 |
| ROOM-003A | Agent C | done | 2026-02-22 00:24 | `node --experimental-strip-types -e ... requireHostPermission` 확인 | - | ROOM-003B | 비방장 명령 차단 로직 완료 |
| ROOM-003B | Agent C | done | 2026-02-22 00:26 | `node --experimental-strip-types -e ... executeKickCommand` 확인 | - | ROOM-003C | 강퇴+disconnect 이벤트 로직 완료 |
| ROOM-003C | Agent C | done | 2026-02-22 00:27 | `node --experimental-strip-types --test kick-policy.test.ts` 통과(3 pass) | - | GAME-001A | 강퇴 권한/상태 검증 테스트 완료 |
| GAME-001A | Agent C | done | 2026-02-22 00:28 | `node --experimental-strip-types -e ... startGameRequest` 확인 | - | GAME-001B | start 요청 핸들러 분리 완료 |
| GAME-001B | Agent C | done | 2026-02-22 00:30 | `node --experimental-strip-types -e ... GAME_NOT_ENOUGH_PLAYERS` 확인 | - | GAME-001C | 최소 2인 시작 검증 추가 완료 |
| GAME-001C | Agent C | done | 2026-02-22 00:31 | `node --experimental-strip-types --test start-policy.test.ts` 통과(3 pass) | - | GAME-002A | 시작 실패 코드 테스트 완료 |
| GAME-002A | Agent C | done | 2026-02-22 00:36 | `node --experimental-strip-types --test game/turn-policy.test.ts` 통과(3 pass) | - | GAME-002B | 입장순 턴 큐 초기화/순환 테스트 완료 |
| GAME-002B | Agent C | done | 2026-02-22 00:37 | `node --experimental-strip-types --test game/turn-timer.test.ts` 통과(3 pass) | - | GAME-002C | 10초 턴 타이머 start/cancel 유틸 및 테스트 완료 |
| GAME-002C | Agent C | done | 2026-02-22 00:38 | `node --experimental-strip-types --test game/turn-policy.test.ts` 통과(5 pass) | - | GAME-003A | timeout 자동 턴 스킵 처리/테스트 완료 |
| GAME-003A | Agent C | done | 2026-02-22 00:38 | `node --experimental-strip-types --test game/score-policy.test.ts` 통과(3 pass) | - | GAME-003B | 점수판 초기화/점수 증가 내부 함수 구현 완료 |
| GAME-003B | Agent C | done | 2026-02-22 00:39 | `node --experimental-strip-types --test game/score-policy.test.ts` 통과(5 pass) | - | GAME-003C | 10점 도달 즉시 종료 분기 로직/테스트 완료 |
| GAME-003C | Agent C | done | 2026-02-22 00:40 | `node --experimental-strip-types --test game/elimination-policy.test.ts` 통과(3 pass) | - | GAME-004A | 중도 이탈 패배/1인 생존 승리 종료 테스트 완료 |
| GAME-004A | Agent C | done | 2026-02-22 00:41 | `node --experimental-strip-types --test game/rematch-policy.test.ts` 통과(2 pass) | - | GAME-004B | 재경기 점수 초기화 로직/테스트 완료 |
| GAME-004B | Agent C | done | 2026-02-22 00:41 | `node --experimental-strip-types --test game/rematch-policy.test.ts` 통과(4 pass) | - | GAME-004C | 재경기 상태 IN_GAME 전이/턴 순서 유지 로직 완료 |
| GAME-004C | Agent C | done | 2026-02-22 00:42 | `node --experimental-strip-types --test game/rematch-policy.test.ts` 통과(5 pass) | - | INPUT-001A | 재경기 직후 상태 스냅샷 검증 테스트 완료 |
| INPUT-001A | Agent C | done | 2026-02-22 00:43 | `node --experimental-strip-types --test input/shot-schema-validator.test.ts` 통과(3 pass) | - | INPUT-001B | shot-input-v1 스키마 validator 연결 완료 |
| INPUT-001B | Agent C | done | 2026-02-22 00:44 | `node --experimental-strip-types --test input/shot-input-entry.test.ts` 통과(2 pass) | - | INPUT-001C | 샷 입력 진입점 validator 적용 완료 |
| INPUT-001C | Agent C | done | 2026-02-22 00:45 | `node --experimental-strip-types --test input/shot-input-entry.test.ts` 통과(3 pass) | - | INPUT-002A | invalid payload 에러 코드 일관성 테스트 완료 |
| INPUT-002A | Agent C | done | 2026-02-22 00:45 | `node --experimental-strip-types --test input/control-mapping.test.ts` 통과(2 pass) | - | INPUT-002B | 수평 360도 회전 매핑 함수/테스트 완료 |
| INPUT-002B | Agent C | done | 2026-02-22 00:46 | `node --experimental-strip-types --test input/control-mapping.test.ts` 통과(4 pass) | - | INPUT-002C | 수직 각도 0~89 클램프 매핑 완료 |
| INPUT-002C | Agent C | done | 2026-02-22 00:47 | `node --experimental-strip-types --test input/control-mapping.test.ts` 통과(6 pass) | - | INPUT-002D | drag px -> m/s 선형 매핑 함수/테스트 완료 |
| INPUT-002D | Agent C | done | 2026-02-22 00:48 | `node --experimental-strip-types --test input/control-mapping.test.ts` 통과(9 pass) | - | PHY-001A | WASD 당점 이동 벡터 처리 로직/테스트 완료 |
| PHY-001A | Agent C | done | 2026-02-22 00:49 | `node --experimental-strip-types --test packages/physics-core/src/initial-velocity.test.ts` 통과(2 pass) | - | PHY-001B | 초기 선속도 수식/역산 함수 구현 완료 |
| PHY-001B | Agent C | done | 2026-02-22 00:50 | `node --experimental-strip-types --test packages/physics-core/src/initial-angular-velocity.test.ts` 통과(2 pass) | - | PHY-001C | 초기 각속도 수식 함수 구현 완료 |
| PHY-001C | Agent C | done | 2026-02-22 00:51 | `node --experimental-strip-types --test packages/physics-core/src/shot-init.test.ts` 통과(2 pass) | - | PHY-002A | 최소/최대 drag·offset 경계값 테스트 완료 |
| PHY-002A | Agent C | done | 2026-02-22 00:51 | `node --experimental-strip-types --test packages/physics-core/src/miscue.test.ts` 통과(2 pass) | - | PHY-002B | 미스큐 판정 함수 구현 완료 |
| PHY-002B | Agent C | done | 2026-02-22 00:52 | `node --experimental-strip-types --test packages/physics-core/src/miscue.test.ts` 통과(3 pass) | - | PHY-002C | 0.89R/0.9R/0.91R 임계치 테스트 완료 |
| PHY-002C | Agent C | done | 2026-02-22 00:53 | `node --experimental-strip-types --test packages/physics-core/src/shot-events.test.ts` 통과(2 pass) | - | CHAT-001A | 미스큐 결과 이벤트 매핑 어댑터 완료 |
| CHAT-001A | Agent C | done | 2026-02-22 00:54 | `node --experimental-strip-types --test apps/game-server/src/chat/room-chat.test.ts` 통과(1 pass) | - | CHAT-001B | 룸 범위 채팅 broadcast 로직 구현 완료 |
| CHAT-001B | Agent C | done | 2026-02-22 00:55 | `node --experimental-strip-types --test apps/game-server/src/chat/room-chat.test.ts` 통과(2 pass) | - | CHAT-001C | 룸별 메모리 채팅 버퍼 저장 로직 완료 |
| CHAT-001C | Agent C | done | 2026-02-22 00:56 | `node --experimental-strip-types --test apps/game-server/src/chat/room-chat.test.ts` 통과(3 pass) | - | CHAT-002A | 룸 종료 시 채팅 버퍼 해제 처리 완료 |
| CHAT-002A | Agent C | done | 2026-02-22 00:57 | `node --experimental-strip-types --test apps/game-server/src/chat/rate-limit.test.ts` 통과(2 pass) | - | CHAT-002B | 사용자별 마지막 전송 시각 저장 로직 완료 |
| CHAT-002B | Agent C | done | 2026-02-22 00:58 | `node --experimental-strip-types --test apps/game-server/src/chat/rate-limit.test.ts` 통과(4 pass) | - | CHAT-002C | 3초 이내 채팅 전송 거부 로직 구현 완료 |
| CHAT-002C | Agent C | done | 2026-02-22 00:59 | `node --experimental-strip-types --test apps/game-server/src/chat/rate-limit.test.ts` 통과(5 pass) | - | QA-001A | 레이트리밋 위반 피드백 메시지 처리/테스트 완료 |
| QA-001A | Agent C | done | 2026-02-22 10:16 | `node --experimental-strip-types --test apps/game-server/src/qa/core-scenarios.test.ts` 통과(1 pass) | - | QA-001B | 로그인->로비->방입장 핵심 시나리오 작성 완료 |
| QA-001B | Agent C | done | 2026-02-22 10:17 | `node --experimental-strip-types --test apps/game-server/src/qa/core-scenarios.test.ts` 통과(2 pass) | - | QA-001C | 시작->플레이->10점 종료 핵심 시나리오 작성 완료 |
| QA-001C | Agent C | done | 2026-02-22 10:17 | `node --experimental-strip-types --test apps/game-server/src/qa/core-scenarios.test.ts` 통과(3 pass) | - | QA-002A | 타임아웃/중도이탈/강퇴 핵심 시나리오 작성 완료 |
| QA-002A | Agent C | done | 2026-02-22 10:18 | `node --experimental-strip-types scripts/qa/smoke-six-connections.ts` 통과 | - | QA-002B | 6인 동시 접속 스모크 스크립트 준비 완료 |
| QA-002B | Agent C | done | 2026-02-22 10:19 | `QA_DURATION_MS=2000 QA_TICK_MS=500 node --experimental-strip-types scripts/qa/collect-play-errors.ts` 통과(errorCount=0) | - | QA-002C | 10분 플레이 에러 로그 수집 스크립트 준비 완료 |
| QA-002C | Agent C | done | 2026-02-22 10:20 | `node --experimental-strip-types -e \"process.memoryUsage()\"` 확인 | - | RULE-001A | 메모리 관찰 기준/결과 문서화 완료 |
| RULE-001A | Agent C | done | 2026-02-22 10:21 | `node --experimental-strip-types --test packages/physics-core/src/three-cushion-model.test.ts` 통과(2 pass) | - | RULE-001B | 턴 득점 판정 입력 모델(충돌 이벤트 리스트) 정의 완료 |
| RULE-001B | Agent C | done | 2026-02-22 10:21 | `node --experimental-strip-types --test packages/physics-core/src/three-cushion-model.test.ts` 통과(4 pass) | - | RULE-001C | 두 목적구 접촉 판정 구현 완료 |
| RULE-001C | Agent C | done | 2026-02-22 10:22 | `node --experimental-strip-types --test packages/physics-core/src/three-cushion-model.test.ts` 통과(6 pass) | - | RULE-001D | 최소 3쿠션 판정 구현 완료 |
| RULE-001D | Agent C | done | 2026-02-22 10:23 | `node --experimental-strip-types --test packages/physics-core/src/three-cushion-model.test.ts` 통과(8 pass) | - | RULE-001E | 3쿠션 득점 종합 판정 함수 구현 완료 |
| RULE-001E | Agent C | done | 2026-02-22 10:24 | `node --experimental-strip-types --test packages/physics-core/src/three-cushion-model.test.ts` 통과(11 pass) | - | RULE-002A | 3쿠션 판정 참/거짓/경계 테스트 세트 완료 |
| RULE-002A | Agent C | done | 2026-02-22 10:25 | `node --experimental-strip-types --test packages/physics-core/src/turn-event-tracker.test.ts` 통과(1 pass) | - | RULE-002B | 턴 시작 이벤트 추적기 초기화 함수 구현 완료 |
| RULE-002B | Agent C | done | 2026-02-22 10:28 | `node --experimental-strip-types --test packages/physics-core/src/turn-event-tracker.test.ts` 통과(2 pass) | - | RULE-002C | 턴 이벤트 append 로직 구현 완료 |
| RULE-002C | Agent C | done | 2026-02-22 10:29 | `node --experimental-strip-types --test packages/physics-core/src/turn-event-tracker.test.ts` 통과(3 pass) | - | RULE-002D | 턴 종료 이벤트 스냅샷 반환 구현 완료 |
| RULE-002D | Agent C | done | 2026-02-22 10:29 | `node --experimental-strip-types --test packages/physics-core/src/turn-event-tracker.test.ts` 통과(4 pass) | - | RULE-003A | 턴 경계 상태 누수 테스트 완료 |
| RULE-003A | Agent C | done | 2026-02-22 10:30 | `node --experimental-strip-types --test packages/physics-core/src/shot-end.test.ts` 통과(3 pass) | - | RULE-003B | 샷 종료 속도/각속도 임계값 상수 정의 완료 |
| RULE-003B | Agent C | done | 2026-02-22 10:31 | `node --experimental-strip-types --test packages/physics-core/src/shot-end.test.ts` 통과(5 pass) | - | RULE-003C | N프레임 연속 정지 판정 로직 구현 완료 |
| RULE-003C | Agent C | done | 2026-02-22 10:32 | `node --experimental-strip-types --test packages/physics-core/src/shot-end.test.ts` 통과(7 pass) | - | RULE-004A | 조기 종료/무한 턴 방지 테스트 완료 |
| RULE-004A | Agent C | done | 2026-02-22 10:32 | `node --experimental-strip-types --test packages/physics-core/src/rack-layout.test.ts` 통과(2 pass) | - | RULE-004B | 시작 배치 좌표 상수 정의 완료 |
| RULE-004B | Agent C | done | 2026-02-22 10:33 | `node --experimental-strip-types --test packages/physics-core/src/rack-layout.test.ts` 통과(3 pass) | - | RULE-004C | 시작 배치 적용 함수 구현 완료 |
| RULE-004C | Agent C | done | 2026-02-22 10:34 | `node --experimental-strip-types --test packages/physics-core/src/rack-layout.test.ts` 통과(4 pass) | - | RULE-005A | 재경기 재배치+초기상태 검증 테스트 완료 |
| RULE-005A | Agent C | done | 2026-02-22 10:35 | `node --experimental-strip-types --test packages/physics-core/src/physics-events.test.ts` 통과(2 pass) | - | RULE-005B | 물리 이벤트 도메인 타입 정의 완료 |
| RULE-005B | Agent C | done | 2026-02-22 10:36 | `node --experimental-strip-types --test packages/physics-core/src/score-adapter.test.ts` 통과(2 pass) | - | RULE-005C | 물리 이벤트 -> 득점 판정 어댑터 구현 완료 |
| RULE-005C | Agent C | done | 2026-02-22 10:36 | `node --experimental-strip-types --test packages/physics-core/src/turn-resolution.test.ts` 통과(2 pass) | - | RULE-005D | 득점/실패별 턴 전환 정책 구현 완료 |
| RULE-005D | Agent C | done | 2026-02-22 10:37 | `node --experimental-strip-types --test packages/physics-core/src/score-adapter.integration.test.ts` 통과(2 pass) | - | RULE-006A | 물리 이벤트 mock 기반 통합 테스트 완료 |
| RULE-006A | Agent C | done | 2026-02-22 10:38 | `node --experimental-strip-types --test apps/game-server/src/room/spectator-policy.test.ts` 통과(2 pass) | - | RULE-006B | 서버 측 관전자 join 차단 로직 구현 완료 |
| RULE-006B | Agent C | done | 2026-02-22 10:39 | `node --experimental-strip-types --test apps/game-server/src/room/spectator-policy.test.ts` 통과(3 pass) | - | RULE-006C | 관전자 차단 에러 문구 매핑 정리 완료 |
| RULE-006C | Agent C | done | 2026-02-22 10:39 | `node --experimental-strip-types --test apps/game-server/src/qa/core-scenarios.test.ts` 통과(4 pass) | - | RULE-007A | 관전 시도 실패 E2E 케이스 추가 완료 |
| RULE-007A | Agent C | done | 2026-02-22 10:40 | `node --experimental-strip-types --test apps/game-server/src/lobby/pagination.test.ts` 통과(2 pass) | - | RULE-007B | 로비 조회 hasMore 계약 추가 완료 |
| RULE-007B | Agent C | done | 2026-02-22 10:41 | `node --experimental-strip-types --test apps/game-server/src/lobby/pagination.test.ts` 통과(4 pass) | - | RULE-007C | infinite scroll 중단 조건 적용 완료 |
| RULE-007C | Agent C | done | 2026-02-22 10:42 | `node --experimental-strip-types --test apps/game-server/src/lobby/pagination.test.ts` 통과(5 pass) | - | RULE-008A | 마지막 페이지/중복요청 경계 테스트 완료 |
| RULE-008A | Agent C | done | 2026-02-22 10:42 | `node --experimental-strip-types --test packages/shared-types/src/error-codes.test.ts` 통과(1 pass) | - | RULE-008B | 공통 에러 코드 enum 정의 완료 |
| RULE-008B | Agent C | done | 2026-02-22 10:43 | `cat docs/Error-Codes.md` 확인 | - | RULE-008C | 공통 에러 코드 문서 작성 완료 |
| RULE-008C | Agent C | done | 2026-02-22 10:44 | `cat docs/Error-Codes.md` 확인 | - | RULE-009A | 기존 API 응답 코드 매핑 정리 완료 |
| RULE-009A | Agent C | done | 2026-02-22 10:45 | `node --experimental-strip-types --test apps/game-server/src/game/rematch-policy.test.ts` 통과(6 pass) | - | RULE-009B | 재경기 직후 점수/턴 검증 케이스 추가 완료 |
| RULE-009B | Agent C | done | 2026-02-22 10:46 | `node --experimental-strip-types --test packages/physics-core/src/rack-layout.test.ts` 통과(5 pass) | - | RULE-009C | 재경기 공 위치/속도/스핀 초기화 검증 강화 완료 |
| RULE-009C | Agent C | done | 2026-02-22 10:47 | `node --experimental-strip-types --test packages/physics-core/src/turn-event-tracker.test.ts` 통과(5 pass) | - | RULE-010A | 재경기 이전 턴 이벤트 이력 초기화 구현 완료 |
| RULE-010A | Agent C | done | 2026-02-22 10:48 | `node --experimental-strip-types --test apps/game-server/src/game/start-policy.test.ts` 통과(4 pass) | - | RULE-010B | 시작 버튼 연타 멱등성 테스트 추가 완료 |
| RULE-010B | Agent C | done | 2026-02-22 10:49 | `node --experimental-strip-types --test apps/game-server/src/room/kick-policy.test.ts` 통과(4 pass) | - | RULE-010C | 강퇴/자진퇴장 경합 순서 테스트 추가 완료 |
| RULE-010C | Agent C | done | 2026-02-22 10:50 | `node --experimental-strip-types --test apps/game-server/src/game/turn-policy.test.ts` 통과(7 pass) | - | RULE-010D | 턴 만료 직전 샷 입력 경합 테스트/게이트 추가 완료 |
| RULE-010D | Agent C | done | 2026-02-22 10:51 | `node --experimental-strip-types --test apps/game-server/src/game/state-transition.test.ts` 통과(2 pass) | - | - | 상태 전이 원자성 검증(assert) 추가 완료 |
| WEB-AUTH-001A | Agent A | done | 2026-02-22 17:20 | `WEB_PORT=9217 pnpm --filter @bhc/web run dev`, `curl -sS http://localhost:9217/login \| head -n 5` 확인 | - | WEB-AUTH-001B | `/login` 라우트 및 기본 인증 페이지 골격 추가 완료 |
| WEB-AUTH-001B | Agent A | done | 2026-02-22 17:22 | `WEB_PORT=9217 pnpm --filter @bhc/web run dev`, `curl -sS http://localhost:9217/login \| rg \"login-form\|signup-form\|guest-form\"` 확인 | - | WEB-AUTH-001C | 로그인/회원가입/게스트 폼 UI 및 메시지 영역 구성 완료 |
| WEB-AUTH-001C | - | todo | - | - | - | - | - |
| WEB-AUTH-001D | - | todo | - | - | - | - | - |
| WEB-AUTH-001E | - | todo | - | - | - | - | - |
