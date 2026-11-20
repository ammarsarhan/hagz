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
| Kubernetes | One image and two processes run well on a single container host (see [deployment.md](deployment.md)). |
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
- Modules talk through each other's public `index.ts`, never through each other's internals. Each table belongs to one module, and only it writes the table or locks its rows. Reading another module's tables is allowed, read-only, as joins or lookups (decided 2026-11-19): one Postgres, and joins are the point of a modular monolith; routing every read through another module's functions would cost queries and duplicate shapes for nothing.
- When a module must change what another owns and can't import it (the import would go the wrong way), it declares a hook and the composition root (`src/http/router.ts`) hands it the owner's function: identity's active-admin check for platform's `requireAdmin`, venues' layout clean-up for an amenity locations makes unplaceable. A hook that isn't set refuses the change rather than skip it.
- `eslint-plugin-boundaries` enforces this in `pnpm lint` (`apps/server/eslint.config.js`):
  - another module is reachable only through its `index.ts`, and a module's own layers never import that `index.ts`;
  - `http` → `application` → `domain`, never upwards, and module `http` never touches the database;
  - `domain` imports no Prisma, Redis, BullMQ or Hono, and no platform service except errors;
  - `platform` never imports modules or `http`.
- `test/architecture/table-ownership.test.ts` checks the tables, which lint can't see. Each table belongs to its schema file's module (`FILE_OWNERS`); only that module writes it or locks its rows, and `platform` touches none, reads included. It reads the source for Prisma writes (direct and through a relation) and raw SQL that inserts, updates, deletes or locks, and fails on any crossing that isn't in its `KNOWN` list (empty since 2026-11-19), each entry with why and how it should be fixed; an entry that no longer happens fails too, so the list only shrinks. A table with no owner yet (bookings, payments, payouts…) can't be touched until its module is added. Reads across modules are allowed, so they aren't checked.
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
4. Exclusion constraints as a database backstop: overlapping slots are refused now, overlapping bookings from Phase 4 (see [Exclusion constraints](#exclusion-constraints)).

Don't insert the booking first and claim the slots after. Every contender's insert then waits on the others' uncommitted bookings in the `Booking_no_overlap` constraint, so a popular slot turns into lock timeouts and deadlocks, and the stuck transactions hold the whole connection pool (see [Why precomputed slots](#why-precomputed-slots)).

The proof is a test: 100 parallel requests for the same slot produce exactly one booking, and the other 99 get `409 SLOT_UNAVAILABLE` quickly. A version that ends in timeouts or deadlocks also never double books, so the test must check the losers too.

### State machines

- Allowed transitions live in a table in code (bookings: `PENDING → HELD → CONFIRMED → COMPLETED | NO_SHOW`, plus `CANCELLED` and `EXPIRED`; payments, refunds, payouts, deliveries, listings, community members, tournaments and their teams and matches likewise).
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
| Open-game joining fees | A `BookingListing` whose booking is `COMPLETED`, more than 24 hours after its end, with no `JOIN_FEE` entry | By `startsAt` on `@@index([status, startsAt])`, checked against the unique `JOIN_FEE` entry per listing |

If Redis is down, requests still succeed and the sweepers catch up when it's back. Nothing is lost.

### Payments and money

- A payment's status changes only through signature-verified webhooks or reconciliation. The app's redirect is only a hint to start polling.
- Webhook handlers are idempotent and handle events arriving out of order (a refund event before its payment's success).
- Amounts are integer minor units with the currency's ISO 4217 exponent (KWD, BHD and OMR have 3). No floats anywhere in money code.
- `LedgerEntry` is append-only. Balances are sums in SQL.
- A balance goes negative when a venue owes Hagz: commission on cash bookings, and open-game joining fees the venue collected. Payouts net it off first. What's left is settled by hand (a wire, or cash collected in person) and recorded by an admin as an `ADJUSTMENT` whose note gives the method and reference. There's no separate settlement type (decided on 2026-10-30).
- Creating a payout locks the venue's row (`SELECT ... FOR UPDATE`) so two payouts can't spend the same balance. Money transactions that read and then write run with a retry wrapper for serialization failures and deadlocks (`40001`, `40P01`).
- A nightly audit checks the invariants and alerts on any drift:
  - each booking's `total` equals the sum of its charges;
  - the ledger agrees with payments, refunds and payouts;
  - no refund exceeds its payment;
  - every completed open game has exactly one `JOIN_FEE` entry, equal to the recorded (or assumed) player count × the listing's `joinFee`.
- Provider code sits behind a `PaymentProvider` interface (create, refund, verify webhook, fetch status), matching the provider-neutral schema.

### Time

- Store everything as UTC `timestamptz`. Convert to local time with the marketplace's IANA timezone, never a fixed offset.
- Code gets the time from an injected `Clock`, so tests can move time.
- Slot generation has property-based tests (`fast-check`) across Egypt's DST changes (see the slot generation rules).

### Exclusion constraints

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

The slot constraint closes a real gap (manual slots), and is in the grounds migration (2026-11-18, with `btree_gist` in the first one); the booking one comes with bookings (Phase 4). The booking constraint is a backstop: the slot claim should already prevent overlaps, but if application code ever writes a booking whose range doesn't match its slots, Postgres refuses it. Like the CHECKs, Prisma can't declare these, so they're hand-added to a migration and verified for drift.

### Migrations

Agreed while building the schema (2026-10-25 onwards) and used for every change since.

- **One migration per domain,** matching the schema files (`20261025000000_postgis`, then admins, staff, customers, … listings, communities, tournaments), in dependency order. Each enum is in the first migration that uses it, and each foreign key in the later of its two tables' migrations (so `BookingListing → Community` is in communities).
- **Until a database outside development has applied them, changes fold into their domain's migration** instead of adding small migrations: a new column, CHECK or index goes with its table. A new domain gets a new migration (communities and tournaments did on 2026-11-19). From the first deployment on, an applied migration is never edited again; every change is a new migration.
- **Hand-written SQL** for what Prisma can't declare, each marked with a comment saying so: CHECK constraints, exclusion constraints, functions (`fold_name()`) and expression indexes (the trigram index on venue names). Prisma's diff can't see them, so it neither creates nor reports them.
- **Indexes Prisma declares stay exactly as declared.** Changing one by hand (adding `INCLUDE` columns to the unique `(groundId, startsAt)` index, for example) shows up as drift, and Prisma would rewrite it.
- **Renames are written by hand** (`ALTER TABLE … RENAME COLUMN`). Prisma's diff turns a rename into dropping and adding the column, which loses the data.
- **Verifying a change:**
  1. migrate a fresh database from scratch (`migrate deploy`), and check that `prisma migrate diff` against the schema is empty;
  2. insert good rows and rows that must be refused, and check each CHECK refuses its bad row;
  3. compare constraint, index and function definitions (`pg_get_constraintdef`, `pg_indexes`, `pg_get_functiondef`) between that database and the development one, since the diff can't see hand-written SQL.
- **Updating a development database after a migration was edited in place:** `migrate deploy` skips a migration that's already recorded, so the edit never reaches it. Either reset it (`prisma migrate reset`, then `seed:reference`) when its data doesn't matter, or apply the edited statements by hand and set that migration's `checksum` in `_prisma_migrations` to the SHA-256 of the edited file. `ALTER TYPE … ADD VALUE` must run outside the transaction that uses the new value, with `BEFORE` so the enum's order matches a fresh database.

## Reliability

| Area | Rule |
|---|---|
| Timeouts | Set on the database (migration `20261026000001_timeouts`), because Neon's pooler rejects them as connection parameters: `statement_timeout` 5 s, `lock_timeout` 2 s, `idle_in_transaction_session_timeout` 30 s. Worker jobs and migrations that need longer raise them for themselves with `SET LOCAL`. Requests time out after 15 s and transactions after 10 s, but only the database timeouts actually stop work. Every outbound HTTP call has a timeout. |
| Retries | Only for idempotent operations, with exponential backoff and jitter. A circuit breaker on each provider (payments, WhatsApp, push) fails fast when the provider is down. |
| Health | `/health/live` checks only that the process is up and drives restarts. `/health/ready` drives traffic and the host's deploy healthcheck: it fails while shutting down or when Postgres is unreachable. Redis is reported but doesn't fail it, because the API keeps working without Redis (see "Redis down"). A database blip must not cause a restart loop. |
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

### Search ranking

Agreed on 2026-11-19. **Filters decide which venues appear; the sort decides their order.** A venue that fails a filter never appears, however loyal the player is.

The sorts the player picks (distance, price, rating, soonest available) are applied exactly as named, except that a rating counts only from `MIN_REVIEWS` (5) reviews up: the rating sort puts venues with fewer after the rest (best rated first among them, the unrated last), and a minimum rating leaves them out. Only **best match**, the default, is personal. It orders venues by tier first, then by a match score within each tier:

| Tier | The venue is one where the player… | Read from | Card badge |
|---|---|---|---|
| 0 | has earned a free booking | their `LoyaltyCard` is `EARNED` | "Free booking ready" |
| 1 | is collecting stamps | their `LoyaltyCard` is `OPEN` | "2 of 4" |
| 2 | has played before | `VenueCustomer.bookingCount > 0` | "Played here 3×" |
| 3 | could collect stamps | `VenueSettings.loyaltyStamps` is set | "Loyalty" |
| 4 | none of these | | |

- Tiers 0 and 1 come from the player's card, not the venue's settings, because a card stays valid after a venue turns loyalty off.
- Guests and players with no history only see tiers 3 and 4.
- **The match score** combines closeness (to the player or the chosen area's centre), rating, and how well the free times fit the requested time. Rating is a Bayesian average: a venue with few reviews is pulled towards the marketplace mean, so three five-star reviews don't beat three hundred four-and-a-half-star ones. The weights are constants in code, tuned on real data after launch.
- **The query:** the player's own venues come first, from one small CTE over `VenueCustomer` (indexed on `customerId`) joined to their open card. The partial index already allows at most one open or earned card per venue customer. The tier is a `CASE` over that CTE and `VenueSettings`. Pages use a keyset cursor on `(tier, score, venueId)`.
- **Caching:** guest results can be cached briefly, as above. A signed-in player's best match is computed per request. Their own venues number in the tens, so this costs a few milliseconds and keeps their cards' state exact.
- **The app says how results are ranked** ("Your venues and loyalty venues first, then by distance, rating and availability"), so the order never looks like paid placement.

### Search indexes

Measured on 2026-11-19 (PR 3.1) against `seed:scale`: a local `hagz_scale` database with 1,000 live venues, 3,953 grounds and 5.7M slots (2.2 GB with indexes, 82% of slots free). Run `pnpm --filter @hagz/server seed:scale` to rebuild it. It refuses any server that isn't local, and leaves the development database alone. Its data is repeatable (the same seed gives the same venues, so plans compare between runs). Taken slots are stored as `BLOCKED`, not `BOOKED`: a booked slot needs a real booking, and search only asks whether a slot is `AVAILABLE`, so the plans are the same without millions of bookings.

**Names.** `fold_name()` (first migration) folds a name the way `foldName` in `src/platform/text/fold.ts` folds what the player types: case, Latin accents, Arabic diacritics, hamza and madda forms, ى/ي, ة/ه, Arabic-Indic digits, spaces and the invisible marks pasted text carries. A test keeps the two equal. Venue names have a trigram index on `fold_name(name)`, which `LIKE '%part%'` uses. Postgres inlines the function into both the index and the query, so it must stay `IMMUTABLE`, and changing it means a migration that replaces it and rebuilds every index on it.

**Availability: no new index.** Four search shapes, warm cache:

| Shape | Existing indexes | + covering `(groundId, startsAt) INCLUDE (status, price, tier)` | + partial, same `WHERE status = 'AVAILABLE'` |
|---|---|---|---|
| Near me (5 km), 5-a-side, free 20:00–22:00 | 0.3 ms, 375 buffers | 0.3 ms, 324 | 0.3 ms, 324 |
| Whole country, same | 4–8 ms, 9,050 | 4.0 ms, 7,173 | 3.9 ms, 7,180 |
| Near me, any time that day | 0.5 ms, 430 | 0.4 ms, 335 | 0.4 ms, 330 |
| Whole country, a 2-hour start between 18:00 and 22:00 | 9 ms, 9,259 | 8.1 ms, 7,264 | 7.7 ms, 7,198 |

- The unique `(groundId, startsAt)` index already answers every shape, with the venue GiST index for "near me". The rest of the reads are one B-tree descent per candidate ground, which no index shape removes.
- Both candidates allow index-only scans and save about 20% of buffer reads, but cost 320 MB (covering) or 221 MB (partial) and slow every write to the busiest table. Adding the columns to the existing unique index instead isn't possible: Prisma owns that index (slot generation upserts through it) and reports the change as drift.
- **Revisit** if 3.3's latency budgets fail under load or with a cold cache, which this test didn't cover. Add the partial index first: it's the smaller one, and taken slots never match a search anyway.

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

**Writes.** Same database, creating a 2-hour booking in a Prisma interactive transaction (the `transaction()` path, with the database timeouts on). Three orderings:

- **slots, insert first**: insert the booking, then claim its slots with a guarded `UPDATE … WHERE status = 'AVAILABLE'`.
- **slots, lock first**: lock the slots (`SELECT … FOR UPDATE`), insert the booking, then mark the slots (the rule in [No double bookings](#no-double-bookings)).
- **rules**: check the schedule and blocks, insert the booking, and let the `Booking_no_overlap` exclusion constraint reject overlaps.

| Strategy | p50 | p99 | Throughput (10 concurrent) | 100 parallel requests for one slot |
|---|---|---|---|---|
| slots, insert first | 6.1 ms | 30 ms | 715/s | 1 booked; 99 errors (lock timeouts, exclusion violations, no free connection); 3–6 s |
| **slots, lock first** | 4.5 ms | 16 ms | 669/s | **1 booked; 99 clean 409s; 58–73 ms** |
| rules | **3.7 ms** | **14 ms** | **1,061/s** | 1 booked; 97–99 errors (lock timeouts, deadlocks, no free connection); 2–7 s |

- **A booking costs about 1 ms more with slots.** Marking two slots `HELD` changes `bookingId`, which is indexed, so Postgres can't update the rows in place: it writes new row versions and new entries in all four slot indexes. Even the slowest strategy handles about 700 bookings a second, against a launch load of tens of thousands a day (under one a second on average).
- **The race is where slots win the write path too.** A slot row is a lock on exactly one hour of one ground, so losers wait on it briefly and leave without writing. Without slots, only the exclusion constraint settles the race: each contender's insert waits on the others' uncommitted rows, which ends in deadlocks and lock timeouts. Inserting the booking before claiming the slots fails the same way.
- **A contended slot can starve the whole API.** In both failing orderings, stuck transactions held all ten pool connections, and most requests failed with Prisma's "Unable to start a transaction in the given time". In production that would stall every endpoint on that instance, not just the slot being fought over. Nobody was double booked in any strategy, which is why the race test must check the losers' responses (see [No double bookings](#no-double-bookings)).

The writes slots add in the background, timed on the same data:

| Job | Rows | Time |
|---|---|---|
| Regenerate one ground's 90 days after an owner edits its schedule | about 1,300 | about 30 ms |
| Nightly roll-forward: one new day for every ground | about 38k | about 1.5 s |
| Nightly purge: one past day of `AVAILABLE` slots | about 39k | about 0.4 s |

All of them run in the worker, never in a customer's request. Regenerating a ground is fast enough to run straight after the owner saves.

What slots cost: about 1 ms per booking, the generation job, the nightly roll-forward and purge (about 64k rows in and out a day at 1,000 venues), and schedule and slot data that can drift apart, kept in step by `scheduleVersion` and the rule that only the job writes generated slots. Revisit if the table passes about 50M rows (partition by month on `startsAt`), owners need to plan beyond 90 days (add schedule overrides, not a longer horizon), or slot lengths vary per ground.

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
- Renovate and `pnpm audit` in CI, pinned base images, and secrets only in the host's environment (never in the repo; see [deployment.md](deployment.md)).

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
- Icons are sent by names Hagz owns, never an icon library's. An amenity stores one of `AMENITY_ICONS` (`packages/contracts`), which the API enforces and an admin picks from. Each app maps those names to its own drawings (the admin web: `admin/platform/amenity-icons.ts`, typed so no name can be missing). A library renaming an icon breaks that app's build, not stored data or released apps, and the fix is one line in its map. Adding an icon is a line in the list and in each map, then an app release. The list stays short so apps bundle only the icons they can be sent.

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
| 4b. Communities and tournaments | Open and closed communities, members-only games, venue and community tournaments with fixtures and results | Concurrent joins never pass a limit; brackets fill correctly through byes and walkovers |
| 5. Payments | Paymob spike, provider adapter, webhooks, reconciliation, cash | Missing, duplicate and out-of-order webhook tests pass |
| 6. Money out | Cancellations, refunds, ledger, commission, payouts, nightly audit | The audit shows no drift across randomized simulations |
| 7. Engagement | Notifications, loyalty, reviews, discounts | Notifications survive a Redis outage |
| 8. Accounts and activity | Profile, sessions, account deletion, venue activity feed | Deletion anonymizes and keeps money records intact |
| 9. Launch readiness | OTP abuse protections, observability, load tests, security review, restore drill, production on the chosen host, API and database in one region, legal | Runbooks exist and the restore drill succeeds |
| 10. Store launch | Polish, store listings and submissions, the production cut-over (each phase already ships its own screens) | Both apps pass store review |

## Open decisions

- Where the API and worker run: Railway or a VPS. The trade-offs, and the contract any host must meet, are in [deployment.md](deployment.md). Decided before Phase 9; until then nothing new depends on Railway.
- Moving the API and the database into one region. Staging on Railway runs in `europe-west4` (Netherlands) and Neon in Frankfurt. Settled by the hosting decision above.
