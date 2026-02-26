# Service Ports

## Port Range Policy
- Allowed runtime port range: `9211` ~ `9220`
- Out-of-range values cause startup failure.

## Default Allocation
- `@bhc/game-server` auth API: `9211` (`AUTH_PORT`)
- `@bhc/game-server` lobby API: `9212` (`LOBBY_PORT`)
- `@bhc/web`: `9213` (`WEB_PORT`)

## Run Commands
- game server:
  - `pnpm --filter @bhc/game-server run dev`
- web:
  - `pnpm --filter @bhc/web run dev`

## Override Examples
- `AUTH_PORT=9215 LOBBY_PORT=9216 pnpm --filter @bhc/game-server run dev`
- `WEB_PORT=9217 pnpm --filter @bhc/web run dev`
