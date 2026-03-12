# 배포 가이드

## 1. 개요

game-server가 web 정적 파일을 직접 서빙하는 **단일 컨테이너** 구조.
외부로 노출되는 포트는 **9900** 하나뿐이며, API와 정적 파일 요청을 모두 처리한다.

- 베이스 이미지: `node:22-alpine`
- 멀티아키텍처: `linux/amd64`, `linux/arm64` 모두 지원

---

## 2. 환경변수 레퍼런스

| 변수 | 기본값 | 설명 |
|------|--------|------|
| `PORT` | `9900` | game-server 리스닝 포트 |
| `STATIC_DIR` | (없음) | 설정 시 해당 디렉터리의 정적 파일 서빙 활성화. 미설정 시 정적 파일 요청은 404 |
| `VITE_GAME_SERVER_URL` | (빈 문자열) | 빌드 시 주입되는 API 서버 URL. 비어 있으면 same-origin으로 동작 (프로덕션 기본값) |
| `WEB_PORT` | `9901` | 로컬 개발 시 web dev 서버 포트 (Vite) |

출처: `apps/game-server/src/main.ts`, `apps/web/src/lib/api-client.ts`, `apps/web/vite.config.ts`

---

## 3. 로컬 개발 실행

game-server와 web dev 서버가 **별도 프로세스**로 실행된다.

```bash
# 의존성 설치
pnpm install

# 전체 개발 서버 실행 (터미널 2개 또는 turbo dev)
pnpm dev
```

- web dev 서버: `http://localhost:9901` (기본값, `WEB_PORT`로 변경 가능)
- game-server: `http://localhost:9900`

web에서 game-server API를 호출하려면 빌드 시 환경변수를 설정한다:

```bash
VITE_GAME_SERVER_URL=http://localhost:9900 pnpm --filter @bhc/web run dev
```

> `VITE_GAME_SERVER_URL`을 설정하지 않으면 web은 same-origin으로 API를 요청하므로,
> 로컬 개발 시 반드시 설정해야 한다.

---

## 4. Docker 빌드 & 실행

### 단일 이미지 빌드

```bash
docker build -f docker/Dockerfile -t bhc:latest .
```

### 컨테이너 실행

```bash
docker run -p 9900:9900 bhc:latest
```

### docker compose

```bash
cd docker && docker compose up --build
```

### Dockerfile 멀티스테이지 구조

| 스테이지 | 역할 |
|----------|------|
| `builder` | pnpm으로 전체 의존성 설치 후 `@bhc/web`과 `@bhc/game-server` 빌드 |
| `runtime` | game-server 프로덕션 의존성만 설치, web 빌드 결과물(`/app/static`)을 복사 |

런타임 이미지 시작 시 `STATIC_DIR=/app/static`이 설정되어 있어,
game-server가 `/app/static` 디렉터리를 정적 파일 루트로 사용한다.

---

## 5. 멀티아키 빌드

네이티브 바이너리 의존성이 없으므로 별도 처리 없이 `--platform` 플래그만으로 빌드 가능하다.

```bash
# 멀티아키 이미지 빌드 및 푸시
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/Dockerfile \
  -t your-registry/bhc:latest \
  --push \
  .
```

---

## 6. 라우팅 구조

game-server의 요청 처리 우선순위 (`apps/game-server/src/main.ts`):

| 우선순위 | 경로 패턴 | 처리 |
|----------|-----------|------|
| 1 | `GET /health` | 헬스체크 (`{ ok: true }`) |
| 2 | `/auth/*` | 인증 핸들러 |
| 3 | `/api/lobby/*` | 로비 핸들러 (`/api` prefix 제거 후 전달) |
| 4 | `/v1/systems/five-and-half/*` | FAH 시스템 핸들러 |
| 5 | 그 외 (`STATIC_DIR` 설정 시) | 정적 파일 서빙 + SPA fallback |
| 6 | 그 외 (`STATIC_DIR` 미설정) | 404 |

정적 파일 서빙 로직 (`apps/game-server/src/static-serve.ts`):
- 요청 URL에 해당하는 파일이 존재하면 해당 파일 스트리밍
- 파일이 없으면 `index.html` 반환 (SPA fallback)
- API 경로(`/health`, `/auth/`, `/api/`, `/v1/`)는 정적 파일 서빙에서 제외

---

## 7. 트러블슈팅

### 정적 파일이 404로 응답됨

`STATIC_DIR` 환경변수가 설정되지 않은 경우.
Docker 이미지 외부에서 직접 실행할 때는 명시적으로 설정해야 한다:

```bash
STATIC_DIR=/path/to/web/dist node --experimental-strip-types src/main.ts
```

### SPA 라우팅 경로가 API와 겹침

`/health`, `/auth/`, `/api/`, `/v1/` 로 시작하는 경로는 정적 파일 서빙에서 제외된다.
web 앱의 클라이언트 라우트가 이 prefix와 겹치지 않도록 주의한다.

### 포트 충돌

기본 포트 `9900`이 이미 사용 중인 경우:

```bash
PORT=9910 node --experimental-strip-types src/main.ts
```
