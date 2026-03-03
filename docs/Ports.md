# Service Ports

## Port Range Policy
- Allowed runtime port range: `1` ~ `65535`
- Out-of-range values cause startup failure.

## Default Allocation
- `@bhc/game-server`: `9900` (`PORT`)
- `@bhc/web`: `9900` (`WEB_PORT`)

주의:
- 로컬 호스트에서 game-server와 web을 동시에 실행하면 포트 충돌이 발생할 수 있다.
- 이 경우 `WEB_PORT` 또는 `PORT` 중 하나를 변경해서 실행한다.

## Run Commands
- game server:
  - `pnpm --filter @bhc/game-server run dev`
- web:
  - `pnpm --filter @bhc/web run dev`

## Override Examples
- `PORT=9990 pnpm --filter @bhc/game-server run dev`
- `WEB_PORT=9991 API_SERVER_URL=http://localhost:9990 pnpm --filter @bhc/web run dev`

## Docker Compose Mapping
- `game-server`: `9900:9900`
- `web`: `9901:9900` (컨테이너 내부 9900을 호스트 9901로 노출)
