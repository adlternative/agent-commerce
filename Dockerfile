# syntax=docker/dockerfile:1
# Multi-stage: build frontend + dist-server; runtime ships only dist, dist-server, node_modules, tini.

FROM node:22-bookworm AS build
WORKDIR /app
COPY package.json package-lock.json .npmrc ./
RUN npm ci --no-audit --no-fund
COPY . .
RUN npm run build && npm run build:server \
  && npm prune --omit=dev

FROM node:22-bookworm-slim AS runtime
RUN apt-get update \
  && apt-get install -y --no-install-recommends tini wget ca-certificates \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist-server ./dist-server
COPY --from=build /app/dist ./dist
COPY --from=build /app/docs/openapi.json ./docs/openapi.json

ENV NODE_ENV=production \
    HOST=0.0.0.0 \
    PORT=8787 \
    DATA_DIR=/app/data \
    STATIC_DIR=/app/dist

VOLUME ["/app/data"]
EXPOSE 8787

ENTRYPOINT ["/usr/bin/tini", "--"]
CMD ["node", "dist-server/server/index.js"]
