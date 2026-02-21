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
| Todo | 92 |
| In Progress | 0 |
| Done | 9 |
| Blocked | 1 |
| Last Updated | 2026-02-21 23:35 |

## 에이전트 상태
| Agent | Current Task | Status | Updated At | Note |
|---|---|---|---|---|
| Agent A (web) | - | idle | - | - |
| Agent B (game-server) | - | idle | - | - |
| Agent C (shared/physics/docs) | - | idle | 2026-02-21 23:35 | AUTH-001A 완료 |

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
| AUTH-001B | - | todo | - | - | - | - | - |
| AUTH-001C | - | todo | - | - | - | - | - |
| AUTH-002A | - | todo | - | - | - | - | - |
| AUTH-002B | - | todo | - | - | - | - | - |
| AUTH-002C | - | todo | - | - | - | - | - |
| AUTH-003A | - | todo | - | - | - | - | - |
| AUTH-003B | - | todo | - | - | - | - | - |
| AUTH-003C | - | todo | - | - | - | - | - |
| LOB-001A | - | todo | - | - | - | - | - |
| LOB-001B | - | todo | - | - | - | - | - |
| LOB-001C | - | todo | - | - | - | - | - |
| LOB-002A | - | todo | - | - | - | - | - |
| LOB-002B | - | todo | - | - | - | - | - |
| LOB-002C | - | todo | - | - | - | - | - |
| LOB-003A | - | todo | - | - | - | - | - |
| LOB-003B | - | todo | - | - | - | - | - |
| LOB-003C | - | todo | - | - | - | - | - |
| ROOM-001A | - | todo | - | - | - | - | - |
| ROOM-001B | - | todo | - | - | - | - | - |
| ROOM-001C | - | todo | - | - | - | - | - |
| ROOM-002A | - | todo | - | - | - | - | - |
| ROOM-002B | - | todo | - | - | - | - | - |
| ROOM-002C | - | todo | - | - | - | - | - |
| ROOM-003A | - | todo | - | - | - | - | - |
| ROOM-003B | - | todo | - | - | - | - | - |
| ROOM-003C | - | todo | - | - | - | - | - |
| GAME-001A | - | todo | - | - | - | - | - |
| GAME-001B | - | todo | - | - | - | - | - |
| GAME-001C | - | todo | - | - | - | - | - |
| GAME-002A | - | todo | - | - | - | - | - |
| GAME-002B | - | todo | - | - | - | - | - |
| GAME-002C | - | todo | - | - | - | - | - |
| GAME-003A | - | todo | - | - | - | - | - |
| GAME-003B | - | todo | - | - | - | - | - |
| GAME-003C | - | todo | - | - | - | - | - |
| GAME-004A | - | todo | - | - | - | - | - |
| GAME-004B | - | todo | - | - | - | - | - |
| GAME-004C | - | todo | - | - | - | - | - |
| INPUT-001A | - | todo | - | - | - | - | - |
| INPUT-001B | - | todo | - | - | - | - | - |
| INPUT-001C | - | todo | - | - | - | - | - |
| INPUT-002A | - | todo | - | - | - | - | - |
| INPUT-002B | - | todo | - | - | - | - | - |
| INPUT-002C | - | todo | - | - | - | - | - |
| INPUT-002D | - | todo | - | - | - | - | - |
| PHY-001A | - | todo | - | - | - | - | - |
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
