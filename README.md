# Hagz

Pitch booking platform: two Expo apps, a Hono API + BullMQ worker, and a thin Next.js site.

## Layout

| Path | What |
|---|---|
| `apps/server` | Hono API (`src/app.ts`) and BullMQ worker (`src/worker.ts`), one codebase, Prisma + Postgres |
| `apps/customer` | Expo app for players |
| `apps/dashboard` | Expo app for pitch owners and staff |
| `apps/web` | Next.js: static pages, `/booking/[token]` (public), `/venue/[slug]` (public), `/admin` (admins only) |
| `packages/contracts` | Request and response schemas (plain zod), shared by the API and the apps |
| `tooling/tsconfig` | Shared TypeScript config |
| `tooling/eslint` | Shared ESLint config (type-aware `typescript-eslint`) |
| `infra` | Local Postgres, Redis (queue) and Redis (cache) |

## Branches

`feature/*` → `dev` → `staging` → `main`. Each merge goes through a pull request and CI.

## Getting started

```sh
pnpm install
cp .env.example apps/server/.env
pnpm infra:up
pnpm dev
```

## Checks

```sh
pnpm lint          # ESLint (type-aware) in every workspace that has a config
pnpm format        # Prettier, writes changes; CI runs pnpm format:check
pnpm typecheck
pnpm test          # Needs Docker: starts throwaway Postgres and Redis containers
```

`apps/server/openapi.json` is the API contract the apps are built against. The contract test fails when the API changes it; after an intended change, regenerate it with `pnpm --filter @hagz/server test -u` and commit it with the change.
