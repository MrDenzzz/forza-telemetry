# syntax=docker/dockerfile:1

# One build of the workspace; each image keeps only what it runs.
#   api      the API, with production dependencies only
#   migrate  the API image plus the Prisma CLI: applies migrations, imports the demo drive
#   web      the Next.js server, from its standalone output

ARG NODE_VERSION=24
ARG PRISMA_VERSION=7.10.0

FROM node:${NODE_VERSION}-slim AS build
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    CI=true \
    NEXT_TELEMETRY_DISABLED=1
RUN npm install --global pnpm@12.8.1
WORKDIR /repo
COPY . .
# Only the API, the web app and what they depend on; the mobile app is not built here. Install
# scripts are skipped: building needs none of them, and the root one installs git hooks.
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm install --frozen-lockfile --ignore-scripts --filter "@ft/api..." --filter "@ft/web..."
RUN pnpm --filter @ft/api generate \
    && pnpm --filter "@ft/api..." --filter "@ft/web..." run build
RUN --mount=type=cache,id=pnpm-store,target=/pnpm/store \
    pnpm --filter @ft/api deploy --prod --ignore-scripts /deploy/api
# The drive the hosted demo replays live and offers in the history.
ARG DEMO_RECORDING=apps/api/test/fixtures/circuit-race.ftr.gz
RUN mkdir /demo && cp "$DEMO_RECORDING" /demo/drive.ftr.gz

FROM node:${NODE_VERSION}-slim AS api
ENV NODE_ENV=production
WORKDIR /app
COPY --from=build --chown=node:node /deploy/api/package.json ./
COPY --from=build --chown=node:node /deploy/api/node_modules ./node_modules
COPY --from=build --chown=node:node /deploy/api/dist ./dist
COPY --from=build --chown=node:node /demo /demo
USER node
EXPOSE 4000
HEALTHCHECK --interval=10s --timeout=3s --start-period=10s \
    CMD ["node", "-e", "fetch('http://127.0.0.1:4000/health').then((r) => process.exit(r.ok ? 0 : 1), () => process.exit(1))"]
CMD ["node", "dist/main.js"]

# The Prisma CLI weighs over 200 MB and only migrations need it, so it stays out of the API image.
FROM api AS migrate
ARG PRISMA_VERSION
USER root
# Prisma's schema engine, which applies migrations, needs OpenSSL.
RUN apt-get update \
    && apt-get install --yes --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /migrate
ENV NPM_CONFIG_UPDATE_NOTIFIER=false
# npm's download cache would add another 300 MB to the layer.
RUN npm init --yes > /dev/null \
    && npm install --no-fund --no-audit "prisma@${PRISMA_VERSION}" \
    && npm cache clean --force
COPY --from=build --chown=node:node /deploy/api/prisma ./prisma
COPY --from=build --chown=node:node /deploy/api/prisma.config.ts ./
USER node
CMD ["sh", "-c", "npx prisma migrate deploy && if [ -n \"$IMPORT_FILE\" ]; then node /app/dist/import.js \"$IMPORT_FILE\"; fi"]

FROM node:${NODE_VERSION}-slim AS web
ENV NODE_ENV=production \
    HOSTNAME=0.0.0.0 \
    PORT=3000 \
    NEXT_TELEMETRY_DISABLED=1
WORKDIR /app
COPY --from=build --chown=node:node /repo/apps/web/.next/standalone ./
COPY --from=build --chown=node:node /repo/apps/web/.next/static ./apps/web/.next/static
USER node
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
