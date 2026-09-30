# Railway

`railway.ts` describes the whole Railway project (services, Redis, volumes, regions, variables) for every environment. `staging` deploys the `staging` branch and `production` deploys `main`.

## Changing infrastructure

Edit `railway.ts` in a feature branch and open a PR. CI posts the plan as a PR comment:

| PR into | Plans against |
|---|---|
| `dev`, `staging` | `staging` |
| `main` | `production` |

When the PR merges into `staging` or `main`, CI applies it to that environment. Merges into `dev` only plan.

**Destructive changes are never applied by CI** (deleting a service, variable or volume, or moving a volume). The apply job fails instead. Review the plan, then apply by hand:

```sh
railway link    # pick the hagz project and the environment
railway config plan
railway config apply --confirm-destructive
```

## Secrets

Secrets are never written here. They're Railway **shared variables** on each environment, referenced as `ctx.shared.NAME`:

| Shared variable | Value |
|---|---|
| `DATABASE_URL` | Neon pooled connection string for that environment's branch |
| `DIRECT_DATABASE_URL` | Neon direct connection string, used only for migrations |

Set them in the Railway dashboard (Project Settings → Shared Variables) before the first deploy of an environment.

## Known issue

`railway config plan` doesn't always pick up a service's region (`replicas`) for services that have never deployed. If a service lands in the wrong region, fix it in the dashboard (Settings → Regions), then re-plan.
