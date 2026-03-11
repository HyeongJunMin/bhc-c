# Service Ports

## Port Range Policy
- Allowed runtime port range: `1` ~ `65535`
- Out-of-range values cause startup failure.

## Default Allocation
- `@bhc/game-server`: `9900` (`PORT`)
- `@bhc/web`: `9901` (`WEB_PORT`)

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
- `web`: `9901:9901`
