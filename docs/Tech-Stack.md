# 웹 3쿠션 당구 기술 스택 명세 (MVP)

## 1. 문서 정보
- 제목: 웹 3쿠션 당구 기술 스택 명세
- 버전: v1.2
- 작성일: 2026-02-27
- 범위: MVP ~ 초기 운영

## 2. 기술 선택 원칙
- 서버 권한(authoritative) 구조를 기본으로 하여 치트/동기화 불일치를 줄인다.
- 클라이언트/서버/공유 모듈을 TypeScript로 통일해 개발 속도와 유지보수성을 높인다.
- 물리는 "엔진 + 도메인 규칙(3쿠션 전용)" 분리 구조로 구현한다.
- 초기에는 단순 운영(단일 인스턴스)으로 시작하고, 확장 가능한 경로를 확보한다.
- 스택 기준은 "문서 권장안"이 아니라 "실제 코드 운영안"을 우선한다.

## 3. 현재 기준 아키텍처 (코드 기준)
- `apps/web`: 3D 클라이언트/로비/게임 UI (`Vite + React + Three.js + @react-three/fiber + ammo.js`)
- `apps/game-server`: 인증/로비/룸/턴/채팅/동기화 서버 (`Node.js` 내장 HTTP 서버)
- `packages/shared-types`: 이벤트 타입, DTO, 상수
- `packages/physics-core`: 3쿠션 규칙 판정, 샷 입력/초기속도/미스큐/물리 보정 로직
- `schemas`: 샷 입력 JSON 스키마
- `docs`: GDD/물리/입력/운영 정책 문서

## 4. 기술 스택 (운영 기준)
### 4.1 프런트엔드
- 번들러/개발서버: `Vite`
- UI 프레임워크: `React 18`
- 언어: `TypeScript`
- 렌더링: `Three.js` + `@react-three/fiber` + `@react-three/drei`
- 물리 엔진: `ammo.js` (클라이언트 시뮬레이션/시각화)
- 상태 관리: `zustand` + React 상태

선정 이유:
- 3D 큐/공/테이블 상호작용과 샷 가이드/애니메이션 구현에 직접 대응된다.
- 현재 코드 구조와 의존성(`apps/web/package.json`)이 이미 해당 스택에 최적화되어 있다.

### 4.2 실시간 게임 서버
- 프레임워크: `Node.js` 내장 HTTP 서버 (`node:http`)
- 런타임: `Node.js` LTS
- 통신: REST + SSE(Stream) 하이브리드

선정 이유:
- 현재 룸/턴/채팅/샷 상태머신이 HTTP/SSE 경로로 구현되어 있다.
- 서버 authoritative 흐름(입력 검증, 샷 수명주기, 점수/턴 반영)에 직접 맞는다.

### 4.3 물리/규칙 엔진
- 서버 물리: 경량 커스텀 스텝퍼 (`apps/game-server/src/lobby/http.ts`)
- 규칙/도메인: `packages/physics-core` (3쿠션 판정, 이벤트 어댑터, 샷/스핀/미스큐)
- 클라이언트 물리: `ammo.js` (시각/조작 피드백)

선정 이유:
- 3쿠션 고유 규칙은 physics-core로 분리해 테스트 가능성과 재사용성을 확보한다.
- 서버 authoritative와 클라이언트 시각 물리를 분리해 동기화 정책을 명확히 유지한다.

### 4.4 인증/계정
- 로그인 방식: ID/PW 전용 (SMTP 없음)
- 비밀번호 해시: `Argon2id`
- 세션: `JWT` (Access + Refresh 토큰)

선정 이유:
- 현재 요구사항(이메일 인증 없음)에 맞는 최소/안전 조합이다.

### 4.5 데이터/저장소
- 주 저장소: `PostgreSQL` (계정, 방 메타, 경기 결과)
- 채팅 저장: 메모리 전용 (MVP 요구사항 반영)
- 상태 영속화(옵션): Upstash Redis REST (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`)
- 캐시/분산: 초기 미도입, 수평 확장 시 Redis 기반 세션/매치 공유 검토

## 5. 프로젝트 구조/도구
- 모노레포: `pnpm workspace` + `Turborepo`
- 패키지 매니저: `pnpm`
- 린트/포맷: 패키지별 스크립트 기준(`build/test/lint` 실제 실행 스크립트 적용)
- 테스트:
  - 웹: `Vitest`, `Playwright`
  - 서버/패키지: `node --experimental-strip-types --test` (shared-types build는 `--experimental-transform-types`)
- CI: `GitHub Actions` (`spec-guard`, `runtime-smoke` 워크플로우 운영)

## 6. 네트워크/동기화 정책
- 게임 규칙 판정은 서버 단독 권한으로 처리한다.
- 클라이언트는 입력(조작값)만 송신하고, 판정 결과는 서버 상태를 따른다.
- 동기화 모델:
  - 서버: authoritative state tick + 샷 종료 판정 + 점수/턴 확정
  - 클라이언트: snapshot 보간(interpolation) 중심 렌더링

## 7. 운영/배포
- 로컬 개발: `docker/docker-compose.yml` + 패키지별 개발 서버
- Vercel(web): `@vercel/static-build` 기반 정적 배포(`dist`)
- 초기 운영: 단일 인스턴스 배포
- 확장 단계:
  1. 게임 서버 수평 확장
  2. 세션/매치 공유 계층 도입(필요 시 Redis)
  3. 관측성(로그/메트릭/트레이스) 강화

## 8. 보안/신뢰성 기준
- 비밀번호 평문 저장 금지, Argon2id 필수
- JWT 서명키 분리(환경변수 관리)
- 채팅 rate limit (이미 정의: 3초 1메시지) 서버 강제
- 입력 검증:
  - `schemas/shot-input-v1.json` 기반 유효성 검사
  - 범위 초과값은 명세에 따라 clamp 또는 reject

## 9. 버전 기준 (권장)
- Node.js: LTS (예: 22.x)
- Vite: 5.x
- React: 18.x
- Three.js: 0.160.x
- ammo.js: 0.0.10
- TypeScript: 5.x
- Playwright: 1.58.x
- PostgreSQL: 16+

주의:
- 실제 도입 버전은 락파일 기준으로 고정하며, 메이저 업데이트는 호환성 검증 후 반영한다.

## 10. 비범위/추후 검토
- 관전 모드
- 음성 채팅
- 안티치트 고도화(통계 기반 탐지)
- 리플레이 영속 저장
