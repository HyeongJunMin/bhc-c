# 실행 백로그 마이크로 태스크 (Codex 안정 실행용)

## 1. 사용 규칙
- 이 문서는 `docs/Execution-Backlog.md`의 상위 Task를 30~90분 단위로 분해한 실행 목록이다.
- 네이밍 규칙: `원본ID + A/B/C...` (예: `INF-001A`)
- 한 번에 하나의 마이크로 태스크만 수행한다.
- 각 태스크는 수정 파일 1~3개, 검증 명령 1~2개를 넘기지 않는다.

## 2. 공통 완료 기준
- 변경 파일 수: 최대 3개
- 결정사항: 1개
- 검증 명령: 1~2개
- 결과 보고: 완료/미완료 + 검증 결과 + 다음 태스크 ID

## 3. 마이크로 태스크 목록

### Phase A. 기반 세팅

#### INF-001 워크스페이스 초기화
- `INF-001A`: 루트 `package.json` 생성 (`dev/build/test/lint` 스크립트 빈 골격)
- `INF-001B`: `pnpm-workspace.yaml` 생성 및 workspace 패턴 선언
- `INF-001C`: `pnpm install` 실행 후 lockfile 생성 확인

#### INF-002 Turborepo 파이프라인 연결
- `INF-002A`: 루트에 `turbo.json` 생성
- `INF-002B`: `build/test/lint` 파이프라인 정의
- `INF-002C`: `pnpm turbo run lint` 스모크 실행

#### INF-003 모듈 골격 생성
- `INF-003A`: `apps/web`, `apps/game-server` 디렉토리/기본 `package.json` 추가
- `INF-003B`: `packages/shared-types`, `packages/physics-core` 디렉토리/기본 `package.json` 추가
- `INF-003C`: `pnpm -r list --depth -1`로 워크스페이스 인식 검증

### Phase B. 인증/세션

#### AUTH-001 사용자 스키마 + 마이그레이션
- `AUTH-001A`: 마이그레이션 도구 설정 파일 추가
- `AUTH-001B`: `users` 테이블 생성 migration 작성
- `AUTH-001C`: migration up/down 실행 검증

#### AUTH-002 비밀번호 해시 모듈(Argon2id)
- `AUTH-002A`: `hashPassword` 유틸 구현
- `AUTH-002B`: `verifyPassword` 유틸 구현
- `AUTH-002C`: 단위테스트 3종(정상/불일치/예외) 추가

#### AUTH-003 로그인/가입 API
- `AUTH-003A`: `POST /auth/signup` 구현(중복 ID 검증 포함)
- `AUTH-003B`: `POST /auth/login` 구현(JWT 발급 포함)
- `AUTH-003C`: `POST /auth/guest` 구현 + 최소 통합테스트

### Phase C. 로비/방 생성/정렬

#### LOB-001 방 목록 모델 확정
- `LOB-001A`: `shared-types`에 RoomSummary 타입 정의
- `LOB-001B`: `state` enum(`WAITING/IN_GAME/FINISHED`) 분리 정의
- `LOB-001C`: 서버/클라 타입 import 경로 정리

#### LOB-002 방 생성 API (제목만)
- `LOB-002A`: 제목 유효성 검사(최대 15자) 함수 추가
- `LOB-002B`: 방 생성 엔드포인트 구현(중복 허용)
- `LOB-002C`: 정책 위반/성공 케이스 테스트

#### LOB-003 방 목록 정렬 구현
- `LOB-003A`: 정렬 comparator 구현(대기중 우선)
- `LOB-003B`: 2차/3차 키(인원 적은 순, 최신 생성 순) 반영
- `LOB-003C`: 고정 데이터셋 정렬 단위테스트

### Phase D. 게임방 입장/권한

#### ROOM-001 입장 제한 로직
- `ROOM-001A`: 최대 6인 제한 체크 추가
- `ROOM-001B`: `IN_GAME` 입장 차단 체크 추가
- `ROOM-001C`: 거부 코드 표준화(`ROOM_FULL`, `ROOM_IN_GAME`)

#### ROOM-002 방장 자동 위임
- `ROOM-002A`: host 필드/입장순 자료구조 명시
- `ROOM-002B`: host 이탈 시 다음 순번 위임 로직 구현
- `ROOM-002C`: 위임 이벤트 broadcast 및 테스트

#### ROOM-003 방장 권한(시작/강퇴/재경기)
- `ROOM-003A`: 권한 미들웨어(비방장 차단) 구현
- `ROOM-003B`: 강퇴 명령 구현 및 대상 disconnect 처리
- `ROOM-003C`: 재경기 명령 권한/상태 전이 검증 테스트

### Phase E. 경기 규칙

#### GAME-001 시작 조건
- `GAME-001A`: 시작 요청 핸들러 분리
- `GAME-001B`: 최소 2인 검증 추가
- `GAME-001C`: 조건 미충족 에러 코드 테스트

#### GAME-002 턴/타이머
- `GAME-002A`: 턴 순서 큐(입장 순) 초기화 구현
- `GAME-002B`: 10초 타이머 시작/취소 유틸 구현
- `GAME-002C`: timeout 시 자동 턴 스킵 테스트

#### GAME-003 점수/종료
- `GAME-003A`: 점수 증가 API 또는 내부 함수 구현
- `GAME-003B`: 10점 즉시 종료 분기 구현
- `GAME-003C`: 중도이탈 패배/1인 생존 승리 테스트

#### GAME-004 재경기
- `GAME-004A`: 재경기 시 점수 초기화 구현
- `GAME-004B`: 턴 순서 유지 + 상태 `IN_GAME` 전이 구현
- `GAME-004C`: 재경기 직후 스냅샷 검증 테스트

### Phase F. 입력/물리

#### INPUT-001 샷 입력 검증
- `INPUT-001A`: JSON schema validator 연결
- `INPUT-001B`: 샷 메시지 진입점에 validator 적용
- `INPUT-001C`: invalid payload 에러 코드 테스트

#### INPUT-002 조작 매핑 구현
- `INPUT-002A`: 수평 회전 입력 매핑(360도)
- `INPUT-002B`: 수직 각도 입력 매핑(0~89 clamp)
- `INPUT-002C`: drag px -> m/s 선형 매핑 함수 구현 및 테스트
- `INPUT-002D`: WASD 당점 이동 벡터 처리 구현
- `INPUT-002E`: 스트로크 최대값 400px 스펙/스키마/코드 동기화

#### PHY-001 초기 속도/각속도 계산
- `PHY-001A`: 선속도 수식 함수 구현
- `PHY-001B`: 각속도 수식 함수 구현
- `PHY-001C`: 경계값 테스트(최소/최대 drag, offset)

#### PHY-002 미스큐 처리
- `PHY-002A`: 미스큐 판정 함수 구현
- `PHY-002B`: 임계치 근방 테스트 케이스 작성
- `PHY-002C`: 미스큐 발생 시 게임 이벤트 매핑

### Phase G. 채팅

#### CHAT-001 룸 내부 채팅
- `CHAT-001A`: 룸 범위 broadcast 구현
- `CHAT-001B`: 룸별 메모리 버퍼 추가
- `CHAT-001C`: 룸 종료 시 버퍼 해제 처리

#### CHAT-002 레이트 리밋
- `CHAT-002A`: 사용자별 마지막 전송 시각 저장
- `CHAT-002B`: 3초 이내 요청 거부 로직 구현
- `CHAT-002C`: 위반 메시지 UI 처리 + 테스트

### Phase H. 검증/릴리스 준비

#### QA-001 핵심 시나리오 E2E
- `QA-001A`: 로그인->로비->방입장 시나리오 작성
- `QA-001B`: 시작->플레이->10점 종료 시나리오 작성
- `QA-001C`: 타임아웃/중도이탈/강퇴 시나리오 작성

#### QA-002 운영 스모크
- `QA-002A`: 6인 동시 접속 테스트 스크립트 준비
- `QA-002B`: 10분 플레이 중 에러 로그 수집
- `QA-002C`: 메모리 사용량 관찰 기준/결과 기록

### Phase I. GDD 완전 커버 보강 TODO

#### RULE-001 3쿠션 득점 판정기 구현
- `RULE-001A`: 턴 득점 판정 입력 모델 정의(충돌 이벤트 리스트)
- `RULE-001B`: 두 목적구 접촉 판정 구현
- `RULE-001C`: 최소 3쿠션 판정 구현
- `RULE-001D`: 종합 판정 함수(`isValidThreeCushionScore`) 구현
- `RULE-001E`: 참/거짓/경계 테스트 세트 작성

#### RULE-002 턴 단위 이벤트 상태 추적기
- `RULE-002A`: 턴 시작 초기화 함수 구현
- `RULE-002B`: 공-공/공-쿠션 이벤트 append 로직 구현
- `RULE-002C`: 턴 종료 시 추적 상태 스냅샷 반환
- `RULE-002D`: 턴 경계 상태 누수 테스트

#### RULE-003 샷 종료(공 정지) 판정
- `RULE-003A`: 속도/각속도 임계값 상수 정의
- `RULE-003B`: N프레임 연속 정지 판정 로직 구현
- `RULE-003C`: 조기 종료/무한 턴 방지 테스트

#### RULE-004 경기 시작/재경기 공 배치 규칙
- `RULE-004A`: 시작 배치 좌표 상수 정의
- `RULE-004B`: 시작 시 배치 적용 함수 구현
- `RULE-004C`: 재경기 시 재배치 + 초기상태 검증 테스트

#### RULE-005 물리 이벤트 -> 점수 반영 어댑터
- `RULE-005A`: 물리 이벤트 도메인 타입 정의
- `RULE-005B`: 이벤트 -> 득점 판정 어댑터 구현
- `RULE-005C`: 득점/실패별 턴 전환 연계 구현
- `RULE-005D`: 통합 테스트(물리 이벤트 mock) 작성

#### RULE-006 관전 불가 정책 UX/서버 일치화
- `RULE-006A`: 서버 측 관전자 join 경로 차단
- `RULE-006B`: 클라 입장 실패 에러 매핑 문구 정리
- `RULE-006C`: 관전 시도 E2E 실패 케이스 작성

#### RULE-007 로비 무한스크롤 데이터 경계 정책
- `RULE-007A`: 조회 API에 `hasMore` 계약 추가
- `RULE-007B`: 클라 infinite scroll stop 조건 적용
- `RULE-007C`: 마지막 페이지/중복요청 테스트

#### RULE-008 에러 코드 표준 사전 문서화
- `RULE-008A`: 공통 에러 코드 enum 정의
- `RULE-008B`: 문서 `docs/Error-Codes.md` 작성
- `RULE-008C`: 기존 API 응답 코드 매핑 정리

#### RULE-009 재경기 초기화 E2E 강화
- `RULE-009A`: 재경기 직후 점수/턴 검증 케이스 추가
- `RULE-009B`: 공 위치/속도/스핀 초기화 검증 케이스 추가
- `RULE-009C`: 이전 턴 이벤트 이력 초기화 검증 케이스 추가

#### RULE-010 동시성 경합 방지 테스트
- `RULE-010A`: 시작 버튼 연타 멱등성 테스트 작성
- `RULE-010B`: 강퇴/자진퇴장 동시 이벤트 순서 테스트
- `RULE-010C`: 턴 만료 직전 샷 입력 경합 테스트
- `RULE-010D`: 상태 전이 원자성 검증(assert) 추가

### Phase J. Web 인증 UI

#### WEB-AUTH-001 로그인/회원가입/게스트 진입 UI
- `WEB-AUTH-001A`: `/login` 라우트와 인증 페이지 기본 골격 추가
- `WEB-AUTH-001B`: 로그인/회원가입/게스트 폼 UI 구성
- `WEB-AUTH-001C`: `http://localhost:9211/auth/*` API 연동
- `WEB-AUTH-001D`: 인증 성공 시 토큰 저장 + `/lobby` 이동
- `WEB-AUTH-001E`: 에러코드 매핑 메시지 및 스모크 테스트

### Phase K. Web 로비 UI

#### WEB-LOBBY-001 로비 방 목록/생성 UI
- `WEB-LOBBY-001`: `/lobby`에서 방 목록 조회/방 생성이 동작하도록 로비 API 연동

#### WEB-ROOM-001 로비 방 입장 연결
- `WEB-ROOM-001`: `/lobby`에서 방 입장 버튼으로 `/room/:id` 진입이 동작하도록 join API 연동

### Phase L. Room 상세 API/UI

#### ROOM-API-001 방 상세 조회/멤버 데이터
- `ROOM-API-001`: `GET /lobby/rooms/:roomId`와 host/members 정보를 제공하도록 로비 API 확장

#### ROOM-UI-001 방 상세 화면 렌더링
- `ROOM-UI-001`: `/room/:roomId`에서 방 정보/참가자/권한 기반 액션 패널을 데이터 기반으로 렌더링

#### ROOM-RT-001 룸/로비 상태 자동 동기화
- `ROOM-RT-001`: 새로고침 없이 방 목록/방 상세 상태가 갱신되도록 주기적 폴링 동기화 추가

#### ROOM-ACTION-001 방 액션 API/UI 연결
- `ROOM-ACTION-001`: `/room/:id`에서 시작/강퇴/재경기 버튼을 로비 서버 액션 API와 연동

#### ROOM-ACTION-002 액션 에러/활성조건 정교화
- `ROOM-ACTION-002`: 룸 액션 에러코드 사용자 메시지 매핑 및 상태/인원 기반 버튼 활성조건 정교화

#### ROOM-CHAT-001 룸 채팅 UI/API 연결
- `ROOM-CHAT-001`: `/room/:id` 채팅 목록/전송 UI와 룸 채팅 API를 연동

#### GAME-UI-001 인게임 HUD 기본 표시
- `GAME-UI-001`: `/room/:id`에 턴/타이머/점수판 HUD 패널 기본 표시를 추가

#### PLAY-INPUT-001 샷 입력 UI/검증 연결
- `PLAY-INPUT-001`: `/room/:id` 샷 입력 폼과 서버 샷 스키마 검증 API를 연동

#### PLAY-INPUT-002 샷 검증 실패 피드백 고도화
- `PLAY-INPUT-002`: 샷 제출 실패 시 errorCode와 validation errors[]를 상세 표시

#### PLAY-FLOW-001 경기 상태 전환 UX
- `PLAY-FLOW-001`: 룸 상태(IN_GAME/FINISHED/대기) 배너와 강퇴/퇴장 시 자동 로비 복귀 흐름 추가

#### LOBBY-SYNC-001 로비 상태 연동 강화
- `LOBBY-SYNC-001`: 로비 카드에서 IN_GAME 방 입장 버튼 잠금 및 상태 문구 반영

### Phase M. QA E2E

#### QA-E2E-001 통합 흐름 스모크
- `QA-E2E-001`: 로그인(게스트)→로비→방생성→입장→시작→채팅→샷→강퇴까지 API/화면 흐름 스모크 자동화

### Phase N. Room 실시간 플레이(Canvas 2D + 20Hz)

#### ROOM-ARCH-001 구현 계획 문서화
- `ROOM-ARCH-001`: `docs/Room-Play-Plan.md`에 A안(20Hz) 기준 상세 설계/구현순서/DoD/B안 TODO를 문서화

#### ROOM-UI-002 캔버스 테이블 렌더
- `ROOM-UI-002A`: `/room/:id`에 Canvas 2D 스테이지와 테이블 이미지(`/assets/table/table-top.png`) 렌더 골격 추가
  - 입력: `apps/web/src/main.ts`, `apps/web/public/assets/table/table-top.png`
  - 출력: room 템플릿에 `<canvas id="room-stage">` 추가, 이미지 preload 코드
  - 작업: 캔버스 mount -> 2D context 획득 -> 이미지 로드 성공/실패 분기
  - DoD: room 진입 시 빈 화면이 아닌 테이블 이미지가 1프레임 이상 렌더됨
  - 검증: `WEB_PORT=9213 pnpm --filter @bhc/web run dev`, `curl -sS http://localhost:9213/room/room-1 | rg "room-stage|table-top.png"`
- `ROOM-UI-002B`: 월드좌표<->캔버스 좌표 변환/반응형 스케일 규칙 적용
  - 입력: `packages/physics-core` 좌표계(미터), canvas 실제 픽셀 크기
  - 출력: `worldToCanvas`, `canvasToWorld`, resize recalculation 유틸
  - 작업: 기준 테이블 월드폭/높이 상수 고정 -> 레터박스 스케일 계산 -> DPR 반영
  - DoD: 리사이즈 후에도 공/테이블 비율이 유지되고 클릭 역변환 오차가 허용범위 내
  - 검증: `node --experimental-strip-types --test apps/web/src/room-coordinate.test.ts` (신규)
- `ROOM-UI-002C`: 공 렌더(원/스프라이트) + snapshot 보간 루프 추가
  - 입력: `room_snapshot.balls[]`, `seq`, `serverTimeMs`
  - 출력: 60fps 렌더 루프에서 보간된 공 위치 렌더
  - 작업: 최신 snapshot 2개 버퍼링 -> `alpha` 계산 -> 각 공 위치/속도 시각화
  - DoD: 20Hz 수신 환경에서 공 이동이 프레임 점프 없이 연속적으로 보임
  - 검증: `curl -sS http://localhost:9213/room/room-1 | rg "requestAnimationFrame|interpol"`

#### ROOM-NET-001 룸 실시간 스냅샷 전송
- `ROOM-NET-001A`: game-server 룸 snapshot 스트림 엔드포인트 추가
  - 입력: 기존 `apps/game-server/src/lobby/http.ts` 라우팅 체계
  - 출력: 룸 단위 스트림 연결 엔드포인트(`/room-stream/:roomId` 또는 동등 경로)
  - 작업: 연결/해제 훅, room membership 검사, 인증 실패 코드 정의
  - DoD: 비멤버는 구독 실패(403), 멤버는 연결 성공
  - 검증: `node --experimental-strip-types --test apps/game-server/src/lobby/http.test.ts`
- `ROOM-NET-001B`: 20Hz broadcaster와 `seq` 기반 full snapshot 전송 구현
  - 입력: 룸 상태 + 물리 tick 결과
  - 출력: `room_snapshot` 메시지(`seq`, `serverTimeMs`, `balls[]`)
  - 작업: 50ms broadcast scheduler -> `seq` 단조 증가 -> 역행 `seq` 방지
  - DoD: 수신 로그 기준 20Hz(±10%) 및 `seq` strictly increasing
  - 검증: `node --experimental-strip-types scripts/qa/room-stream-rate-check.ts` (신규)
- `ROOM-NET-001C`: web 서버 프록시/연결 경로(`/api/room-stream/*`) 연동
  - 입력: web server 라우팅(`apps/web/src/main.ts`)
  - 출력: 브라우저에서 사용할 단일 same-origin 스트림 경로
  - 작업: 업그레이드/스트림 프록시 + roomId 전달 + 에러 응답 전달
  - DoD: 브라우저 콘솔에서 CORS/upgrade 오류 없이 스트림 연결
  - 검증: `curl -i http://localhost:9213/api/room-stream/room-1`

#### ROOM-SIM-001 샷 라이프사이클 동기화
- `ROOM-SIM-001A`: shot 상태머신(`idle/running/resolved`) 구현
  - 입력: 샷 제출 이벤트, 타이머, 물리 정지 판정
  - 출력: 상태 전이표 + guard(`running` 중 중복샷 거부)
  - 작업: `idle->running->resolved->idle` 전이 및 invalid transition 차단
  - DoD: 상태 전이 테스트에서 경합 입력이 규칙대로 차단
  - 검증: `node --experimental-strip-types --test apps/game-server/src/game/shot-state-machine.test.ts` (신규)
- `ROOM-SIM-001B`: 물리 tick 결과 -> snapshot 직렬화 파이프라인 구현
  - 입력: physics world frame(볼 위치/속도/스핀)
  - 출력: 네트워크 DTO(`balls[]`, pocket/active metadata)
  - 작업: 모델 변환기 구현, NaN/Infinity 방어, 수치 반올림 정책 고정
  - DoD: 직렬화 결과가 JSON-safe이며 필드 누락이 없음
  - 검증: `node --experimental-strip-types --test apps/game-server/src/game/snapshot-serializer.test.ts` (신규)
- `ROOM-SIM-001C`: shot 종료/턴전환/득점 이벤트 브로드캐스트 연계
  - 입력: `shot_resolved` 내부 판정, 점수/턴 정책 결과
  - 출력: `shot_resolved`, `turn_changed`, `game_finished` 메시지 체인
  - 작업: 이벤트 발행 순서 고정(shot_resolved -> turn_changed)
  - DoD: 동일 샷에서 이벤트 중복 발행 0건
  - 검증: `node --experimental-strip-types --test apps/game-server/src/game/shot-lifecycle-broadcast.test.ts` (신규)

#### ROOM-INPUT-003 룸 캔버스 입력
- `ROOM-INPUT-003A`: 조준/드래그 기반 샷 입력 UI 구성
  - 입력: pointer 이벤트, `canvasToWorld` 변환, 현재 턴 정보
  - 출력: `shot_submit` payload 생성(방향/dragPx/impactOffset)
  - 작업: pointerdown/move/up 기반 드래그 거리 계산, 10~400 클램프
  - DoD: 드래그 동작 1회로 서버 제출 1회만 발생
  - 검증: `curl -sS http://localhost:9213/room/room-1 | rg "pointerdown|dragPx|shot_submit"`
- `ROOM-INPUT-003B`: 샷 진행 중 중복 입력 잠금 및 사용자 피드백 추가
  - 입력: shot state(`running`), 서버 ack/reject 응답
  - 출력: 버튼/입력 잠금, 상태 문구(예: "샷 진행 중")
  - 작업: submit in-flight 플래그 + timeout 복구 + 재입력 가능 시점 해제
  - DoD: 빠른 연타 시 중복 POST/메시지 전송이 발생하지 않음
  - 검증: `node --experimental-strip-types scripts/qa/shot-double-submit-check.ts` (신규)
- `ROOM-INPUT-003C`: 샷 검증 실패(errorCode/errors[]) 룸 UI 통합 표시
  - 입력: `SHOT_INPUT_SCHEMA_INVALID`, `errors[]`
  - 출력: 사용자 메시지 + 상세 validation 리스트 영역
  - 작업: 에러코드 매핑 재사용, 다중 에러 줄바꿈 렌더, success 시 초기화
  - DoD: 실패 원인을 사용자가 즉시 식별 가능(코드+필드 단위)
  - 검증: `curl -sS http://localhost:9213/room/room-1 | rg "shot-errors|SHOT_INPUT_SCHEMA_INVALID"`

#### ROOM-QA-002 실시간 룸 QA
- `ROOM-QA-002A`: 1클라 샷->정지->턴전환 스모크 자동화
  - 입력: 게스트 로그인/방생성/입장/시작/샷 실행 자동 스크립트
  - 출력: shot lifecycle 성공 여부 리포트
  - 작업: `shot_started -> room_snapshot -> shot_resolved -> turn_changed` 순서 assert
  - DoD: 10회 반복 실행 기준 flaky 0건
  - 검증: `node --experimental-strip-types scripts/qa/room-single-client-shot.ts` (신규)
- `ROOM-QA-002B`: 2클라 동시 시청 시 snapshot drift/역행(`seq`) 검증
  - 입력: 두 클라이언트의 동일 `seq` 프레임 좌표 샘플
  - 출력: drift 통계(max/avg), 역행 seq 카운트
  - 작업: 클라A/B 수신 로그 수집, `seq` 역행 탐지, 위치 오차 계산
  - DoD: 역행 `seq` 0건, drift max 허용치 이내(초기값: 공 반지름 1.0배)
  - 검증: `node --experimental-strip-types scripts/qa/room-two-client-drift.ts` (신규)
- `ROOM-QA-002C`: 스트림 끊김 시 fallback/polling 복구 검증
  - 입력: 의도적 스트림 단절 이벤트
  - 출력: fallback 활성화 로그, 재연결 성공 로그, 복구 시간
  - 작업: 스트림 끊김 감지 -> polling 전환 -> 재연결 성공 시 스트림 복귀
  - DoD: 단절 후 3초 내 UI 갱신 재개, 하드 에러/멈춤 0건
  - 검증: `node --experimental-strip-types scripts/qa/room-stream-recovery.ts` (신규)

## 4. 추천 착수 순서 (마이크로)
1. `INF-001A` -> `INF-001C`
2. `INF-002A` -> `INF-002C`
3. `INF-003A` -> `INF-003C`
4. `AUTH-001A` -> `AUTH-003C`
5. `LOB-001A` -> `ROOM-003C`
6. `GAME-001A` -> `GAME-004C`
7. `INPUT-001A` -> `PHY-002C`
8. `CHAT-001A` -> `CHAT-002C`
9. `QA-001A` -> `QA-002C`
10. `RULE-001A` -> `RULE-010D`
11. `WEB-AUTH-001A` -> `WEB-AUTH-001E`
12. `WEB-LOBBY-001`
13. `WEB-ROOM-001`
14. `ROOM-API-001`
15. `ROOM-UI-001`
16. `ROOM-RT-001`
17. `ROOM-ACTION-001`
18. `ROOM-ACTION-002`
19. `ROOM-CHAT-001`
20. `GAME-UI-001`
21. `PLAY-INPUT-001`
22. `PLAY-INPUT-002`
23. `PLAY-FLOW-001`
24. `LOBBY-SYNC-001`
25. `QA-E2E-001`
26. `ROOM-ARCH-001`
27. `ROOM-UI-002A` -> `ROOM-UI-002C`
28. `ROOM-NET-001A` -> `ROOM-NET-001C`
29. `ROOM-SIM-001A` -> `ROOM-SIM-001C`
30. `ROOM-INPUT-003A` -> `ROOM-INPUT-003C`
31. `ROOM-QA-002A` -> `ROOM-QA-002C`

### Phase O. GDD 갭 보완 (2026-02-23)

#### LOBBY-PAGE-001 로비 9개 단위 + 무한스크롤
- `LOBBY-PAGE-001A`: `/api/lobby/rooms` 기본 조회를 `limit=9`로 고정
- `LOBBY-PAGE-001B`: `offset/hasMore/isLoading` 클라이언트 상태머신 추가
- `LOBBY-PAGE-001C`: IntersectionObserver 기반 다음 페이지 자동 로드
- `LOBBY-PAGE-001D`: 중복요청/끝페이지 경계 테스트 추가

#### HUD-REAL-001 HUD 실데이터 연동
- `HUD-REAL-001A`: room detail/stream payload에 `scoreBoard/currentTurn/turnDeadlineMs` 필드 추가
- `HUD-REAL-001B`: 서버 턴/점수 상태를 shot lifecycle에 연결
- `HUD-REAL-001C`: 웹 HUD를 서버 authoritative 값으로 렌더 전환
- `HUD-REAL-001D`: 재접속/백그라운드 복귀 시 HUD 동기화 테스트

#### GAME-END-001 10점 즉시 종료 런타임 연결
- `GAME-END-001A`: `shot_resolved` 시점에 score-policy 적용 경로 연결
- `GAME-END-001B`: 10점 달성 즉시 `IN_GAME -> FINISHED` 전이
- `GAME-END-001C`: winner/loser 상태를 이벤트/API 응답에 포함
- `GAME-END-001D`: FINISHED 상태 입력 잠금/재경기 조건 회귀 테스트

#### LEAVE-001 이탈/연결해제 패배 처리
- `LEAVE-001A`: `POST /lobby/rooms/:roomId/leave` API 추가
- `LEAVE-001B`: disconnect 감지 시 10초 유예 타이머(`pending_disconnect`) 시작
- `LEAVE-001C`: 10초 내 미복귀 시 LOSE 확정 + 멤버 제거
- `LEAVE-001D`: 유예중 복귀 시 패배 취소/세션 복원 테스트

#### HOST-DELEGATE-001 방장 위임 경로 일원화
- `HOST-DELEGATE-001A`: kick/leave/disconnect 공통 멤버제거 유즈케이스화
- `HOST-DELEGATE-001B`: host 이탈 시 입장순 다음 플레이어 자동 위임
- `HOST-DELEGATE-001C`: 위임 이벤트 수신 시 웹 권한 UI 즉시 갱신

#### CHAT-RL-001 채팅 레이트리밋 실연동
- `CHAT-RL-001A`: game-server room chat API에 3초 레이트리밋 모듈 연결
- `CHAT-RL-001B`: rate limit 위반 시 `CHAT_RATE_LIMITED` + `retryAfterMs` 응답 계약 고정
- `CHAT-RL-001C`: room UI에 잔여 대기시간 메시지 반영
- `CHAT-RL-001D`: 더블클릭/동시요청 회귀 테스트 추가

#### INPUT-FULL-001 조작 스펙 완성
- `INPUT-FULL-001A`: WASD 당점 이동 입력(`[-0.9R,+0.9R]` clamp) 구현
- `INPUT-FULL-001B`: 마우스 상하 기반 고각 제어 UX 추가
- `INPUT-FULL-001C`: 당점/고각 오버레이 시각화
- `INPUT-FULL-001D`: payload(`impactOffsetX/Y`, `cueElevationDeg`) 검증 테스트 보강

#### PHYS-RUNTIME-001 물리 월드 런타임 연동 (20Hz)
- `PHYS-RUNTIME-001A`: room별 physics world 생성/초기 배치
- `PHYS-RUNTIME-001B`: shot 입력 -> 초기 속도/회전 변환 -> world apply
- `PHYS-RUNTIME-001C`: 20Hz tick -> snapshot serialize -> SSE broadcast
- `PHYS-RUNTIME-001D`: 정지 판정 -> 점수/턴 전환/종료 이벤트 연계
- `PHYS-RUNTIME-001E`: drift/역행/NaN 방어 soak 테스트
