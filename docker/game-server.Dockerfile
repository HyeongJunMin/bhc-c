FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/game-server/package.json apps/game-server/package.json

RUN pnpm install --frozen-lockfile --filter @bhc/game-server...

COPY apps/game-server apps/game-server

WORKDIR /app/apps/game-server

EXPOSE 9900

ENV PORT=9900

CMD ["node", "--experimental-strip-types", "src/main.ts"]
