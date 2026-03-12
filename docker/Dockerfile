# web은 호스트에서 미리 빌드 (apps/web/dist) → 멀티아키 에뮬레이션 esbuild 크래시 방지
# 런타임: game-server + web static
FROM node:24-alpine
WORKDIR /app
RUN corepack enable
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/game-server/package.json apps/game-server/
COPY packages/physics-core/package.json packages/physics-core/
COPY packages/shared-types/package.json packages/shared-types/
RUN pnpm install --frozen-lockfile --filter @bhc/game-server... --prod
COPY apps/game-server/src apps/game-server/src
COPY packages/ packages/
COPY apps/web/dist /app/static
WORKDIR /app/apps/game-server
ENV PORT=9900
ENV STATIC_DIR=/app/static
EXPOSE 9900
CMD ["node", "--experimental-strip-types", "src/main.ts"]
