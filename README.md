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
the apps' bundle ids and to those two APIs.

### The Expo apps

Both apps run as development builds (`expo-dev-client`), not in Expo Go. Install a build once per
phone, then work as usual: `pnpm dev` starts Metro and the build loads the JavaScript from it.

```sh
npm install -g eas-cli && eas login
cd apps/dashboard                      # or apps/customer
eas build --profile development --platform android   # or ios; register iPhones first: eas device:create
```

Make a new development build only when native code changes: a new native package, a config plugin
or anything in `app.config.ts`. After changing brand CSS, restart Metro with
`npx expo start --dev-client --clear`.

Profiles (`eas.json` in each app): `development` (dev client, `APP_ENV=development`), `preview`
(staging, installed from a link) and `production` (store builds). Values the native side needs are
EAS environment variables, set per EAS environment with `eas env:create`:

| Variable | App | What |
|---|---|---|
| `GOOGLE_MAPS_IOS_KEY` | dashboard | Maps SDK for iOS, restricted to the iOS bundle ids |
| `GOOGLE_MAPS_ANDROID_KEY` | dashboard | Maps SDK for Android, restricted to the package names and signing certificates (`eas credentials` shows the SHA-1) |

The dashboard draws Google Maps on iOS and Android alike. A build without its platform's key fails
rather than shipping an empty map.

## Checks

```sh
pnpm lint          # ESLint (type-aware) in every workspace that has a config
pnpm format        # Prettier, writes changes; CI runs pnpm format:check
pnpm typecheck
pnpm test          # Needs Docker: starts throwaway Postgres and Redis containers
```

`apps/server/openapi.json` is the API contract the apps are built against. Browse it at `http://localhost:3000/v1/docs` while `pnpm dev` runs (also on staging, never in production). The contract test fails when the API changes it; after an intended change, regenerate it with `pnpm --filter @hagz/server test -u` and commit it with the change.
