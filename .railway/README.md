# Railway

`railway.ts` describes the whole Railway project (services, Redis, volumes, regions, variables) for every environment. `staging` deploys the `staging` branch and `production` deploys `main`.

Code deploys are automatic: when a commit lands on `staging` or `main` and CI passes, Railway builds and deploys it. Changes to this file are **not** applied automatically.

## Changing infrastructure

Edit `railway.ts` in a feature branch like any other change. After it merges, apply it from your machine:

```sh
railway login
railway link          # pick the hagz project and the environment to change
railway config plan   # safe: shows what would change
railway config apply  # asks before applying
```

Review destructive changes (deleting a service, variable or volume, or moving a volume) carefully before confirming.

## Secrets

Secrets are never written here. They're Railway **shared variables** on each environment, referenced as `ctx.shared.NAME`:

| Shared variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string for that environment's branch |
| `DIRECT_DATABASE_URL` | Neon direct connection string, used only for migrations |

Set them (Project Settings → Shared Variables) before the first deploy of an environment.

## Setting up a new environment

`railway.ts` doesn't cover everything. For a new environment (for example `production`), also:

1. **Set the shared variables** (see [Secrets](#secrets)) before the first apply.
2. **Apply**, then check each service's region in the dashboard (see [Known issues](#known-issues)).
3. **Create a deploy-on-push trigger** for `api` and `worker` on that environment's branch, with "Wait for CI" on. In the dashboard: service → Settings → Source, reconnect the repo and pick the branch. Without a trigger, pushes never deploy.
4. **Generate a domain** for `api` (Settings → Networking). Generated Railway domains aren't part of `railway.ts`.
5. **Deploy** each service once: in the dashboard, open the command palette (Cmd+K) → "Deploy latest commit".

The Railway GitHub App must have access to this repo (github.com/apps/railway-app → Configure). Builds can still work without it because the repo is public, but push triggers can't be created.

## Known issues

- **Regions are sometimes skipped.** `railway config plan` doesn't always pick up a service's region (`replicas`), especially for services that have never deployed. If a service lands in the wrong region, fix it in the dashboard (Settings → Regions), then re-plan.
- **New databases ignore their settings at first.** A Redis created by `railway config apply` starts with the template's default start command and region. Run `railway config apply` a second time to set the start command, fix the region as above, then redeploy it.
- **Deploys started by `railway config apply` fail.** Changing a service's variables or settings through an apply queues a redeploy that fails without building. The running deployment keeps serving. After applying, deploy the latest commit from the dashboard (Cmd+K → "Deploy latest commit").
- **Some changes never clear.** After an apply, `railway config plan` keeps showing `source.checkSuites` on `api`/`worker` and `networking` on the Redis services. Applying them changes nothing; ignore them.
