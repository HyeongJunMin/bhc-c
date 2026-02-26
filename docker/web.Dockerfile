FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile --filter @bhc/web...

COPY apps/web apps/web

WORKDIR /app/apps/web

EXPOSE 9213

ENV WEB_PORT=9213
ENV AUTH_SERVER_URL=http://localhost:9211
ENV LOBBY_SERVER_URL=http://localhost:9212

CMD ["node", "--experimental-strip-types", "src/main.ts"]
