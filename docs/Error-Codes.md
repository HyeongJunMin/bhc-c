# Error Codes

## 목적
서버/클라이언트/테스트 전반에서 동일한 에러 코드를 사용하기 위한 기준 문서.

## 코드 목록

### Auth
- `AUTH_INVALID_INPUT`: 필수 입력 누락/형식 오류
- `AUTH_DUPLICATE_USERNAME`: 이미 존재하는 username
- `AUTH_INVALID_CREDENTIALS`: 로그인 자격 증명 실패

### Room
- `ROOM_FULL`: 방 인원 초과(최대 6명)
- `ROOM_IN_GAME`: 게임 진행 중이라 입장 불가
- `ROOM_HOST_ONLY`: 방장 전용 요청을 비방장이 호출
- `ROOM_SPECTATOR_NOT_ALLOWED`: 관전자 입장 정책 위반

### Game/Input/Chat
- `GAME_NOT_ENOUGH_PLAYERS`: 시작 최소 인원(2명) 미충족
- `GAME_ALREADY_STARTED`: 이미 진행 중인 게임 시작 요청
- `SHOT_INPUT_SCHEMA_INVALID`: 샷 입력 스키마 검증 실패
- `CHAT_RATE_LIMITED`: 채팅 전송 간격 제한(3초) 위반

## 사용 원칙
- 가능한 한 HTTP status와 별개로 `errorCode`를 항상 반환한다.
- 신규 에러 추가 시 `packages/shared-types/src/error-codes.ts`와 본 문서를 함께 갱신한다.

## 기존 API 매핑

### Auth API
- `POST /auth/signup`
  - `AUTH_INVALID_INPUT`
  - `AUTH_DUPLICATE_USERNAME`
- `POST /auth/login`
  - `AUTH_INVALID_INPUT`
  - `AUTH_INVALID_CREDENTIALS`
- `POST /auth/guest`
  - `AUTH_INVALID_INPUT`

### Lobby/Room API
- `POST /lobby/rooms`
  - `ROOM_TITLE_REQUIRED`
  - `ROOM_TITLE_TOO_LONG`
- `room join` 정책
  - `ROOM_FULL`
  - `ROOM_IN_GAME`
  - `ROOM_SPECTATOR_NOT_ALLOWED`

### Game/Input/Chat 정책
- `start game` 정책
  - `ROOM_HOST_ONLY`
  - `GAME_NOT_ENOUGH_PLAYERS`
  - `GAME_ALREADY_STARTED`
- `shot input` 진입점
  - `SHOT_INPUT_SCHEMA_INVALID`
- `chat send` 정책
  - `CHAT_RATE_LIMITED`
