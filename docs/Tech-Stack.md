# 웹 3쿠션 당구 기술 스택 명세 (MVP)

## 1. 문서 정보
- 제목: 웹 3쿠션 당구 기술 스택 명세
- 버전: v1.0
- 작성일: 2026-02-21
- 범위: MVP ~ 초기 운영

## 2. 기술 선택 원칙
- 서버 권한(authoritative) 구조를 기본으로 하여 치트/동기화 불일치를 줄인다.
- 클라이언트/서버/공유 모듈을 TypeScript로 통일해 개발 속도와 유지보수성을 높인다.
- 물리는 "엔진 + 도메인 규칙(3쿠션 전용)" 분리 구조로 구현한다.
- 초기에는 단순 운영(단일 인스턴스)으로 시작하고, 확장 가능한 경로를 확보한다.

## 3. 목표 아키텍처
- `apps/web`: 로그인/로비/게임 UI (Next.js)
- `apps/game-server`: 룸/매치/턴/채팅/동기화 서버 (Colyseus)
- `packages/shared-types`: 이벤트 타입, DTO, 상수
- `packages/physics-core`: 샷 입력 검증, 초기 속도/각속도 계산, 미스큐 판정
- `schemas`: 샷 입력 JSON 스키마
- `docs`: GDD/물리/입력/운영 정책 문서

## 4. 권장 기술 스택
### 4.1 프런트엔드
- 프레임워크: `Next.js` (App Router)
- 언어: `TypeScript`
- 렌더링: `PixiJS` (2D 탑뷰 당구대/공 렌더링)
- 상태 관리: React 기본 상태 + 서버 동기화 상태 분리

선정 이유:
- 로비/인증/방 UI 구성과 SEO/라우팅 생산성이 높다.
- 2D 게임 화면은 Canvas/WebGL 기반 라이브러리(PixiJS)가 성능과 제어 측면에서 유리하다.

### 4.2 실시간 게임 서버
- 프레임워크: `Colyseus`
- 런타임: `Node.js` LTS
- 통신: WebSocket(Colyseus 프로토콜)

선정 이유:
- 룸 기반 상태 모델이 현재 게임 정책(방장, 입장 잠금, 턴제)에 직접 대응된다.
- authoritative state sync 구조를 기본 제공해 실시간 멀티플레이 구현 비용을 낮춘다.

### 4.3 물리/규칙 엔진
- 기본 엔진: `@dimforge/rapier2d-deterministic`
- 커스텀 레이어: `packages/physics-core` (당점, 스핀, 미스큐, 쿠션/마찰 보정)

선정 이유:
- 강체 충돌 계산은 검증된 엔진을 사용한다.
- 3쿠션 고유 규칙은 별도 도메인 레이어로 관리해 튜닝/검증을 독립시킨다.

### 4.4 인증/계정
- 로그인 방식: ID/PW 전용 (SMTP 없음)
- 비밀번호 해시: `Argon2id`
- 세션: `JWT` (Access + Refresh 토큰)

선정 이유:
- 현재 요구사항(이메일 인증 없음)에 맞는 최소/안전 조합이다.

### 4.5 데이터/저장소
- 주 저장소: `PostgreSQL` (계정, 방 메타, 경기 결과)
- 채팅 저장: 메모리 전용 (MVP 요구사항 반영)
- 캐시/분산: 초기 미도입, 수평 확장 시 `Redis` 검토

## 5. 프로젝트 구조/도구
- 모노레포: `pnpm workspace` + `Turborepo`
- 패키지 매니저: `pnpm`
- 린트/포맷: `ESLint` + `Prettier`
- 테스트:
  - 단위: `Vitest`
  - E2E: `Playwright`
- CI: `GitHub Actions`
  - 기존 `spec_guard.py` 포함
  - lint/test/build/spec check 단계 구성

## 6. 네트워크/동기화 정책
- 게임 규칙 판정은 서버 단독 권한으로 처리한다.
- 클라이언트는 입력(조작값)만 송신하고, 판정 결과는 서버 상태를 따른다.
- 동기화 모델:
  - 서버: authoritative state tick
  - 클라이언트: 보간(interpolation) 중심 렌더링

## 7. 운영/배포
- 로컬 개발: `Docker Compose`
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
- Next.js: 15.x 계열
- TypeScript: 5.x
- Colyseus: 최신 안정 버전
- PostgreSQL: 16+

주의:
- 실제 도입 버전은 락파일 기준으로 고정하며, 메이저 업데이트는 호환성 검증 후 반영한다.

## 10. 비범위/추후 검토
- 관전 모드
- 음성 채팅
- 안티치트 고도화(통계 기반 탐지)
- 리플레이 영속 저장
