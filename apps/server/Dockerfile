# One image for both the API and the worker; the start command picks which runs.
# Build from the repo root: docker build -f apps/server/Dockerfile .

FROM node:24-slim AS base
ENV PNPM_HOME=/pnpm \
    PATH=/pnpm:$PATH \
    TURBO_TELEMETRY_DISABLED=1
# openssl is needed by Prisma's migration engine (prisma migrate deploy).
RUN apt-get update && apt-get install -y --no-install-recommends openssl && rm -rf /var/lib/apt/lists/* \
    && corepack enable
WORKDIR /app

# Reduce the monorepo to the server and the workspace packages it depends on.
FROM base AS pruner
COPY . .
RUN pnpm dlx turbo@2.11.5 prune @hagz/server --docker

FROM base AS builder
COPY .npmrc ./
COPY --from=pruner /app/out/json/ .
RUN pnpm install --frozen-lockfile
COPY --from=pruner /app/out/full/ .
RUN pnpm turbo run build --filter=@hagz/server

FROM base AS runner
ENV NODE_ENV=production
COPY --from=builder --chown=node:node /app /app
WORKDIR /app/apps/server
USER node
CMD ["node", "dist/app.js"]
