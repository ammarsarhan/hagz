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

## Known issue

`railway config plan` doesn't always pick up a service's region (`replicas`) for services that have never deployed. If a service lands in the wrong region, fix it in the dashboard (Settings → Regions), then re-plan.
