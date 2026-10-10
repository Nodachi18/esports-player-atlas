# CI: test on every PR, deploy on main

Status: ready-for-agent
Source: deployment spec, Phase 2

**Unblocked** — 01 is resolved, the Worker is live, and `main` now carries the deployed
configuration, so CI deploying from it goes to the right place.

## What to build

One workflow at `.github/workflows/ci.yml`, triggered on `pull_request` and on `push` to
`main`.

Shared steps, both triggers: checkout, Node 22 (`package.json` sets `engines.node >= 22`),
`npm ci`, `npm test`, `npm run check`.

Main-only steps, after the above pass in the same run: apply D1 migrations, then deploy.
One workflow rather than two, so what deploys is the merged tree that was just tested rather
than the branch that was tested before merging.

```
npx wrangler d1 migrations apply DB --remote
npx wrangler deploy
```

**Migrations before deploy, never after.** New code against an old schema fails immediately.
The reverse order is survivable only because migrations are required to be additive — see
[04-migration-safety-skill](04-migration-safety-skill.md).

## Secrets

One GitHub Actions secret, `CLOUDFLARE_API_TOKEN`, scoped to **Workers Scripts: Edit** and
**D1: Edit** on this account only. Never a global API key, which would carry every
permission on every zone.

`account_id` is committed in `wrangler.jsonc`, so nothing else is needed.

`ADMIN_KEY` and `APP_SECRET` are Worker secrets set once by hand; CI neither reads nor sets
them.

## Watch out

- `npm run check` runs `wrangler deploy --dry-run`, which needs no credentials. Keep it in
  the PR path.
- Pin the action versions rather than floating on a tag that can move under you.
- A PR from a fork gets no access to repository secrets. That is correct and should stay
  that way — the deploy steps are `main`-only regardless.

## Done when

A PR shows a red check when a test fails and blocks merge; a push to `main` with passing
tests applies pending migrations and deploys; a push with failing tests deploys nothing.
