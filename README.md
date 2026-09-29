# Hagz

Pitch booking platform: two Expo apps, a Hono API + BullMQ worker, and a thin Next.js site for shared booking links.

## Layout

| Path | What |
|---|---|
| `apps/server` | Hono API (`src/app.ts`) and BullMQ worker (`src/worker.ts`), one codebase, Prisma + Postgres |
| `apps/customer` | Expo app for players |
| `apps/dashboard` | Expo app for pitch owners and staff |
| `apps/web` | Next.js: `/booking/[token]` share pages, `/manage/*` fallback, deep-link verification files |
| `packages/contracts` | Shared types, booking transition table, deep links (`links.ts`), zod schemas |
| `tooling/tsconfig` | Shared TypeScript config |
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
