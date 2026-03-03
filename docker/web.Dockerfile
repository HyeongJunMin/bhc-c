FROM node:22-alpine

WORKDIR /app

RUN corepack enable

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --frozen-lockfile --filter @bhc/web...

COPY apps/web apps/web

WORKDIR /app/apps/web

EXPOSE 9900

ENV WEB_PORT=9900
ENV API_SERVER_URL=http://localhost:9900

CMD ["sh", "-lc", "pnpm run dev -- --host 0.0.0.0 --port ${WEB_PORT}"]
