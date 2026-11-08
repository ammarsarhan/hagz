# Deployment

Where Hagz runs, what it needs from whatever runs it, and the choice still open between Railway and a VPS. Read this before adding anything that touches the host: a process, a variable, a healthcheck, a volume.

## Status (2026-11-08)

- **Undecided.** Staging runs on Railway (trial, kept down to save credit); production is empty. A VPS is being considered instead. The decision is made before Phase 9 ("Production"), and until then the code and docs stay platform-agnostic: nothing new may depend on Railway.
- Postgres is Neon and media is Cloudflare R2 on every option below. Only the compute (API, worker, web) and the two Redis instances move.

## The contract: what any host must provide

The app is written against this list, not against a platform. A host that provides all of it can run Hagz unchanged.

| Need | Detail | Railway today | On a VPS |
|---|---|---|---|
| One image, two processes | `apps/server/Dockerfile`, started as `node dist/app.js` (API) or `node dist/worker.js` (worker) | Two services from one Dockerfile | Two containers from one image |
| Configuration | Environment variables only, validated at boot in `platform/config/env.ts`. A missing secret stops the process | Service and shared variables | An env file per environment, readable only by the deploy user |
| Migrations | `prisma migrate deploy` before the new API starts, never at boot, using `DIRECT_DATABASE_URL` | `preDeployCommand` | A one-off container run by the deploy step before the swap |
| Healthchecks | `/health/ready` decides traffic and deploy success; `/health/live` decides restarts | Deploy healthcheck on `/health/ready` | Proxy and deploy tool check `/health/ready`; container healthcheck on `/health/live` |
| Graceful stop | `SIGTERM`, then at least 30 s before `SIGKILL` (the processes use 25 s, `platform/lifecycle/shutdown.ts`) | `RAILWAY_DEPLOYMENT_DRAINING_SECONDS=30` | `stop_grace_period: 30s` (Compose) or the deploy tool's drain timeout |
| Restarts | A crashed process exits non-zero and is started again | Restart policy | `restart: unless-stopped` |
| Zero-downtime deploys | The new API passes readiness before the old one gets `SIGTERM`. Migrations are expand-and-contract, so both versions run side by side safely | Built in | A deploy tool that does it (Kamal), or a proxy plus a blue-green script |
| Queue Redis | `maxmemory-policy noeviction`, AOF on, on a persistent volume, private network only | Redis service + volume | Redis container + named volume, bound to the private network |
| Cache Redis | `allkeys-lru`, may lose everything | Redis service | Redis container, no persistence needed |
| TLS and domain | HTTPS in front of the API on port `PORT` | Generated domain | Reverse proxy with automatic certificates (Caddy) |
| Logs | JSON lines on stdout (pino); the host collects them | Log viewer | Docker logs with rotation, shipped to a log service |
| Version shown on admin home | The deployed commit, read from `RAILWAY_GIT_COMMIT_SHA` (see [Coupling to remove](#coupling-to-remove)) | Set automatically | Passed in at build or deploy |
| Region | Next to Neon (`aws-eu-central-1`, Frankfurt): every query in a transaction pays the round trip | `europe-west4` today, the wrong side of the open decision in architecture.md | Pick a data centre near Frankfurt and measure the round trip before committing |

## Railway or a VPS

The reasons given for moving, checked against what we know:

1. **"Railway isn't consistent."** Not shown yet. The worker that looked down half the time on the admin home was the **local** stack: the server records its first sample before the worker's first heartbeat on every restart and every laptop wake, and one such minute paints a whole half-hour block red. The queue Redis answered every one of 647 samples. Staging has been off since 2026-10-30, so there's no Railway data either way. What *is* inconsistent about Railway is its tooling: the known issues in [.railway/README.md](../.railway/README.md) (regions skipped, applies that queue failing deploys, changes that never clear).
2. **"Railway adds nothing over a VPS."** It does add things; the question is whether they're worth the price. See the table below: everything in the "you build" column is real work on a VPS, and some of it (backups, OS patching) is work that never ends.
3. **"Railway is worse at scale."** Partly. Railway scales out easily (more replicas in one line of `railway.ts`), which a single VPS doesn't. Where it's worse is **cost**: it bills per vCPU-minute, GB of memory and egress, so steady load costs several times what the same capacity costs on a rented server. Hagz's load is modest and steady (see [architecture.md](architecture.md#scalability): Postgres is the bottleneck, and it's on Neon either way), which is the profile where a VPS wins on price.

| | Railway | VPS (e.g. Docker Compose + Caddy, or Kamal) |
|---|---|---|
| Deploy on push, after CI | Built in | You build it: CI pushes an image to GHCR, then deploys over SSH |
| Zero-downtime deploys, rollbacks | Built in | Kamal does both; plain Compose doesn't |
| TLS, domains | Built in | Caddy, a few lines |
| Private network | Built in | A Docker network; Redis never published on a public port |
| Restarts, healthchecks | Built in | Docker restart policy and healthchecks |
| Logs, metrics | Basic viewer, short retention | You choose and run them (or ship to a hosted service) |
| Redis persistence and backups | Volume; backups are yours | Volume; backups are yours |
| OS updates, firewall, SSH hardening | Not your problem | Yours, forever: unattended upgrades, firewall, keys only |
| Machine failure | Rescheduled elsewhere | The whole site is down until the box is back, unless there are two |
| Cost at steady load | Usage-priced, higher | Flat monthly, lower |
| Scaling out | Replicas | Bigger box first; a second box needs a load balancer |
| Infra as code | `railway.ts`, with the quirks above | Compose file or `config/deploy.yml` in the repo, applied by the deploy step |
| Preview environments | Possible | Not practical |

### What would decide it

- **Cost at launch load.** Price both for API + worker + two Redis at the expected usage, staging and production. If the gap is small, Railway's built-ins win; if it's large, the VPS pays for the ops work.
- **Ops time.** A VPS is cheap only while nobody's time is counted. Patching, backups, restore drills and on-call for the box all land on the same person writing the app.
- **Real consistency data.** Run staging on Railway for a week with the services up, then look at deploy failures, restarts and latency to Neon. That turns reason 1 into evidence.
- **Region.** Whichever host gets the compute closest to Neon's Frankfurt region.

A middle path is also open: staging on whatever is cheapest to leave running, production on the other. That only works if both follow the contract above, which is the point of keeping it.

## Staying platform-agnostic

Until the decision is made:

- **Nothing in `apps/` reads a platform's variables directly.** Platform names stay in the platform's own folder (`.railway/` today, `deploy/` for a VPS) and are mapped to neutral variables there.
- **New needs go into the contract first.** A new process, volume, variable, port or healthcheck is added to the table above before it's added to `railway.ts`, so the VPS column is never an afterthought.
- **No platform services the app can't leave.** Managed Postgres stays Neon and storage stays R2. No platform cron, queue, log drain or secret store the code depends on: jobs run in BullMQ, schedules in BullMQ job schedulers.
- **Comments name the contract, not the platform.** "the host's deploy healthcheck", not "Railway's".
- **The image is the unit.** Every host runs the same `apps/server/Dockerfile` image. Nothing is installed or configured on the host that the image needs to start.

### Coupling to remove

Places where code still says Railway. None of them blocks a move, but each is cheap to fix:

| Where | What | Fix |
|---|---|---|
| `apps/server/src/platform/config/env.ts`, `platform/deploy/info.ts`, `apps/web/src/app/admin/web-status/route.ts` | Read `RAILWAY_GIT_COMMIT_SHA` | Read a neutral `GIT_COMMIT`; `railway.ts` sets it from `${{RAILWAY_GIT_COMMIT_SHA}}`, a VPS deploy passes it in |
| `platform/lifecycle/shutdown.ts`, `platform/logger/logger.ts`, `platform/redis/connections.ts`, `apps/web/next.config.ts` | Comments that name Railway | Name the contract instead |
| `docs/architecture.md` | The Kubernetes non-goal, the health rule and the secrets rule name Railway | Updated with this doc |

## If it's a VPS

A sketch, not a plan, so it's ready if the decision goes this way:

- **Shape:** one VPS per environment near Frankfurt. Docker Compose (or Kamal) runs Caddy, `api`, `worker`, `queue` and `cache` on a private Docker network; only Caddy publishes ports 80 and 443.
- **Deploys:** CI builds the image once on `staging` or `main`, pushes it to GHCR tagged with the commit, then deploys over SSH: run migrations in a one-off container, start the new API, wait for `/health/ready`, switch traffic, stop the old one with a 30 s grace. Kamal does those steps itself.
- **Secrets:** an env file per environment on the box, owned by the deploy user, mode `600`, never in the repo. CI holds only the SSH key.
- **Backups:** the queue Redis AOF copied off the box daily (it holds jobs that can be rebuilt from Postgres, so this is about speed of recovery, not data).
- **Box hygiene:** SSH keys only, firewall allowing 22, 80 and 443, unattended security upgrades, disk alerts.
- **The web app** (`apps/web`) runs as one more container (`next start`) behind the same Caddy, or on Vercel; either fits the contract, because it reaches the API through its `/v1` rewrite.
