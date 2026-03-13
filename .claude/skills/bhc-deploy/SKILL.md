---
name: bhc-deploy
description: BHC 게임 서버를 멀티아키 Docker 이미지로 빌드하여 Docker Hub에 푸시하고 Lightsail에 배포한다.
user-invocable: true
---

현재 코드베이스를 멀티아키 Docker 이미지로 빌드 → Docker Hub 푸시 → Lightsail 배포까지 자동 수행한다.

## Usage

```
/bhc-deploy [tag]
```

- `tag` 생략 시 `latest` 사용

---

## Instructions

You are executing the **bhc-deploy** skill. 아래 단계를 순서대로 실행한다. **각 단계 실패 시 즉시 중단하고 오류를 보고한다.**

### 설정값

- DOCKER_HUB_REPO: `hjmin0218/bhc` (Docker Hub 저장소)
- TAG: `{{args}}` (없으면 `latest`)
- FULL_IMAGE: `hjmin0218/bhc:{{TAG}}` (빌드/푸시 대상 전체 이미지명)
- LIGHTSAIL: `3.36.90.170`
- DEPLOY_PORT: `9211` (게임 서버 포트)

---

### Step 1: web 빌드

프로젝트 루트에서 실행:

```bash
pnpm --filter @bhc/web build
```

- 성공 시 `apps/web/dist/` 생성 확인
- 실패 시 즉시 중단 및 오류 보고

---

### Step 2: Docker buildx 멀티아키 빌드 & 푸시

`docker buildx`로 `linux/amd64`, `linux/arm64` 멀티아키 이미지를 빌드하고 Docker Hub(`hjmin0218/bhc`)에 푸시한다.

```bash
docker buildx build \
  --platform linux/amd64,linux/arm64 \
  -f docker/Dockerfile \
  -t hjmin0218/bhc:{{TAG}} \
  --push \
  .
```

> `hjmin0218/bhc:{{TAG}}` 는 Docker Hub의 `hjmin0218` 계정 `bhc` 저장소로 푸시된다.

- `--push` 플래그로 빌드와 푸시를 동시에 수행
- buildx builder가 없으면 먼저 생성:
  ```bash
  docker buildx create --use --name multiarch-builder
  ```
- 완료 후 Docker Hub 업로드 확인 메시지 출력

---

### Step 3: Lightsail 배포

Docker Hub 푸시 성공 확인 후 게임 서버 `/deploy` API로 원격 배포:

```bash
curl -s -X POST http://3.36.90.170:9211/deploy \
  -H "Authorization: Bearer ${DEPLOY_SECRET}" \
  -H "Content-Type: application/json" \
  -d '{"tag": "{{TAG}}"}'
```

- `DEPLOY_SECRET` 환경변수가 없으면 즉시 중단 및 오류 보고
- HTTP 200 이외 응답 시 즉시 중단 및 오류 보고
- 응답 JSON 출력

---

### Step 4: 완료 보고

모든 단계 성공 시 아래 형식으로 출력:

```markdown
## 배포 완료

**이미지**: hjmin0218/bhc:{{TAG}}
**플랫폼**: linux/amd64, linux/arm64
**서버**: ec2-user@3.36.90.170
**상태**: 정상 실행 중 (포트 9211)
```

---

## 주의사항

- Step 1(web 빌드) 실패 시 Docker 빌드로 넘어가지 않는다
- Step 2(Docker 푸시) 완료 확인 전 Step 3(배포)를 실행하지 않는다
- 각 단계의 실제 출력을 사용자에게 보여준다
