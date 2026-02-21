# 병렬 실행 진척도 보드

## 사용 규칙
- 상태값은 `todo`, `in_progress`, `done`, `blocked` 중 하나만 사용한다.
- 한 Task ID는 동시에 한 에이전트만 `in_progress`로 잡는다.
- 작업 종료 시 `Validation`과 `Next Task`를 반드시 채운다.
- 업데이트 시간은 `YYYY-MM-DD HH:mm` 형식으로 기록한다.

## 요약
| Metric | Value |
|---|---|
| Total Tasks | 102 |
| Todo | 46 |
| In Progress | 0 |
| Done | 55 |
| Blocked | 1 |
| Last Updated | 2026-02-22 00:49 |

## 에이전트 상태
| Agent | Current Task | Status | Updated At | Note |
|---|---|---|---|---|
| Agent A (web) | - | idle | - | - |
| Agent B (game-server) | - | idle | - | - |
| Agent C (shared/physics/docs) | - | idle | 2026-02-22 00:49 | PHY-001A 완료 |

## 작업 보드
| Task ID | Agent | Status | Updated At | Validation | PR/Commit | Next Task | Note |
|---|---|---|---|---|---|---|---|
| INF-001A | Agent C | done | 2026-02-21 23:17 | `cat package.json` 확인 | - | INF-001B | 루트 package.json 생성 완료 |
| INF-001B | Agent C | done | 2026-02-21 23:18 | `cat pnpm-workspace.yaml` 확인 | - | INF-001C | pnpm workspace 패턴 추가 완료 |
| INF-001C | Agent C | done | 2026-02-21 23:21 | `npx pnpm -v`, `npx pnpm install` 통과 | - | INF-002A | pnpm-lock.yaml 생성 확인 |
| INF-002A | Agent C | done | 2026-02-21 23:22 | `cat turbo.json` 확인 | - | INF-002B | turbo 구성 파일 생성 완료 |
| INF-002B | Agent C | done | 2026-02-21 23:23 | `cat turbo.json` 확인 | - | INF-002C | turbo tasks 정의 완료 |
| INF-002C | Agent C | blocked | 2026-02-21 23:27 | `npx turbo run lint` 대기 상태(출력 없음) | - | INF-003A | turbo 실행 환경 확인 필요 |
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
| PHY-001B | - | todo | - | - | - | - | - |
| PHY-001C | - | todo | - | - | - | - | - |
| PHY-002A | - | todo | - | - | - | - | - |
| PHY-002B | - | todo | - | - | - | - | - |
| PHY-002C | - | todo | - | - | - | - | - |
| CHAT-001A | - | todo | - | - | - | - | - |
| CHAT-001B | - | todo | - | - | - | - | - |
| CHAT-001C | - | todo | - | - | - | - | - |
| CHAT-002A | - | todo | - | - | - | - | - |
| CHAT-002B | - | todo | - | - | - | - | - |
| CHAT-002C | - | todo | - | - | - | - | - |
| QA-001A | - | todo | - | - | - | - | - |
| QA-001B | - | todo | - | - | - | - | - |
| QA-001C | - | todo | - | - | - | - | - |
| QA-002A | - | todo | - | - | - | - | - |
| QA-002B | - | todo | - | - | - | - | - |
| QA-002C | - | todo | - | - | - | - | - |
| RULE-001A | - | todo | - | - | - | - | - |
| RULE-001B | - | todo | - | - | - | - | - |
| RULE-001C | - | todo | - | - | - | - | - |
| RULE-001D | - | todo | - | - | - | - | - |
| RULE-001E | - | todo | - | - | - | - | - |
| RULE-002A | - | todo | - | - | - | - | - |
| RULE-002B | - | todo | - | - | - | - | - |
| RULE-002C | - | todo | - | - | - | - | - |
| RULE-002D | - | todo | - | - | - | - | - |
| RULE-003A | - | todo | - | - | - | - | - |
| RULE-003B | - | todo | - | - | - | - | - |
| RULE-003C | - | todo | - | - | - | - | - |
| RULE-004A | - | todo | - | - | - | - | - |
| RULE-004B | - | todo | - | - | - | - | - |
| RULE-004C | - | todo | - | - | - | - | - |
| RULE-005A | - | todo | - | - | - | - | - |
| RULE-005B | - | todo | - | - | - | - | - |
| RULE-005C | - | todo | - | - | - | - | - |
| RULE-005D | - | todo | - | - | - | - | - |
| RULE-006A | - | todo | - | - | - | - | - |
| RULE-006B | - | todo | - | - | - | - | - |
| RULE-006C | - | todo | - | - | - | - | - |
| RULE-007A | - | todo | - | - | - | - | - |
| RULE-007B | - | todo | - | - | - | - | - |
| RULE-007C | - | todo | - | - | - | - | - |
| RULE-008A | - | todo | - | - | - | - | - |
| RULE-008B | - | todo | - | - | - | - | - |
| RULE-008C | - | todo | - | - | - | - | - |
| RULE-009A | - | todo | - | - | - | - | - |
| RULE-009B | - | todo | - | - | - | - | - |
| RULE-009C | - | todo | - | - | - | - | - |
| RULE-010A | - | todo | - | - | - | - | - |
| RULE-010B | - | todo | - | - | - | - | - |
| RULE-010C | - | todo | - | - | - | - | - |
| RULE-010D | - | todo | - | - | - | - | - |
