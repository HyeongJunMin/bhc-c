FROM node:22

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/game-server/package.json apps/game-server/package.json
COPY packages/physics-core/package.json packages/physics-core/package.json
COPY packages/shared-types/package.json packages/shared-types/package.json

RUN pnpm install --frozen-lockfile

COPY apps/game-server apps/game-server
COPY packages/physics-core packages/physics-core
COPY packages/shared-types packages/shared-types

WORKDIR /app/apps/game-server

EXPOSE 9211 9212

ENV PORT=9212

CMD ["node", "--experimental-strip-types", "src/main.ts"]
