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
