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

The staff app reads `EXPO_PUBLIC_API_URL` (the local machine's address in development, so phones on
the same network reach the API) and `EXPO_PUBLIC_GOOGLE_API_KEY`, which is Google Places and
Geocoding for placing a venue on the map. Without the key the map and dropping a pin still work;
searching says it isn't available. The key ships inside the app, so restrict it in Google Cloud to
the apps' bundle ids and to those two APIs. Maps are Google's wherever they can be: Android
has Google Maps in Expo Go already, and iOS builds get it from `GOOGLE_MAPS_IOS_KEY`
(`GOOGLE_MAPS_ANDROID_KEY` for Android builds). Expo Go on iOS can't load Google's SDK, so it falls
back to Apple Maps there.

## Checks

```sh
pnpm lint          # ESLint (type-aware) in every workspace that has a config
pnpm format        # Prettier, writes changes; CI runs pnpm format:check
pnpm typecheck
pnpm test          # Needs Docker: starts throwaway Postgres and Redis containers
```

`apps/server/openapi.json` is the API contract the apps are built against. Browse it at `http://localhost:3000/v1/docs` while `pnpm dev` runs (also on staging, never in production). The contract test fails when the API changes it; after an intended change, regenerate it with `pnpm --filter @hagz/server test -u` and commit it with the change.
