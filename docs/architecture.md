# Architecture

How the Hagz API is built to stay correct, survive failures and scale. Read this before adding a module, a job or a migration.

## Principles

- **Correctness first.** No double bookings, no lost payments, no ledger drift. Scale comes second: Postgres handles our expected load easily, so the risk is in query shape and concurrency, not traffic.
- **Postgres is the source of truth.** Every invariant the database can hold is enforced there (CHECKs, unique and partial indexes, foreign keys). Redis holds nothing that can't be rebuilt from Postgres.
- **Assume every dependency fails.** Redis, the payment provider, WhatsApp, the network, a deploy halfway through. Each failure must be detected, contained and recoverable without losing data.
- **Write decisions down.** Significant decisions get a short ADR in `docs/adr/`: the context, the decision, and what we gave up.

## Non-goals

| Not doing | Why |
|---|---|
| Microservices | One team, one database. They would turn function calls into network failures and take away transactions. |
| A transactional outbox, Kafka, event sourcing | The models already record intent (see [Side effects](#side-effects)), so jobs can be rebuilt from Postgres. |
| Kubernetes | Railway runs stateless containers well enough. |
| GraphQL | Mobile apps stay on old versions; a versioned REST contract is easier to keep compatible. |

## Layout: a modular monolith

```
apps/server/src/
  modules/
    identity/       auth, sessions, OTP, 2FA
    venues/         venues, settings, staff, permissions, layout
    grounds/        schedules, slot generation
    bookings/       holds, state machine, charges
    payments/       provider adapters, webhooks, refunds
    ledger/         entries, commission, payouts
    notifications/  deliveries per channel
    loyalty/ reviews/ discounts/
  platform/         db, transactions, idempotency, logging, errors, clock, rate limits
  http/             composition root: global middleware, mounts each module's routes
  app.ts worker.ts  process entry points
```

- Each module has three layers:
  - `http` parses and validates input (zod) and serializes output.
  - `application` holds the use cases. They own transactions.
  - `domain` holds pure functions: pricing, VAT, cancellation tiers, state transitions, slot maths.
- Modules talk through each other's public `index.ts`, never through each other's tables or internals.
- `eslint-plugin-boundaries` enforces this in `pnpm lint` (`apps/server/eslint.config.js`):
  - another module is reachable only through its `index.ts`, and a module's own layers never import that `index.ts`;
  - `http` → `application` → `domain`, never upwards, and module `http` never touches the database;
  - `domain` imports no Prisma, Redis, BullMQ or Hono, and no platform service except errors;
  - `platform` never imports modules or `http`.
- `@hagz/contracts` holds the zod schemas for requests and responses. The OpenAPI spec is generated from them (`@hono/zod-openapi`), and the apps and the web frontend use them as typed clients.
- Prisma models never leave the server. Every response is an explicit DTO, so new columns (and secrets like `refreshTokenHash`) are never exposed by accident.

## Correctness

### No double bookings

1. A booking locks its slots **before it writes anything**, inside its transaction:
   ```sql
   SELECT id FROM "GroundSlot"
   WHERE "groundId" = $1 AND "startsAt" = ANY($2) AND status = 'AVAILABLE'
   ORDER BY "startsAt"
   FOR UPDATE
   ```
   Fewer rows than requested means a slot was taken: roll back and return `409 SLOT_UNAVAILABLE`. Concurrent requests queue on the row locks. When the winner commits, Postgres re-checks each waiting row, finds it no longer `AVAILABLE`, and drops it, so every loser gets the 409 without writing anything.
2. Only then insert the `Booking` and mark the locked slots `HELD` with its id.
3. Rows are always locked in a fixed order (`startsAt` ascending) so overlapping requests can't deadlock.
4. **Proposed:** exclusion constraints as a database backstop (see [Exclusion constraints](#exclusion-constraints-proposed)).

Don't insert the booking first and claim the slots after. Every contender's insert then waits on the others' uncommitted bookings in the `Booking_no_overlap` constraint, so a popular slot turns into lock timeouts and deadlocks, and the stuck transactions hold the whole connection pool (see [Why precomputed slots](#why-precomputed-slots)).

The proof is a test: 100 parallel requests for the same slot produce exactly one booking, and the other 99 get `409 SLOT_UNAVAILABLE` quickly. A version that ends in timeouts or deadlocks also never double books, so the test must check the losers too.

### State machines

- Allowed transitions live in a table in code (bookings: `PENDING → HELD → CONFIRMED → COMPLETED | NO_SHOW`, plus `CANCELLED` and `EXPIRED`; payments, refunds, payouts and deliveries likewise).
- Every transition is a compare-and-set: `UPDATE ... WHERE id = $1 AND status = $from`. Zero rows means someone else moved it first, so the request returns 409 instead of overwriting their change.
- The matching `BookingEvent` (or `VenueEvent`) is written in the same transaction.

### Idempotency

Mobile clients retry when a response is lost, and providers resend webhooks. Every retried request must have the same effect as the first one. There is no idempotency table: each operation is made idempotent through the models it writes (migration `20261026000000_idempotency`).

**Naturally idempotent**, no key needed:

| Operation | Why |
|---|---|
| Status transitions | Compare-and-set: a repeat finds the status already moved and returns the current state. |
| Cancelling a booking | `Cancellation` is keyed by `bookingId`, so a second insert conflicts. |
| Webhooks | `@@unique([provider, providerReference])` on `Payment`, `Refund` and `NotificationDelivery`. |
| Reviews, staff invitations, loyalty cards | One per customer per venue, one open code per phone, one open card per customer (unique and partial indexes). |
| Scheduled jobs (slot generation, payouts, expiry) | Deterministic BullMQ `jobId`s plus row locks. |

**Client-initiated creates** carry an `Idempotency-Key` header (a UUID the client generates once per user action). The key is stored on the created row:

| Model | Column | Unique |
|---|---|---|
| `Booking` | `idempotencyKey String?` | `[venueId, idempotencyKey]` (not `customerId`: a retry may create a new `VenueCustomer`) |
| `Payment` | `idempotencyKey String?` | `[bookingId, idempotencyKey]` (checkout and staff-recorded cash) |
| `Refund` | `idempotencyKey String?` | `[paymentId, idempotencyKey]` (staff and admin refunds) |
| `Payout` | `idempotencyKey String?` | `[venueId, idempotencyKey]` (admin-created payouts) |

How a retry is handled:

- **Retry after the first request committed:** the insert hits the unique index (`23505`). Load the existing row and return it, with `Idempotent-Replayed: true`.
- **Retry while the first request is still running:** Postgres makes the second insert wait for the first transaction. It then fails as above and returns the committed row, or, if the first one rolled back, goes ahead normally.
- **Same key with a different request:** the existing row's key fields (ground, time range, amount...) don't match the request. Return `422 IDEMPOTENCY_KEY_REUSED`.

Keys are UUIDs (`@db.Uuid`). Before replaying, the API checks that the existing row belongs to the caller (the booking's customer account or its `creatorId`, the payment's booking, and so on). Otherwise it returns 422, so one account can't use another's key to read their data.

The key is passed on to the provider as well: `Payment.id` is the provider's merchant order or idempotency reference, so a retried provider call can't charge twice.

### Side effects

Side effects are never sent from inside a transaction, and never only through Redis. The rule: **every job must be rebuildable from Postgres state.** The business transaction writes the intent into the models we already have. Enqueueing a job after the commit is only a fast path, and a sweeper finds anything the fast path missed.

| Effect | Intent recorded as | Sweeper (indexed query) |
|---|---|---|
| Notifications | `Notification` + `NotificationDelivery` (`PENDING`, `nextAttemptAt = now()`), written in the business transaction | `status = 'PENDING' AND "nextAttemptAt" <= now()` via `@@index([status, nextAttemptAt])`, claimed with `FOR UPDATE SKIP LOCKED` |
| Booking expiry | `Booking.expiresAt` on `PENDING`/`HELD` | `@@index([status, expiresAt])` |
| Slot generation | `GroundSettings.scheduleVersion` bumped in the edit's transaction | Stale `AVAILABLE` slots (older `scheduleVersion`), plus the nightly roll-forward |
| Payment confirmation | `Payment` `PENDING` | Reconciliation asks the provider about `PENDING` payments older than N minutes (`@@index([status, createdAt])`) |
| Refunds, payouts | `PENDING` rows | Same pattern |

If Redis is down, requests still succeed and the sweepers catch up when it's back. Nothing is lost.

### Payments and money

- A payment's status changes only through signature-verified webhooks or reconciliation. The app's redirect is only a hint to start polling.
- Webhook handlers are idempotent and handle events arriving out of order (a refund event before its payment's success).
- Amounts are integer minor units with the currency's ISO 4217 exponent (KWD, BHD and OMR have 3). No floats anywhere in money code.
- `LedgerEntry` is append-only. Balances are sums in SQL.
- Creating a payout locks the venue's row (`SELECT ... FOR UPDATE`) so two payouts can't spend the same balance. Money transactions that read and then write run with a retry wrapper for serialization failures and deadlocks (`40001`, `40P01`).
- A nightly audit checks the invariants and alerts on any drift:
  - each booking's `total` equals the sum of its charges;
  - the ledger agrees with payments, refunds and payouts;
  - no refund exceeds its payment.
- Provider code sits behind a `PaymentProvider` interface (create, refund, verify webhook, fetch status), matching the provider-neutral schema.

### Time

- Store everything as UTC `timestamptz`. Convert to local time with the marketplace's IANA timezone, never a fixed offset.
- Code gets the time from an injected `Clock`, so tests can move time.
- Slot generation has property-based tests (`fast-check`) across Egypt's DST changes (see the slot generation rules).

### Exclusion constraints (proposed)

The unique index on `GroundSlot [groundId, startsAt]` stops two slots starting at the same moment. It doesn't stop slots that **overlap**: a manual 10:30–12:00 slot added for a match night overlaps the generated 11:00 slot. A unique index can only compare exact values. An **exclusion constraint** compares ranges, and rejects any two rows where the condition holds:

```sql
CREATE EXTENSION IF NOT EXISTS btree_gist; -- lets a GiST index compare uuids with =

-- No two slots on a ground overlap in time.
ALTER TABLE "GroundSlot" ADD CONSTRAINT "GroundSlot_no_overlap"
  EXCLUDE USING gist ("groundId" WITH =, tstzrange("startsAt", "endsAt") WITH &&);

-- No two live bookings on a ground overlap in time.
ALTER TABLE "Booking" ADD CONSTRAINT "Booking_no_overlap"
  EXCLUDE USING gist ("groundId" WITH =, tstzrange("startsAt", "endsAt") WITH &&)
  WHERE (status IN ('PENDING', 'HELD', 'CONFIRMED', 'COMPLETED', 'NO_SHOW'));
```

The slot constraint closes a real gap (manual slots). The booking constraint is a backstop: the slot claim should already prevent overlaps, but if application code ever writes a booking whose range doesn't match its slots, Postgres refuses it. Like the CHECKs, Prisma can't declare these, so they're hand-added to a migration and verified for drift.

## Reliability

| Area | Rule |
|---|---|
| Timeouts | Set on the database (migration `20261026000001_timeouts`), because Neon's pooler rejects them as connection parameters: `statement_timeout` 5 s, `lock_timeout` 2 s, `idle_in_transaction_session_timeout` 30 s. Worker jobs and migrations that need longer raise them for themselves with `SET LOCAL`. Requests time out after 15 s and transactions after 10 s, but only the database timeouts actually stop work. Every outbound HTTP call has a timeout. |
| Retries | Only for idempotent operations, with exponential backoff and jitter. A circuit breaker on each provider (payments, WhatsApp, push) fails fast when the provider is down. |
| Health | `/health/live` checks only that the process is up and drives restarts. `/health/ready` drives traffic and Railway's deploy healthcheck: it fails while shutting down or when Postgres is unreachable. Redis is reported but doesn't fail it, because the API keeps working without Redis (see "Redis down"). A database blip must not cause a restart loop. |
| Shutdown | On `SIGTERM`, the API fails readiness, stops accepting connections, finishes in-flight requests within a deadline, then disconnects Prisma and Redis. The worker stops taking jobs, finishes its current ones, then exits. |
| Jobs | Processors are idempotent (BullMQ runs jobs at least once). Deterministic `jobId`s, `attempts` with backoff, zod-validated versioned payloads, and an alert when the failed set grows. Recurring jobs use job schedulers. |
| Redis down | The cache fails open (read from Postgres). The queue falls back to the sweepers. Rate limits fail closed on OTP and invite-code endpoints (WhatsApp OTP abuse costs money) and fail open elsewhere. |
| Neon | `DATABASE_URL` is PgBouncer in transaction mode, so no session state: use `pg_advisory_xact_lock`, never session advisory locks. Keep `replicas × pool size` under the pooler's limit. Scale-to-zero off in production. Practise a point-in-time restore before launch. |
| Region | The API and the database must be in the same region. Every query in a transaction pays the round trip. |
| Migrations | Expand and contract: a deploy never breaks the code that is still running. Migrations run as a pre-deploy step, not at boot, with `lock_timeout` set. CI lints them with `squawk`. Risky ones are rehearsed on a Neon branch of production. |
| Rollback | Because migrations stay backward compatible, a rollback is a redeploy of the previous image. Unfinished features ship behind flags. |

## Scalability

Rough launch numbers: 1,000 venues × 4 grounds × 16 slots a day over a 90-day horizon is about 5.8M `GroundSlot` rows, the largest table. Bookings in the tens of thousands a day are light work for Postgres.

- The API is stateless (sessions live in Postgres) and scales out with replicas.
- Availability is the hot read path. Index it to match the query (e.g. `(groundId, startsAt) INCLUDE (status, price, tier)`) and keep a query-plan budget per endpoint, checked against seeded data.
- Cache venue profiles and search results in Redis with a short TTL, invalidated on write. Don't cache availability for more than a few seconds; correctness is enforced when booking anyway.
- Past `AVAILABLE` slots are useless, so a nightly job deletes them (bookings keep the history). The table stays near its 90-day size instead of growing forever.
- Paginate with keysets, never `OFFSET`. UUIDv7 ids are time-ordered, so `WHERE id < $cursor` works out of the box.
- Later, when metrics call for it: a read replica for search, and monthly partitions for `LedgerEntry`, `BookingEvent` and `NotificationDelivery`.

### Why precomputed slots

The alternative to `GroundSlot` is working availability out on the fly: schedule hours, minus live bookings, minus staff blocks. Bookings would still be safe without slots (the `Booking_no_overlap` exclusion constraint prevents double bookings on its own), so the case for slots is speed under load, keeping the time maths in one place, and per-hour state, not correctness.

**Benchmark (2026-10-31).** The real migrations on Postgres 18 in Docker on a laptop (warm cache, no network round trip), seeded with 1,000 venues × 4 grounds: 5.3M slots (1.4 GB with indexes) and 4.8M bookings including a year of history (2.8 GB). Search for LIVE venues with a ground free for a whole window, priced from the cheapest free ground, best rated first, top 20. Each request goes through the real stack: Hono, zod-openapi validation, request id and context, access log, Prisma `$queryRaw`, DTOs and JSON. Four strategies, all returning identical results:

- **slots-sql**: one query over `GroundSlot`, grouped and ranked in SQL.
- **slots-app**: the window's `AVAILABLE` slots fetched flat, grouped and ranked in TypeScript.
- **rules-sql**: on the fly in SQL. Every hour of the window must be in the ground's `GroundSchedule` row (hours past midnight in the next day's row), with no live booking (GiST exclusion index) or block overlapping it, priced from the hours' tiers.
- **rules-app**: on the fly in TypeScript. Load the candidate grounds' schedule rows and the overlapping bookings and blocks, then expand and subtract in code (DST-aware, formatters cached).

Monday 20:00–22:00:

| Strategy | p50 | p99 | Throughput (10 concurrent) | p99 (50 concurrent) |
|---|---|---|---|---|
| slots-sql | **9 ms** | **26 ms** | **511 req/s** | **182 ms** |
| slots-app | 16 ms | 40 ms | 100 req/s | 1,032 ms |
| rules-sql | 75 ms | 248 ms | 50 req/s | 1,596 ms |
| rules-app | 100 ms | 275 ms | 19 req/s | 4,009 ms |

Thursday 23:00–01:00 (crosses midnight, so it needs two schedule rows):

| Strategy | p50 | p99 | Throughput (10 concurrent) | p99 (50 concurrent) |
|---|---|---|---|---|
| slots-sql | **8 ms** | **15 ms** | **558 req/s** | **227 ms** |
| slots-app | 13 ms | 29 ms | 135 req/s | 1,481 ms |
| rules-sql | 73 ms | 151 ms | 50 req/s | 2,354 ms |
| rules-app | 106 ms | 195 ms | 20 req/s | 5,774 ms |

p50 and p99 are from 300 sequential requests. Throughput and the concurrent p99 come from 10 seconds of closed-loop load.

What it showed:

- **The framework isn't the cost.** Hono, Zod, JSON and HTTP took about 1–2 ms in every strategy. The data model decides the rest.
- **Slots-sql is about 10× faster and has 10× the throughput of the best on-the-fly version.** Each venue costs one B-tree lookup of a few rows in a table capped at 90 days. Rules-sql does a GiST probe per ground into a bookings table that keeps every past booking, so it slows down as history grows while the slot table doesn't.
- **Push the work into SQL.** Slots-app reads the same rows as slots-sql but ships every free slot in the window to Node: about 2× slower per request and 5× lower throughput.
- **Availability maths in Node collapses under load.** Rules-app spends 20–35 ms of CPU per request on timezone conversion. That blocks the event loop, which caps a process at about 20 req/s; at 50 concurrent users its p99 passes the 5 s statement timeout.
- **The time maths is the hard part.** Seeding the benchmark hit three bugs: Egypt's skipped DST hour (duplicate slots), the repeated fall-back hour (overlapping bookings, caught by the exclusion constraint), and `timestamptz AT TIME ZONE` converting in the wrong direction (every row 4 hours late). With slots, that code lives only in the generation job. On the fly, every reader (search, venue page, dashboard grid, waitlist, booking checks) needs it.
- **Rules-sql gets harder with every feature.** A window across midnight needs a second schedule row. Manual slots, schedule overrides and per-hour holds each add another table to subtract, and none were modelled here.

What slots cost: the generation job, the nightly roll-forward and purge (about 64k rows in and out a day at 1,000 venues), and schedule and slot data that can drift apart, kept in step by `scheduleVersion` and the rule that only the job writes generated slots. Revisit if the table passes about 50M rows (partition by month on `startsAt`), owners need to plan beyond 90 days (add schedule overrides, not a longer horizon), or slot lengths vary per ground.

## Security

- Passwords are hashed with argon2id. Admins must use TOTP.
- Admins are invite-only (the first is created with `node dist/create-admin.js`). Their sessions are httpOnly, `SameSite=Strict`, `__Host-` cookies that last 12 hours and aren't extended. The admin web app calls the API through its own origin, so the cookies are first-party. Every cookie-authenticated request must also send `X-Hagz-Admin: 1`, which a cross-site page can't add without a CORS preflight. Authenticator codes work once, and the challenge between password and code is single use.
- Short-lived access tokens (about 10 minutes) and rotating refresh tokens. A reused refresh token revokes the whole session, because reuse means the token was stolen.
- Authorization is one policy layer that checks staff permissions per venue, not checks scattered across handlers. Every query on venue data is scoped by `venueId`. Every endpoint has a test that another tenant's id is rejected (broken object-level authorization is OWASP's top API risk).
  - Venue routes live under `/v1/staff/venues/{venueId}/...` and declare `[requireStaff, requireVenueAccess(area, level)]`. Handlers act only on `c.var.venue.venueId`, never on a venue id from the body.
  - Permissions are seven areas, each `none`, `view` or `manage` (`StaffPermissions` in `@hagz/contracts`). The owner can do everything whatever is stored, and stored JSON that doesn't parse grants nothing.
  - Membership is read on every request, not carried in the token, so a demotion, removal or suspension applies to the next request.
  - A venue the caller doesn't belong to answers `404 VENUE_NOT_FOUND`, exactly like one that doesn't exist.
  - Only the owner can grant more in an area than they have themselves, and nobody changes their own permissions. Writes re-check the granter under a row lock.
- Request hygiene at the edge:
  - zod validation and request body size limits;
  - a CORS allowlist and security headers;
  - webhook HMAC verification with a timestamp tolerance;
  - PII redacted from logs.
- Rate limits per IP, per account and per phone number on login, OTP and invite codes.
- Invitations are the only way in for admins and for non-owner staff. Staff invitations are matched to the invitee's verified phone (anyone else gets 404 for the code or id), last 48 hours, and are only as good as the inviter is at acceptance time. Every link Hagz sends is built from the route table in `@hagz/contracts` (`links.ts`) on `WEB_URL`, the web app's origin, which serves the universal-link verification files and the fallback pages.
- Renovate and `pnpm audit` in CI, pinned base images, and secrets only in Railway variables.

## Observability

- Structured JSON logs (pino) with a request id that is copied into jobs, so one booking can be followed from the tap to the WhatsApp message.
- OpenTelemetry traces across HTTP, Prisma and BullMQ. Sentry for errors, tagged with the release.
- Metrics:
  - rate, errors and duration per route;
  - queue depth and the age of the oldest job;
  - sweeper backlog (overdue deliveries, expired holds still held);
  - database pool saturation;
  - business numbers: bookings per minute, payment success rate, expired holds, webhook failures.
- SLOs, for example: 99.9% of booking requests succeed with p99 under 800 ms, and 99% of payments are confirmed within 60 s. Alerts fire on SLO burn rate, not on CPU.
- A runbook for each alert: Redis down, provider outage, ledger drift, stuck queue, database saturation.

## API conventions

- Routes are under `/v1`. Clients send their app version, and the API answers `426 Upgrade Required` below the minimum supported version. Old clients are never broken without a deprecation window.
- Errors are RFC 9457 `application/problem+json` with stable machine codes (`SLOT_UNAVAILABLE`, `HOLD_EXPIRED`) that the apps switch on. Never parse messages.
- Edits that two people can make at once (layout, settings, schedules) use `ETag` and `If-Match`, and a stale write gets `412`.
- Money is `{ amount, currency }` in minor units. Timestamps are ISO 8601 in UTC.
- Lists use cursor pagination.

## Testing

| Layer | What |
|---|---|
| Unit and property | Pricing, VAT split, cancellation tiers, DST slot maths, layout overlap |
| Integration | Every use case against real Postgres (testcontainers, `imresamu/postgis:18-3.6`). The database isn't mocked, because the invariants live there. |
| Concurrency | Parallel booking races, duplicate webhooks, concurrent payouts, idempotency-key races |
| Contract | CI compares the OpenAPI spec with the base branch and fails on breaking changes |
| Failure | Kill the worker mid-job, stop Redis, delay and duplicate webhooks. Nothing is lost or doubled. |
| Load | k6 against staging before launch, to find where latency starts to climb |

CI also gets a Postgres service, migration linting and the module-boundary check.

## Roadmap

Each phase is broken into pull requests in [plan.md](plan.md). Every phase ships its screens and the admin tools it needs, and is done only when its flows work in the real apps.

| Phase | Scope | Done when |
|---|---|---|
| 0. Platform ✅ | Errors, logging, request ids, timeouts, health and shutdown, transaction helper, `Clock`, idempotency columns, test harness, OpenAPI, CI | A sample endpoint passes integration, failure and contract tests |
| 1. Identity (API ✅, UI next) | Phone OTP, sessions, refresh rotation, admin TOTP, rate limits, policy layer | Tenant-isolation and token-reuse tests pass |
| 2. Venues and grounds | Reference data, venue creation and settings, media (R2), grounds and schedules, layout API, slot generation, go-live review, support tools | DST property tests pass; generation is idempotent; a venue reaches `LIVE` through admin review |
| 3. Discovery | Venue page, guest browsing, search by area, distance or name with every filter and sort, favorites | Every search shape stays within its query-plan budget on launch-scale data |
| 4. Bookings | Holds, state machine, charges, approval, expiry sweeper, venue customers and walk-ins | The 100-request race leaves exactly one booking |
| 5. Payments | Paymob spike, provider adapter, webhooks, reconciliation, cash | Missing, duplicate and out-of-order webhook tests pass |
| 6. Money out | Cancellations, refunds, ledger, commission, payouts, nightly audit | The audit shows no drift across randomized simulations |
| 7. Engagement | Notifications, loyalty, reviews, discounts | Notifications survive a Redis outage |
| 8. Accounts and activity | Profile, sessions, account deletion, venue activity feed | Deletion anonymizes and keeps money records intact |
| 9. Launch readiness | OTP abuse protections, observability, load tests, security review, restore drill, production on a paid plan, API and database in one region, legal | Runbooks exist and the restore drill succeeds |
| 10. Store launch | Polish, store listings and submissions, the production cut-over (each phase already ships its own screens) | Both apps pass store review |

## Open decisions

- Whether to add the [exclusion constraints](#exclusion-constraints-proposed).
- Moving the API and the database into one region. Railway runs in `europe-west4` (Netherlands) and Neon in Frankfurt. To be done when the services are running again.
