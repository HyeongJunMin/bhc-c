# 병렬 실행 진척도 보드

## 사용 규칙
- 상태값은 `todo`, `in_progress`, `done`, `blocked` 중 하나만 사용한다.
- 한 Task ID는 동시에 한 에이전트만 `in_progress`로 잡는다.
- 작업 종료 시 `Validation`과 `Next Task`를 반드시 채운다.
- 업데이트 시간은 `YYYY-MM-DD HH:mm` 형식으로 기록한다.

## 요약
| Metric | Value |
|---|---|
| Total Tasks | 212 |
| Todo | 0 |
| In Progress | 0 |
| Done | 212 |
| Blocked | 0 |
| Last Updated | 2026-02-27 14:34 |

## 에이전트 상태
| Agent | Current Task | Status | Updated At | Note |
|---|---|---|---|---|
| Agent A (web) | PHYS-CT-007 | done | 2026-02-24 11:48 | 쿠션 접촉시간 근사 모델 문서/코드/테스트/QA 통합 반영 완료 |
| Agent B (game-server) | QA-OBS-013A | done | 2026-02-24 20:22 | Unity 수동 플레이 체크리스트 문서화 완료 |
| Agent C (shared/physics/docs) | INF-002C | done | 2026-02-23 09:16 | 오프라인 실행 경로로 lint 스모크 통과 |

## 작업 보드
| Task ID | Agent | Status | Updated At | Validation | PR/Commit | Next Task | Note |
|---|---|---|---|---|---|---|---|
| INF-001A | Agent C | done | 2026-02-21 23:17 | `cat package.json` 확인 | - | INF-001B | 루트 package.json 생성 완료 |
| INF-001B | Agent C | done | 2026-02-21 23:18 | `cat pnpm-workspace.yaml` 확인 | - | INF-001C | pnpm workspace 패턴 추가 완료 |
| INF-001C | Agent C | done | 2026-02-21 23:21 | `npx pnpm -v`, `npx pnpm install` 통과 | - | INF-002A | pnpm-lock.yaml 생성 확인 |
| INF-002A | Agent C | done | 2026-02-21 23:22 | `cat turbo.json` 확인 | - | INF-002B | turbo 구성 파일 생성 완료 |
| INF-002B | Agent C | done | 2026-02-21 23:23 | `cat turbo.json` 확인 | - | INF-002C | turbo tasks 정의 완료 |
| INF-002C | Agent C | done | 2026-02-23 09:16 | `pnpm run lint` 통과(워크스페이스 4개 lint placeholder 실행) | - | INF-003A | 오프라인 환경으로 루트 스크립트를 pnpm -r 기반으로 전환해 스모크 완료 |
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
| INPUT-002D | Agent C | done | 2026-02-22 00:48 | `node --experimental-strip-types --test input/control-mapping.test.ts` 통과(9 pass) | - | INPUT-002E | WASD 당점 이동 벡터 처리 로직/테스트 완료 |
| INPUT-002E | Agent A | done | 2026-02-23 10:01 | `python3 scripts/ci/spec_guard.py ...`, `pnpm --filter @bhc/game-server test`, `pnpm --filter @bhc/physics-core test` 통과 | - | ROOM-UI-002A | 최대 스트로크를 1000px→400px로 문서/스키마/코드/테스트 동기화 완료 |
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
| WEB-AUTH-001C | Agent A | done | 2026-02-22 17:25 | `pnpm --filter @bhc/game-server run dev`, `WEB_PORT=9217 pnpm --filter @bhc/web run dev`, `curl -sS -X POST http://localhost:9217/api/auth/*` 3종 확인 | - | WEB-AUTH-001D | 웹 서버 인증 프록시 및 폼 제출 API 연동 완료 |
| WEB-AUTH-001D | Agent A | done | 2026-02-22 17:29 | `WEB_PORT=9217 pnpm --filter @bhc/web run dev`, `curl -sS http://localhost:9217/login \| rg \"bhc_auth\|/lobby\"`, `curl -sS http://localhost:9217/lobby` 확인 | - | WEB-AUTH-001E | 인증 성공 시 토큰 localStorage 저장 및 /lobby 페이지 라우트 구현 완료 |
| WEB-AUTH-001E | Agent A | done | 2026-02-22 17:32 | `curl -sS -X POST http://localhost:9217/api/auth/signup` 성공/중복, `curl -sS -X POST http://localhost:9217/api/auth/login` 실패, `curl -sS http://localhost:9217/login \| rg \"ERROR_MESSAGES\"` 확인 | - | - | 인증 실패 코드 사용자 메시지 매핑 및 네트워크 오류 처리 스모크 완료 |
| WEB-LOBBY-001 | Agent A | done | 2026-02-22 17:39 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts`, `curl -sS -X POST http://localhost:9213/api/lobby/rooms` + `curl -sS http://localhost:9213/api/lobby/rooms?offset=0&limit=50` 확인 | - | - | /lobby 방 목록 조회/방 생성 UI 및 /api/lobby/rooms 프록시/조회 API 구현 완료 |
| WEB-ROOM-001 | Agent A | done | 2026-02-22 17:46 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts`, `curl -sS -X POST http://localhost:9217/api/lobby/rooms`, `curl -sS -X POST http://localhost:9217/api/lobby/rooms/room-1/join` 확인 | - | - | 로비 카드 입장 버튼, /api/lobby/rooms/:id/join 프록시, /room/:id 진입 페이지 구현 완료 |
| ROOM-API-001 | Agent A | done | 2026-02-22 17:57 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 확인 | - | ROOM-UI-001 | GET /lobby/rooms/:roomId 및 host/members 응답, join payload(memberId/displayName) 지원 완료 |
| ROOM-UI-001 | Agent A | done | 2026-02-22 17:59 | `AUTH_PORT=9214 LOBBY_PORT=9215 + WEB_PORT=9217` 임시 실행 후 `curl -X POST /api/lobby/rooms`, `curl -X POST /api/lobby/rooms/room-1/join`, `curl /room/room-1` 확인 | - | ROOM-RT-001 | /room/:id 방 정보/참가자/호스트/액션 패널 데이터 렌더링 및 room detail 프록시 연결 완료 |
| ROOM-RT-001 | Agent A | done | 2026-02-22 20:17 | `curl -sS http://localhost:9217/lobby \| rg \"setInterval\\(loadRooms, 3000\\)\"`, `curl -sS http://localhost:9217/room/room-1 \| rg \"setInterval\\(loadRoom, 3000\\)\"` 확인 | - | ROOM-ACTION-001 | 로비/룸 페이지 자동 폴링(3초)으로 새로고침 없는 상태 동기화 구현 완료 |
| ROOM-ACTION-001 | Agent A | done | 2026-02-23 07:55 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts`, 분리포트 실행 후 `curl -X POST /api/lobby/rooms/:id/start|kick|rematch`, `curl /room/room-1` 확인 | - | ROOM-ACTION-002 | 룸 start/kick/rematch 서버 액션 및 UI 버튼 연동 완료 |
| ROOM-ACTION-002 | Agent A | done | 2026-02-23 07:56 | `curl -sS http://localhost:9217/room/room-1 \| rg \"ROOM_ERROR_MESSAGES|getRoomErrorMessage|canStart|canRematch\"` 확인 | - | ROOM-CHAT-001 | 룸 액션 오류 메시지 매핑 및 상태/인원 기반 버튼 활성 조건 정교화 완료 |
| ROOM-CHAT-001 | Agent A | done | 2026-02-23 08:22 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts`, 분리포트 실행 후 `curl -X POST /api/lobby/rooms/:id/chat`, `curl /api/lobby/rooms/:id/chat`, `curl /room/room-1` 확인 | - | GAME-UI-001 | 룸 채팅 조회/전송 API 및 /room 채팅 패널 연동 완료 |
| GAME-UI-001 | Agent A | done | 2026-02-23 08:24 | `curl -sS http://localhost:9217/room/room-1 \| rg \"hud-turn|hud-timer|hud-scoreboard|setInterval\\(\\)\"` 확인 | - | PLAY-INPUT-001 | 룸 화면 HUD(현재 턴/10초 타이머/점수판) 기본 표시 구현 완료 |
| PLAY-INPUT-001 | Agent A | done | 2026-02-23 08:27 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts`, 분리포트 실행 후 `curl -X POST /api/lobby/rooms/:id/shot` 성공/실패 확인, `curl /room/room-1` 샷 폼 확인 | - | PLAY-INPUT-002 | 룸 샷 입력 폼과 서버 샷 스키마 검증 API 연동 완료 |
| PLAY-INPUT-002 | Agent A | done | 2026-02-23 08:29 | `curl -sS http://localhost:9217/room/room-1 \| rg \"shot-errors|result.data.errors\"` 확인 | - | PLAY-FLOW-001 | 샷 검증 실패 시 validation errors[] 상세 메시지 표시 UI 추가 완료 |
| PLAY-FLOW-001 | Agent A | done | 2026-02-23 08:41 | `curl -sS http://localhost:9217/room/room-1 \| rg \"flow-banner|setFlowBanner|IN_GAME|FINISHED\"` 확인 | - | LOBBY-SYNC-001 | 경기 상태 배너 및 멤버 제외 시 로비 자동 복귀 흐름 구현 완료 |
| LOBBY-SYNC-001 | Agent A | done | 2026-02-23 08:43 | `curl -sS http://localhost:9217/lobby \| rg \"joinLabel|IN_GAME|disabled\"` 확인 | - | QA-E2E-001 | 로비 카드에서 IN_GAME 상태 방 입장 버튼 비활성화 및 상태 라벨 반영 완료 |
| QA-E2E-001 | Agent A | done | 2026-02-23 09:18 | `node --experimental-strip-types scripts/qa/e2e-room-flow.ts` 통과 | - | - | 게스트 로그인→방생성/입장→시작→채팅→샷→강퇴 통합 흐름 스모크 자동화 완료 |
| ROOM-ARCH-001 | Agent A | done | 2026-02-23 09:54 | `cat docs/Room-Play-Plan.md`, `cat docs/Execution-Backlog-Micro.md` 확인 | - | ROOM-UI-002A | ROOM-UI-001 이후 A안(20Hz)/B안(TODO) 상세 실행계획 문서화 완료 |
| ROOM-UI-002A | Agent A | done | 2026-02-23 10:22 | `WEB_PORT=9217 pnpm --filter @bhc/web run dev`, `curl -sS http://localhost:9217/room/room-1 \| rg \"room-stage\|table-top.png\"`, `curl -sS -D - http://localhost:9217/assets/table/table-top.png -o /tmp/bhc/table-top.bin` 확인 | - | ROOM-UI-002B | Canvas 2D 스테이지/테이블 이미지 렌더 골격 구현 완료 |
| ROOM-UI-002B | Agent A | done | 2026-02-23 10:24 | `WEB_PORT=9217 pnpm --filter @bhc/web run dev`, `curl -sS http://localhost:9217/room/room-1 \| rg \"worldToCanvas\|canvasToWorld\|resizeStageCanvas\"`, `curl -sS -D - http://localhost:9217/assets/table/table-top.png -o /tmp/bhc/table-top.bin` 확인 | - | ROOM-UI-002C | 월드좌표<->캔버스 좌표 변환/반응형 스케일 적용 완료 |
| ROOM-UI-002C | Agent A | done | 2026-02-23 10:26 | `WEB_PORT=9217 pnpm --filter @bhc/web run dev`, `curl -sS http://localhost:9217/room/room-1 \| rg \"interpolateSnapshots\|requestAnimationFrame\|pushSnapshot\"`, `curl -sS -D - http://localhost:9217/assets/table/table-top.png -o /tmp/bhc/table-top.bin` 확인 | - | ROOM-NET-001A | 공 렌더/snapshot 보간 루프 구현 완료 |
| ROOM-NET-001A | Agent A | done | 2026-02-23 10:28 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts`, `curl /lobby/rooms/:id/stream?memberId=u2`(ROOM_STREAM_FORBIDDEN), `curl /lobby/rooms/:id/stream?memberId=u1` 확인 | - | ROOM-NET-001B | 룸 snapshot 스트림 엔드포인트 추가 및 비멤버 403 정책 적용 완료 |
| ROOM-NET-001B | Agent A | done | 2026-02-23 10:33 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts`, `curl --max-time 1.2 /lobby/rooms/:id/stream?memberId=u1` 이벤트 수 24건/1.2초 확인 | - | ROOM-NET-001C | 20Hz broadcaster/seq 기반 full snapshot 전송 구현 완료 |
| ROOM-NET-001C | Agent A | done | 2026-02-23 10:34 | `WEB_PORT=9217 ... @bhc/web run dev`, `curl /api/room-stream/room-1?memberId=u2`(ROOM_STREAM_FORBIDDEN), `curl --max-time 1.2 /api/room-stream/room-1?memberId=u1` 이벤트 수 24건 확인 | - | ROOM-SIM-001A | web 프록시/연결 경로 및 room 페이지 스트림 연결 연동 완료 |
| ROOM-SIM-001A | Agent A | done | 2026-02-23 10:35 | `node --experimental-strip-types --test apps/game-server/src/game/shot-state-machine.test.ts`, `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과 | - | ROOM-SIM-001B | shot 상태머신 구현 및 running 중 중복 샷 거부 가드 연동 완료 |
| ROOM-SIM-001B | Agent A | done | 2026-02-23 10:37 | `node --experimental-strip-types --test apps/game-server/src/game/snapshot-serializer.test.ts`, `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과 | - | ROOM-SIM-001C | 물리 tick -> snapshot 직렬화 파이프라인 구현 완료 |
| ROOM-SIM-001C | Agent A | done | 2026-02-23 10:41 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts`, `curl --max-time 1.6 /lobby/rooms/:id/stream?memberId=u1`에서 shot_started/shot_resolved/turn_changed 확인 | - | ROOM-INPUT-003A | shot 종료/턴전환 이벤트 브로드캐스트 연계 완료 |
| ROOM-INPUT-003A | Agent A | done | 2026-02-23 10:43 | `WEB_PORT=9217 ... @bhc/web run dev`, `curl /room/room-1 | rg \"pointerdown|pointerup|submitShotInput|canvas-drag\"` 확인 | - | ROOM-INPUT-003B | 조준/드래그 샷 입력 UI 구성 완료 |
| ROOM-INPUT-003B | Agent A | done | 2026-02-23 10:44 | `WEB_PORT=9217 ... @bhc/web run dev`, `curl /room/room-1 | rg \"shotSubmitInFlight|shotInputLocked|updateShotInputLockUi|shot_started|turn_changed\"` 확인 | - | ROOM-INPUT-003C | 샷 진행 중 중복 입력 잠금 및 피드백 UX 연동 완료 |
| ROOM-INPUT-003C | Agent A | done | 2026-02-23 10:45 | `WEB_PORT=9217 ... @bhc/web run dev`, `curl /room/room-1 | rg \"setShotValidationDetails|SHOT_STATE_CONFLICT|dragPx 범위를 확인\"` 확인 | - | ROOM-QA-002A | 샷 검증 실패(errorCode/errors[]) 룸 UI 통합 표시 완료 |
| ROOM-QA-002A | Agent A | done | 2026-02-23 10:49 | `QA_BASE_URL=http://localhost:9217 node --experimental-strip-types scripts/qa/room-single-client-shot.ts` 통과 | - | ROOM-QA-002B | 1클라 샷->정지->턴전환 스모크 자동화 완료 |
| ROOM-QA-002B | Agent A | done | 2026-02-23 10:49 | `QA_BASE_URL=http://localhost:9217 node --experimental-strip-types scripts/qa/room-two-client-drift.ts` 통과(overlap=47,maxDrift=0.000000) | - | ROOM-QA-002C | 2클라 snapshot drift/seq 검증 자동화 완료 |
| ROOM-QA-002C | Agent A | done | 2026-02-23 10:49 | `QA_BASE_URL=http://localhost:9217 node --experimental-strip-types scripts/qa/room-stream-recovery.ts` 통과(first=2ms,recovery=2ms) | - | - | 스트림 단절 가정 fallback/polling + 재연결 복구 검증 완료 |
| LOBBY-PAGE-001A | Agent A | done | 2026-02-23 11:07 | `rg -n \"offset=0&limit=9\" apps/web/src/main.ts` 확인 | - | LOBBY-PAGE-001B | 로비 기본 조회 `limit=9` 고정 적용 완료 |
| LOBBY-PAGE-001B | Agent A | done | 2026-02-23 11:15 | `rg -n \"nextOffset|hasMore|isLoading|lastRequestedOffset\" apps/web/src/main.ts` 확인 | - | LOBBY-PAGE-001C | offset/hasMore/isLoading 상태머신 추가 완료 |
| LOBBY-PAGE-001C | Agent A | done | 2026-02-23 11:15 | `rg -n \"IntersectionObserver|room-list-sentinel|loadRoomsPage\\(\\{ reset: false\" apps/web/src/main.ts` 확인 | - | LOBBY-PAGE-001D | IntersectionObserver 기반 무한스크롤 추가 완료 |
| LOBBY-PAGE-001D | Agent A | done | 2026-02-23 11:15 | `node --experimental-strip-types --test apps/game-server/src/lobby/pagination.test.ts` 통과(5 pass) | - | HUD-REAL-001A | 중복요청/끝페이지 경계 검증 통과 |
| HUD-REAL-001A | Agent A | done | 2026-02-23 11:18 | `node --experimental-strip-types --test apps/game-server/src/game/snapshot-serializer.test.ts` 통과(2 pass) | - | HUD-REAL-001B | room snapshot/detail payload에 scoreBoard/currentTurn/deadline 필드 확장 완료 |
| HUD-REAL-001B | Agent A | done | 2026-02-23 11:18 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(19 pass) | - | HUD-REAL-001C | shot lifecycle에 turn 인덱스/turnDeadline 갱신 로직 연동 완료 |
| HUD-REAL-001C | Agent A | done | 2026-02-23 11:18 | `rg -n \"renderHud\\(|scoreBoard|turnDeadlineMs|getRemainingTurnSeconds\" apps/web/src/main.ts` 확인 | - | HUD-REAL-001D | 웹 HUD 서버 authoritative 렌더 전환 완료 |
| HUD-REAL-001D | Agent A | done | 2026-02-23 11:28 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(26 pass) | - | GAME-END-001A | 턴 전환 후 deadline/currentTurn 동기화 테스트 추가 완료 |
| GAME-END-001A | Agent A | done | 2026-02-23 11:20 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(20 pass) | - | GAME-END-001B | shot_resolved 시 score-policy 런타임 연결 완료 |
| GAME-END-001B | Agent A | done | 2026-02-23 11:20 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(20 pass) | - | GAME-END-001C | 10점 즉시 FINISHED 전이 구현 완료 |
| GAME-END-001C | Agent A | done | 2026-02-23 11:20 | `rg -n \"game_finished|winnerMemberId|memberGameStates\" apps/game-server/src/lobby/http.ts apps/web/src/main.ts` 확인 | - | GAME-END-001D | winner/loser 상태 이벤트/API 반영 완료 |
| GAME-END-001D | Agent A | done | 2026-02-23 11:21 | `rg -n \"currentRoomState|currentTurnMemberId|shotInputLocked = room.state !== 'IN_GAME'\" apps/web/src/main.ts` 확인 | - | LEAVE-001A | FINISHED/비턴 플레이어 샷 입력 잠금 조건 반영 완료 |
| LEAVE-001A | Agent A | done | 2026-02-23 11:23 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(21 pass) | - | LEAVE-001B | `POST /lobby/rooms/:roomId/leave` API 및 웹 나가기 버튼 연동 완료 |
| LEAVE-001B | Agent A | done | 2026-02-23 11:24 | `rg -n \"DISCONNECT_GRACE_MS|scheduleDisconnectGraceTimer|disconnectGraceTimers\" apps/game-server/src/lobby/http.ts` 확인 | - | LEAVE-001C | disconnect 10초 유예 타이머 구현 완료 |
| LEAVE-001C | Agent A | done | 2026-02-23 11:24 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(22 pass) | - | LEAVE-001D | 미복귀 LOSE 확정/멤버 제거 및 1인 생존 승리 종료 반영 완료 |
| LEAVE-001D | Agent A | done | 2026-02-23 11:25 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(23 pass) | - | HOST-DELEGATE-001A | 유예 중 재접속 시 disconnect 타이머 해제 테스트 추가 완료 |
| HOST-DELEGATE-001A | Agent A | done | 2026-02-23 11:26 | `rg -n \"removeMemberFromRoom|leaveRoomMember|kickRoomMember\" apps/game-server/src/lobby/http.ts` 확인 | - | HOST-DELEGATE-001B | kick/leave/disconnect 제거 경로 공통화 완료 |
| HOST-DELEGATE-001B | Agent A | done | 2026-02-23 11:26 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(24 pass) | - | HOST-DELEGATE-001C | host 이탈 자동 위임 실경로 연동 완료 |
| HOST-DELEGATE-001C | Agent A | done | 2026-02-23 11:26 | `rg -n \"host_delegated|방장이 변경되었습니다\" apps/game-server/src/lobby/http.ts apps/web/src/main.ts` 확인 | - | CHAT-RL-001A | host 위임 이벤트 발행 및 UI 갱신 연동 완료 |
| CHAT-RL-001A | Agent A | done | 2026-02-23 11:03 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(19 pass) | - | CHAT-RL-001B | room chat API에 3초 레이트리밋 연결 및 429/retryAfterMs 테스트 추가 완료 |
| CHAT-RL-001B | Agent A | done | 2026-02-23 11:27 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(25 pass) | - | CHAT-RL-001C | `CHAT_RATE_LIMITED`/`retryAfterMs` 응답 계약 고정 및 검증 완료 |
| CHAT-RL-001C | Agent A | done | 2026-02-23 11:06 | `rg -n \"CHAT_RATE_LIMITED|getChatErrorMessage|retryAfterMs\" apps/web/src/main.ts` 확인 | - | CHAT-RL-001D | room UI 잔여 대기시간 메시지 반영 완료 |
| CHAT-RL-001D | Agent A | done | 2026-02-23 11:27 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(25 pass) | - | INPUT-FULL-001A | 더블클릭/동시요청 회귀 테스트 추가 완료 |
| INPUT-FULL-001A | Agent A | done | 2026-02-23 11:31 | `rg -n \"keydown|W/A/S/D|impactOffsetLimitR\" apps/web/src/main.ts` 확인 | - | INPUT-FULL-001B | WASD 당점 이동(`[-0.9R,+0.9R]`) 구현 완료 |
| INPUT-FULL-001B | Agent A | done | 2026-02-23 11:31 | `rg -n \"movementY|shotElevation\" apps/web/src/main.ts` 확인 | - | INPUT-FULL-001C | 마우스 상하 고각 제어 UX 추가 완료 |
| INPUT-FULL-001C | Agent A | done | 2026-02-23 11:31 | `rg -n \"impact-indicator|drawImpactOverlay\" apps/web/src/main.ts` 확인 | - | INPUT-FULL-001D | 당점/고각 오버레이 시각화 완료 |
| INPUT-FULL-001D | Agent A | done | 2026-02-23 11:31 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(26 pass) | - | PHYS-RUNTIME-001A | shot payload(impactOffset/elevation) 반영 및 회귀 검증 완료 |
| PHYS-RUNTIME-001A | Agent A | done | 2026-02-23 11:32 | `rg -n \"createInitialRoomBalls|balls: SnapshotBallFrame\\[\\]\" apps/game-server/src/lobby/http.ts` 확인 | - | PHYS-RUNTIME-001B | room별 물리 상태(볼 배열) 및 초기배치 생성 완료 |
| PHYS-RUNTIME-001B | Agent A | done | 2026-02-23 11:32 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(26 pass) | - | PHYS-RUNTIME-001C | shot 입력 -> 초기 속도/스핀 적용 구현 완료 |
| PHYS-RUNTIME-001C | Agent A | done | 2026-02-23 11:32 | `rg -n \"stepRoomPhysics|ROOM_SNAPSHOT_BROADCAST_INTERVAL_MS|buildRoomSnapshot\" apps/game-server/src/lobby/http.ts` 확인 | - | PHYS-RUNTIME-001D | 20Hz tick/snapshot/SSE 연동 완료 |
| PHYS-RUNTIME-001D | Agent A | done | 2026-02-23 11:34 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(26 pass) | - | PHYS-RUNTIME-001E | 정지판정(or fallback) 기반 샷 종료 -> 점수/턴/종료 이벤트 연계 완료 |
| PHYS-RUNTIME-001E | Agent A | done | 2026-02-23 11:34 | `rg -n \"Number.isFinite\\(|clampNumber\\(|stepRoomPhysics\" apps/game-server/src/lobby/http.ts` 확인 | - | - | 물리 스텝 NaN/Infinity 정규화 및 경계값 방어 적용 완료 |
| ROOM-UI-003A | Agent A | done | 2026-02-23 15:37 | `pnpm --filter @bhc/web run lint` 통과 | - | ROOM-UI-003B | 조준 입력 상태기계(`idle/aiming/shotPending`)와 조준 가능 조건 게이트 적용 완료 |
| ROOM-UI-003B | Agent A | done | 2026-02-23 15:39 | `pnpm --filter @bhc/web run lint` 통과 | - | ROOM-UI-003C | 캔버스 큐 스틱/조준 가이드 렌더링 완료 |
| ROOM-UI-003C | Agent A | done | 2026-02-23 15:40 | `pnpm --filter @bhc/web run lint` 통과 | - | ROOM-UI-004 | 스트로크 거리 매핑 상수화(`10~400px`)와 payload/입력 클램프 일원화 완료 |
| ROOM-UI-004A | Agent A | done | 2026-02-23 15:47 | `pnpm --filter @bhc/web run lint` 통과 | - | ROOM-UI-004B | 큐볼 기준 Ray-쿠션 1차 교차 계산 유틸 적용 완료 |
| ROOM-UI-004B | Agent A | done | 2026-02-23 15:49 | `pnpm --filter @bhc/web run lint` 통과 | - | ROOM-UI-004C | 목적구 1차 충돌 후보 계산 및 최단 충돌 선택 완료 |
| ROOM-UI-004C | Agent A | done | 2026-02-23 15:50 | `pnpm --filter @bhc/web run lint` 통과 | - | PHYS-COLL-001A | aiming 상태 예측선/충돌점 마커 렌더 및 숨김 조건 적용 완료 |
| PHYS-COLL-001A | Agent A | done | 2026-02-23 15:58 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과 | - | PHYS-COLL-001B | 공-공 충돌 쌍 검사(O(n^2)) 구현 완료 |
| PHYS-COLL-001B | Agent A | done | 2026-02-23 15:58 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과 | - | PHYS-COLL-001C | 탄성 충돌 임펄스(`e_bb=0.95`) 적용 완료 |
| PHYS-COLL-001C | Agent A | done | 2026-02-23 15:58 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과 | - | PHYS-COLL-001D | 겹침 보정(positional correction)/속도 상한/NaN 가드 적용 완료 |
| PHYS-COLL-001D | Agent A | done | 2026-02-23 15:58 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과 | - | PHYS-COLL-TEST-001A | shot 타이머 물리 substep 적용 + stream heartbeat 이중 스텝 제거 완료 |
| PHYS-COLL-TEST-001A | Agent A | done | 2026-02-23 15:59 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과 | - | PHYS-COLL-TEST-001B | 정면 충돌 전달 테스트 추가 완료 |
| PHYS-COLL-TEST-001B | Agent A | done | 2026-02-23 15:59 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과 | - | ROOM-SYNC-002A | 비충돌 경로 회귀 테스트 추가 완료 |
| ROOM-UI-005A | Agent A | done | 2026-02-24 10:28 | `pnpm --filter @bhc/web run lint` 통과, `node --input-type=module` 경로해석/파일읽기 검증(inside=true, ok=true) 통과 | - | ROOM-UI-005B | 테이블 정적 에셋 경로 정규화로 /assets/table/* 404 핫픽스 완료 |
| ROOM-UI-005B | Agent A | done | 2026-02-24 10:45 | `node --experimental-strip-types scripts/qa/room-table-layer-assets.ts` 통과(local/source pass, http skip), `pnpm --filter @bhc/web run lint` 통과 | - | ROOM-UI-005C | 테이블 frame/cloth 2:1 규격 보정 및 레이어 순서 QA 자동화 스크립트 추가 완료 |
| ROOM-UI-005C | Agent A | done | 2026-02-24 10:55 | `pnpm run qa:table-layer:local` 통과, `pnpm run qa:table-layer:http`에서 QA_BASE_URL 미설정 시 즉시 실패(assert) 확인 | - | ROOM-UI-005D | table layer HTTP 검증 경로 강제(mode 기반) 및 루트 실행 스크립트 추가 완료 |
| ROOM-UI-005D | Agent A | done | 2026-02-24 10:55 | `pnpm run qa:table-layer:local` 통과(레거시 `table-top.png` 참조 잔존 검사 포함) | - | ROOM-UI-005E | table-top 레거시 참조 제거 정책을 QA로 강제 |
| ROOM-UI-005E | Agent A | done | 2026-02-24 10:55 | `pnpm run qa:table-boundary` 통과 | - | ROOM-UI-005F | 공 가시 경계/물리 경계 상수 및 경계조건 일치성 자동 검증 완료 |
| ROOM-UI-005F | Agent A | done | 2026-02-24 10:55 | `QA_BASE_URL=http://127.0.0.1:<mock-port> pnpm run qa:table-layer:render-http` 통과 | - | ROOM-UI-005G | HTTP 기반 렌더 순서(frame->cloth->balls) 회귀 자동 검증 완료 |
| ROOM-UI-005G | Agent A | done | 2026-02-24 10:55 | `pnpm run qa:table-responsive` 통과 | - | - | 반응형 2:1 비율/뷰포트 왜곡 회귀 자동 검증 완료 |
| PHYS-CT-001 | Agent A | done | 2026-02-24 11:48 |  근사식/상수 반영 확인 | - | PHYS-CT-002 | 쿠션 접촉시간 근사 모델 규칙( 속도 의존) 확정 완료 |
| PHYS-CT-002 | Agent A | done | 2026-02-24 11:48 | [spec-guard] OK
[spec-guard] checked files: 3 통과 | - | PHYS-CT-003 | 물리 문서 영/한 동기화 및 상수() 반영 완료 |
| PHYS-CT-003 | Agent A | done | 2026-02-24 11:48 | ✔ 방 생성 성공: 유효 제목이면 생성된다 (4.8085ms)
✔ 방 생성 실패: 제목이 비어있으면 거부된다 (0.115625ms)
✔ 방 생성 실패: 제목이 15자를 초과하면 거부된다 (0.0875ms)
✔ 방 목록 조회: WAITING 우선, 인원 적은 순, 최신 생성 순으로 정렬된다 (0.172875ms)
✔ 방 입장 성공: 대기방 정원 미만이면 입장된다 (0.201709ms)
✔ 방 입장 실패: 존재하지 않는 방이면 ROOM_NOT_FOUND (0.088916ms)
✔ 방 상세 조회: 존재하는 roomId면 상세를 반환한다 (0.11425ms)
✔ 게임 시작: 방장이고 2인 이상이면 IN_GAME으로 전환된다 (0.181333ms)
✔ 강퇴: 방장이 타겟 멤버를 제거하면 인원이 감소한다 (0.240625ms)
✔ 나가기: 멤버가 leave를 호출하면 룸에서 제거되고 host가 비면 다음 멤버로 위임된다 (0.371875ms)
✔ 방장 나가기: host_delegated 이벤트가 발행되고 다음 멤버가 host가 된다 (0.193291ms)
✔ 재경기: 방장이고 2인 이상이면 IN_GAME으로 전환된다 (0.111208ms)
✔ 채팅 전송: 룸 멤버면 메시지가 저장된다 (0.149042ms)
✔ 채팅 전송: 3초 이내 연속 전송이면 CHAT_RATE_LIMITED를 반환한다 (0.0775ms)
✔ 채팅 전송: 동일 시점 2회 요청 시 1회만 성공하고 나머지는 CHAT_RATE_LIMITED로 거부된다 (0.137709ms)
✔ 샷 입력 제출: 스키마 유효 payload면 accepted 된다 (0.52475ms)
✔ 공-공 충돌: 수구 진행선에 목적구가 있으면 목적구 속도가 증가한다 (241.675125ms)
✔ 공-공 충돌: substep 사이 중간 교차도 충돌로 처리한다 (80.933333ms)
✔ 비충돌 경로: 목적구 진행선에 없으면 목적구 속도는 0에 가깝다 (240.393667ms)
✔ 샷 입력 제출: 스키마 위반 payload면 SHOT_INPUT_SCHEMA_INVALID (0.424083ms)
✔ 샷 입력 제출: running 상태에서 중복 제출하면 SHOT_STATE_CONFLICT (0.383416ms)
✔ 샷 종료: 10점 도달 시 FINISHED와 winner가 설정되고 game_finished 이벤트가 발행된다 (62.281666ms)
✔ 연결해제 유예 만료: IN_GAME에서 미복귀 시 LOSE 처리되고 1인 생존자는 즉시 WIN으로 종료된다 (0.473708ms)
✔ 연결복구: 유예 타이머가 존재해도 스트림 재접속 시 타이머가 해제된다 (0.503125ms)
✔ 룸 스트림 오픈: 룸 멤버면 snapshot을 반환한다 (0.120708ms)
✔ 룸 스트림 오픈: 비멤버는 ROOM_STREAM_FORBIDDEN(403) (0.076875ms)
✔ 룸 스트림 snapshot seq는 같은 room에서 단조 증가한다 (0.124542ms)
✔ 샷 제출 후 shot_started -> shot_resolved -> turn_changed 이벤트 순서로 브로드캐스트된다 (62.367375ms)
✔ HUD 동기화: 샷 종료 후 turnDeadlineMs가 갱신되고 currentTurnIndex가 다음 플레이어로 이동한다 (61.488208ms)
ℹ tests 29
ℹ suites 0
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 19722.986834 통과(29 pass) | - | PHYS-CT-004 | game-server 쿠션 충돌에 접촉시간 근사 throw 로직 반영 완료 |
| PHYS-CT-004 | Agent A | done | 2026-02-24 11:48 | ✔ 스핀이 없으면 직각 입사에서 반사각은 0도에 가깝다 (0.951708ms)
✔ 같은 스핀에서 속도가 낮을수록 반사각이 커진다 (0.101292ms)
✔ 스핀 방향에 따라 접선 반사 방향이 바뀐다 (0.087125ms)
✔ 최대 반사각 상한을 넘지 않는다 (0.073042ms)
ℹ tests 4
ℹ suites 0
ℹ pass 4
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 195.563334 통과(4 pass) | - | PHYS-CT-005 | 접촉시간 근사 로직 단위 테스트 추가 완료 |
| PHYS-CT-005 | Agent A | done | 2026-02-24 11:48 | strokePct	speedMps	angleDeg
10	1.991538	42.774
20	3.313590	26.666
30	4.635641	18.555
40	5.957692	13.950
50	7.279744	11.051
60	8.601795	9.082
70	9.923846	7.669
80	11.245897	6.611
90	12.567949	5.791
100	13.890000	5.140
PHYS-CT-QA pass: contact-time throw angle table generated 통과 | - | PHYS-CT-006 | 10~100% 반사각 표 생성/단조성 검증 QA 자동화 완료 |
| PHYS-CT-006 | Agent A | done | 2026-02-24 11:48 | [spec-guard] OK
[spec-guard] checked files: 3 통과 | - | PHYS-CT-007 | 스펙 가드 검증 완료 |
| PHYS-CT-007 | Agent A | done | 2026-02-24 11:48 | ✔ 방 생성 성공: 유효 제목이면 생성된다 (4.331917ms)
✔ 방 생성 실패: 제목이 비어있으면 거부된다 (0.089125ms)
✔ 방 생성 실패: 제목이 15자를 초과하면 거부된다 (0.083125ms)
✔ 방 목록 조회: WAITING 우선, 인원 적은 순, 최신 생성 순으로 정렬된다 (0.172334ms)
✔ 방 입장 성공: 대기방 정원 미만이면 입장된다 (0.15ms)
✔ 방 입장 실패: 존재하지 않는 방이면 ROOM_NOT_FOUND (0.062625ms)
✔ 방 상세 조회: 존재하는 roomId면 상세를 반환한다 (0.165334ms)
✔ 게임 시작: 방장이고 2인 이상이면 IN_GAME으로 전환된다 (0.268667ms)
✔ 강퇴: 방장이 타겟 멤버를 제거하면 인원이 감소한다 (0.253625ms)
✔ 나가기: 멤버가 leave를 호출하면 룸에서 제거되고 host가 비면 다음 멤버로 위임된다 (0.241584ms)
✔ 방장 나가기: host_delegated 이벤트가 발행되고 다음 멤버가 host가 된다 (0.164333ms)
✔ 재경기: 방장이고 2인 이상이면 IN_GAME으로 전환된다 (0.117458ms)
✔ 채팅 전송: 룸 멤버면 메시지가 저장된다 (0.146208ms)
✔ 채팅 전송: 3초 이내 연속 전송이면 CHAT_RATE_LIMITED를 반환한다 (0.076458ms)
✔ 채팅 전송: 동일 시점 2회 요청 시 1회만 성공하고 나머지는 CHAT_RATE_LIMITED로 거부된다 (0.108417ms)
✔ 샷 입력 제출: 스키마 유효 payload면 accepted 된다 (0.497083ms)
✔ 공-공 충돌: 수구 진행선에 목적구가 있으면 목적구 속도가 증가한다 (241.929459ms)
✔ 공-공 충돌: substep 사이 중간 교차도 충돌로 처리한다 (80.666375ms)
✔ 비충돌 경로: 목적구 진행선에 없으면 목적구 속도는 0에 가깝다 (240.966167ms)
✔ 샷 입력 제출: 스키마 위반 payload면 SHOT_INPUT_SCHEMA_INVALID (0.2955ms)
✔ 샷 입력 제출: running 상태에서 중복 제출하면 SHOT_STATE_CONFLICT (0.147458ms)
✔ 샷 종료: 10점 도달 시 FINISHED와 winner가 설정되고 game_finished 이벤트가 발행된다 (61.291292ms)
✔ 연결해제 유예 만료: IN_GAME에서 미복귀 시 LOSE 처리되고 1인 생존자는 즉시 WIN으로 종료된다 (0.31925ms)
✔ 연결복구: 유예 타이머가 존재해도 스트림 재접속 시 타이머가 해제된다 (0.371709ms)
✔ 룸 스트림 오픈: 룸 멤버면 snapshot을 반환한다 (0.094792ms)
✔ 룸 스트림 오픈: 비멤버는 ROOM_STREAM_FORBIDDEN(403) (0.060625ms)
✔ 룸 스트림 snapshot seq는 같은 room에서 단조 증가한다 (0.098625ms)
✔ 샷 제출 후 shot_started -> shot_resolved -> turn_changed 이벤트 순서로 브로드캐스트된다 (60.495ms)
✔ HUD 동기화: 샷 종료 후 turnDeadlineMs가 갱신되고 currentTurnIndex가 다음 플레이어로 이동한다 (62.041916ms)
ℹ tests 29
ℹ suites 0
ℹ pass 29
ℹ fail 0
ℹ cancelled 0
ℹ skipped 0
ℹ todo 0
ℹ duration_ms 19681.9455 통과(29 pass), 
> bhc-c@0.1.0 qa:cushion-contact-time /Users/minhyeongjun/IdeaProjects/bhc
> node --experimental-strip-types scripts/qa/cushion-contact-time-angle-table.ts

strokePct	speedMps	angleDeg
10	1.991538	42.774
20	3.313590	26.666
30	4.635641	18.555
40	5.957692	13.950
50	7.279744	11.051
60	8.601795	9.082
70	9.923846	7.669
80	11.245897	6.611
90	12.567949	5.791
100	13.890000	5.140
PHYS-CT-QA pass: contact-time throw angle table generated 통과 | - | - | 문서/코드/테스트/QA 통합 회귀 검증 완료 |
| PHYS-CT-001 | Agent A | done | 2026-02-24 11:48 | `docs/Physics-Spec*.md` 근사식/상수 반영 확인 | - | PHYS-CT-002 | 쿠션 접촉시간 근사 모델 규칙(`tan(theta)` 속도 의존) 확정 완료 |
| PHYS-CT-002 | Agent A | done | 2026-02-24 11:48 | `python3 scripts/ci/spec_guard.py docs/Physics-Spec.md docs/Physics-Spec_kr.md apps/game-server/src/lobby/http.ts` 통과 | - | PHYS-CT-003 | 물리 문서 영/한 동기화 및 상수(`mu_bc=0.14`) 반영 완료 |
| PHYS-CT-003 | Agent A | done | 2026-02-24 11:48 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(29 pass) | - | PHYS-CT-004 | game-server 쿠션 충돌에 접촉시간 근사 throw 로직 반영 완료 |
| PHYS-CT-004 | Agent A | done | 2026-02-24 11:48 | `node --experimental-strip-types --test apps/game-server/src/game/cushion-contact-throw.test.ts` 통과(4 pass) | - | PHYS-CT-005 | 접촉시간 근사 로직 단위 테스트 추가 완료 |
| PHYS-CT-005 | Agent A | done | 2026-02-24 11:48 | `node --experimental-strip-types scripts/qa/cushion-contact-time-angle-table.ts` 통과 | - | PHYS-CT-006 | 10~100% 반사각 표 생성/단조성 검증 QA 자동화 완료 |
| PHYS-CT-006 | Agent A | done | 2026-02-24 11:48 | `python3 scripts/ci/spec_guard.py docs/Physics-Spec.md docs/Physics-Spec_kr.md apps/game-server/src/lobby/http.ts` 통과 | - | PHYS-CT-007 | 스펙 가드 검증 완료 |
| PHYS-CT-007 | Agent A | done | 2026-02-24 11:48 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(29 pass), `pnpm run qa:cushion-contact-time` 통과 | - | - | 문서/코드/테스트/QA 통합 회귀 검증 완료 |
| QA-OBS-001A | Agent B | done | 2026-02-24 19:39 | `node --experimental-strip-types scripts/qa/smoke-six-connections.ts` 통과(경고 제거 확인) | - | QA-OBS-001B | 루트 `package.json`에 `"type": "module"` 명시로 QA 실행 경고 제거 |
| QA-OBS-001B | Agent B | done | 2026-02-24 19:39 | `QA_DURATION_MS=2200 QA_TICK_MS=100 node --experimental-strip-types scripts/qa/collect-play-errors.ts`, `nl -ba tmp/qa-play-errors.log` 확인 | - | QA-OBS-002A | soak 로그에 `run_started/run_completed` JSON 마커 추가 완료 |
| QA-OBS-002A | Agent B | done | 2026-02-24 19:41 | `QA_DURATION_MS=550 QA_TICK_MS=50 QA_HEARTBEAT_INTERVAL_MS=200 node --experimental-strip-types scripts/qa/collect-play-errors.ts`, `nl -ba tmp/qa-play-errors.log` 확인 | - | QA-OBS-003A | heartbeat 주기 환경변수화 및 heartbeat 로그 기록 검증 완료 |
| QA-OBS-003A | Agent B | done | 2026-02-24 19:51 | `MAX_ITERATIONS=1 SOAK_DURATION_MS=800 SOAK_TICK_MS=100 scripts/agents/v2_team_loop.sh`, `... | tail -n 1 | node -e 'JSON.parse(...)'` 통과 | - | QA-OBS-004A | 팀 루프 종료 시 pass/fail + 로그 경로 JSON 한 줄 출력 보강 완료 |
| QA-OBS-004A | Agent B | done | 2026-02-24 19:53 | `SOAK_DURATION_MS=700 SOAK_TICK_MS=100 scripts/agents/v2_test_agent.sh`, `MAX_ITERATIONS=1 SOAK_DURATION_MS=700 SOAK_TICK_MS=100 scripts/agents/v2_team_loop.sh` 통과 | - | QA-OBS-005A | test-agent 종료 JSON 요약(soak errorCount/로그 경로) 및 팀 루프 통합 출력 검증 완료 |
| QA-OBS-005A | Agent B | done | 2026-02-24 19:55 | `MAX_ITERATIONS=1 SOAK_DURATION_MS=650 SOAK_TICK_MS=100 scripts/agents/v2_team_loop.sh \| node --experimental-strip-types scripts/qa/parse-team-loop-summary.ts` 통과 | - | QA-OBS-006A | 팀 루프 최종 JSON 파서 스크립트 추가 및 `status=pass`/필수 필드 자동 검증 완료 |
| QA-OBS-006A | Agent B | done | 2026-02-24 19:57 | `SOAK_DURATION_MS=650 SOAK_TICK_MS=100 scripts/agents/v2_test_agent.sh \| node --experimental-strip-types scripts/qa/parse-test-agent-summary.ts` 통과 | - | QA-OBS-007A | test-agent 최종 JSON 파서 스크립트 추가 및 `status=pass`/`soakErrorCount=0` 자동 검증 완료 |
| QA-OBS-007A | Agent B | done | 2026-02-24 19:58 | `AUTO_LOOPS=1 MAX_ITERATIONS=1 SOAK_DURATION_MS=700 SOAK_TICK_MS=100 scripts/agents/v2_auto_loop.sh` 통과 | - | QA-OBS-008A | 무인 QA 자동 루프 스크립트 추가 및 파서 연동 스모크 검증 완료 |
| QA-OBS-008A | Agent B | done | 2026-02-24 19:59 | `AUTO_LOOPS=1 MAX_ITERATIONS=0 ... scripts/agents/v2_auto_loop.sh` 실패 JSON 확인, `AUTO_LOOPS=1 MAX_ITERATIONS=1 ... scripts/agents/v2_auto_loop.sh` 성공 경로 통과 | - | QA-OBS-009A | 자동 루프 실패 경로 JSON 요약(`status=fail`, `cycle`, `reason`) 보강 및 양 경로 검증 완료 |
| QA-OBS-009A | Agent B | done | 2026-02-24 20:02 | `AUTO_LOOPS=1 MAX_ITERATIONS=1 SOAK_DURATION_MS=600 SOAK_TICK_MS=100 scripts/agents/v2_auto_loop.sh \| node --experimental-strip-types scripts/qa/parse-auto-loop-summary.ts` 통과 | - | QA-OBS-010A | 자동 루프 완료 JSON 파서 스크립트 추가 및 `status=completed` 자동 검증 완료 |
| QA-OBS-010A | Agent B | done | 2026-02-24 20:04 | `AUTO_LOOPS=1 MAX_ITERATIONS=1 SOAK_DURATION_MS=500 SOAK_TICK_MS=100 scripts/agents/v2_auto_loop.sh \| node --experimental-strip-types scripts/qa/parse-auto-loop-summary.ts`, `rg -n \"v2_auto_loop.sh|JSON 로그 해석\" docs/Unity-Team-Loop_kr.md` 통과 | - | QA-OBS-011A | 운영 문서에 자동 루프 실행/JSON 로그 해석 가이드 반영 완료 |
| QA-OBS-011A | Agent B | done | 2026-02-24 20:14 | `scripts/agents/v2_dev_agent.sh` 통과, `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(29 pass), `MAX_ITERATIONS=1 SOAK_DURATION_MS=500 SOAK_TICK_MS=100 scripts/agents/v2_team_loop.sh \| tail -n 2` 통과 | - | QA-OBS-012A | Unity `BhcRoomApiDriver` 런타임 부트스트랩 추가 및 팀 루프 게이트 동기화 완료 |
| QA-OBS-012A | Agent B | done | 2026-02-24 20:21 | `scripts/agents/v2_dev_agent.sh` 통과, `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(29 pass), `MAX_ITERATIONS=1 SOAK_DURATION_MS=500 SOAK_TICK_MS=100 scripts/agents/v2_team_loop.sh \| tail -n 2` 통과 | - | QA-OBS-013A | Unity runtime SSE(`/lobby/rooms/:id/stream`) 구독 + 폴링 fallback 연동 및 팀 루프/회귀 재검증 완료 |
| QA-OBS-013A | Agent B | done | 2026-02-24 20:22 | `rg -n \"수동 플레이 체크리스트|guest login ok|Submit Test Shot\" unity-client/README.md` 확인 | - | QA-OBS-014A | Unity 수동 플레이 검증 절차(서버 실행/Scene 세팅/성공·실패 신호) 문서화 완료 |
| PHY-AXIS-001A | Agent C | done | 2026-02-27 14:12 | `rg -n "world=Y-up|table plane=XZ|server.y -> world.z" docs/Execution-Backlog*.md`, `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(29 pass) | - | PHY-AXIS-001B | Gate 0 좌표계 기준 문서화/런타임 매핑 기준 고정 완료 |
| PHY-AXIS-001B | Agent C | done | 2026-02-27 14:12 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(29 pass) | - | PHY-AXIS-001C | game-server 물리 상수 통합(`physics-core/constants.ts`) 및 축 의미 정합 완료 |
| PHY-AXIS-001C | Agent C | done | 2026-02-27 14:12 | `node --experimental-strip-types --test packages/physics-core/src/shot-init.test.ts packages/physics-core/src/shot-end.test.ts` 통과 | - | PHY-AXIS-001D | `computeShotInitialization` + `evaluateShotEndWithFrames` 런타임 연결 완료 |
| PHY-AXIS-001D | Agent C | done | 2026-02-27 14:12 | `node --experimental-strip-types --test packages/physics-core/src/ball-surface-friction.test.ts` 통과 | - | PHY-AXIS-001E | 표면 마찰/슬립-롤링 상태머신 도입 완료 |
| PHY-AXIS-001E | Agent C | done | 2026-02-27 14:12 | `node --experimental-strip-types --test packages/physics-core/src/ball-ball-collision.test.ts` 통과 | - | PHY-AXIS-001F | 공-공 접선 임펄스(throw) 도입 완료 |
| PHY-AXIS-001F | Agent C | done | 2026-02-27 14:12 | `node --experimental-strip-types --test apps/game-server/src/game/cushion-contact-throw.test.ts` 통과(6 pass) | - | PHY-AXIS-001G | 쿠션 충돌 스핀 결합(접촉 높이 토크/축 변환) 반영 완료 |
| PHY-AXIS-001G | Agent C | done | 2026-02-27 14:12 | `node --experimental-strip-types --test apps/game-server/src/game/snapshot-serializer.test.ts` 통과(2 pass) | - | - | 서버 내부 좌표 전환 준비를 위한 motionState/물리 상태 확장 및 단계 전환 기반 완료 |
| PHY-AXIS-002A | Agent C | done | 2026-02-27 14:22 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(29 pass) | - | - | 물리 루프 내부 좌표를 `x/z` 의미로 통일하고 snapshot(`x/y`) 매핑 함수(`getBallZ/setBallZ`) 적용 완료 |
| PHY-AXIS-002B | Agent C | done | 2026-02-27 14:34 | `node --experimental-strip-types --test apps/game-server/src/game/snapshot-serializer.test.ts apps/game-server/src/lobby/http.test.ts` 통과 | - | - | snapshot DTO 호환 승격(`z/vz` 추가, `y/vy` 유지) 및 서버 타입/직렬화 반영 완료 |
| PHYS-STICKY-001A | Agent C | done | 2026-02-28 00:26 | `CI=1 pnpm --filter @bhc/web run test -- --run` 통과(1 pass) | - | PHYS-STICKY-001B | web `SimplePhysics` 공-공 접근/이탈 판정 부호 정합 수정 및 분리 보정/반복횟수 튜닝(1.0, 2회) + 회귀 단위테스트 추가 완료 |
| PHYS-STICKY-001B | Agent C | done | 2026-02-28 20:47 | `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts` 통과(29 pass), `node --experimental-strip-types --test packages/physics-core/src/ball-ball-collision.test.ts` 통과(2 pass) | - | - | game-server penetration correction 파라미터를 `physics-core/constants.ts`로 상수화(`PENETRATION_SLOP_M=5e-5`, `POSITION_CORRECTION_SCALE=1.2`)해 튜닝 가능성을 높이고 재충돌 완화값을 런타임에 고정 적용 완료 |

| MOTION-SYNC-001A | Agent C | done | 2026-02-28 20:43 | `pnpm --filter @bhc/game-server test` 통과(placeholder pass) | - | MOTION-SYNC-001B | impactOffset 이중 변환 제거(미터 단위 clamp 직접 적용) 완료 |
| MOTION-SYNC-001B | Agent C | done | 2026-02-28 20:44 | `pnpm --filter @bhc/game-server test` 통과(placeholder pass) | - | MOTION-SYNC-002A | 샷 제출 시 IN_GAME 상태 및 현재 턴 멤버 검증 가드 추가 완료 |
| MOTION-SYNC-002A | Agent C | done | 2026-02-28 20:45 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-002B | SSE 이벤트 수신/파싱 모듈(SseClient) 추가 완료 |
| MOTION-SYNC-002B | Agent C | done | 2026-02-28 20:46 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-003A | 스냅샷 보간 모듈(SnapshotInterpolator) 추가 완료 |
| MOTION-SYNC-003A | Agent C | done | 2026-02-28 20:47 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-003B | BallState 속도 필드 제거 및 GamePhase WAITING/FINISHED 확장 완료 |
| MOTION-SYNC-003B | Agent C | done | 2026-02-28 20:49 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-004A | GameState의 cushion/object hit 필드 및 AngularVelocity 타입 제거 완료 |
| MOTION-SYNC-004A | Agent C | done | 2026-02-28 20:51 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-004B | 스토어에 서버 연결/턴/샷 대기 상태 필드 및 적용 액션 추가 완료 |
| MOTION-SYNC-004B | Agent C | done | 2026-02-28 20:52 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-004C | executeShot 서버 POST 기반 전환 및 shotPending 실패 복구 처리 완료 |
| MOTION-SYNC-004C | Agent C | done | 2026-02-28 20:54 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-005A | 스토어 레거시 필드(players/cushion/object-hit)·액션(addScore/nextPlayer/resetBalls) 제거 완료 |
| MOTION-SYNC-005A | Agent C | done | 2026-02-28 20:55 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-005B | GameScene에서 로컬 물리/규칙 import 및 실행 루프 제거 완료 |
| MOTION-SYNC-005B | Agent C | done | 2026-02-28 20:56 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-006A | GameScene에서 SnapshotInterpolator.sample() 기반 공 위치 갱신 연결 완료 |
| MOTION-SYNC-006A | Agent C | done | 2026-02-28 20:58 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-006B | App 초기화(방 생성/입장/시작) 및 SSE 연결/이벤트 바인딩 완료 |
| MOTION-SYNC-006B | Agent C | done | 2026-02-28 20:59 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-006C | StrictMode 중복 초기화 가드 및 setup 실패 시 disconnected 복구 처리 완료 |
| MOTION-SYNC-006C | Agent C | done | 2026-02-28 21:00 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-007A | SSE 콜백 store stale 참조 제거(useGameStore.getState() 기반) 완료 |
| MOTION-SYNC-007A | Agent C | done | 2026-02-28 21:01 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-007B | InputHandler 입력 게이트를 AIMING+내턴+!shotPending 기준으로 강화 완료 |
| MOTION-SYNC-007B | Agent C | done | 2026-02-28 21:02 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-008A | GameUI에 WAITING/FINISHED 상태 UI 반영 및 로컬 reset 버튼 제거 완료 |
| MOTION-SYNC-008A | Agent C | done | 2026-02-28 21:04 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-008B | web constants에서 클라 물리 계산 상수 제거 및 잔여 참조 정리 완료 |
| MOTION-SYNC-008B | Agent C | done | 2026-02-28 21:05 | `pnpm --filter @bhc/web build` 통과 | - | MOTION-SYNC-009A | 로컬 물리/규칙 레거시 파일 4종 삭제 완료 |
| MOTION-SYNC-009A | Agent C | done | 2026-02-28 21:07 | `AUTH_PORT=9218 LOBBY_PORT=9219 ...` SSE 이벤트 `shot_started -> shot_resolved -> turn_changed` 확인(8s stream) | - | MOTION-SYNC-009B | game-server 실플로우 E2E(방 생성/입장/시작/샷/SSE 체인) 검증 완료 |
| MOTION-SYNC-009B | Agent C | done | 2026-02-28 21:08 | `pnpm --filter @bhc/web build` 통과 | - | - | SnapshotInterpolator 버퍼 딜레이(`VITE_SNAPSHOT_BUFFER_MS`, 50~300ms) 튜닝 가능화 완료 |
