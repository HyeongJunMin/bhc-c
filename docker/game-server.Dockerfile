FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/game-server/package.json apps/game-server/package.json

RUN pnpm install --frozen-lockfile --filter @bhc/game-server...

COPY apps/game-server apps/game-server

WORKDIR /app/apps/game-server

EXPOSE 9211 9212

# game-server opens auth(9211) + lobby(9212) in one process.
ENV PORT=9212

CMD ["node", "--experimental-strip-types", "src/main.ts"]
