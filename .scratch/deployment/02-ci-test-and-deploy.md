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

Main-only job, `needs:` the first and gated on `github.event_name == 'push'`, so what
deploys is the merged tree that was just tested rather than the branch that was tested
before merging. It runs one command: `npm run deploy`.

**Migrations before deploy, never after.** New code against an old schema fails immediately.

That ordering is an invariant of this app, not a fact about GitHub Actions, so it lives in
`package.json` rather than in the workflow:

```
"deploy": "npm run db:migrate:remote && wrangler deploy"
```

Putting it in the YAML instead would leave `npm run deploy` — the command this repo tells
you to run — shipping new code against an old schema from a laptop. The cost of folding it
in is that `npm run deploy` is now schema-mutating, which is why
[04-migration-safety-skill](04-migration-safety-skill.md) matters more rather than less: it
now guards manual deploys too. `db:migrate:local` and `db:migrate:remote` stay
independently runnable; nothing was removed.

## Beyond the spec

Four things the workflow does that the spec does not call for:

- **`concurrency`** keyed on the ref, cancelling superseded pull request runs but **never**
  a main run. A run cancelled midway through applying a migration cannot be undone —
  forward-only means the only fix is another migration.
- **`permissions: contents: read`** at workflow level. Nothing here writes to the repo.
- **`npx wrangler`, not `cloudflare/wrangler-action`.** Wrangler is already pinned in
  `devDependencies`, so the lockfile is the single version source.
- **Actions pinned by commit SHA**, with the tag in a trailing comment. A tag can be moved
  to point at new code; a commit cannot.

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
- A PR from a fork gets no access to repository secrets. That is correct and should stay
  that way — the deploy steps are `main`-only regardless.

## Needs a human before the first deploy can go green

1. Cloudflare dashboard → **Manage Account → API Tokens**, template *Edit Cloudflare
   Workers*, restricted to account `877776dfd5a7c2cc7304cb6456115313`. Confirm it carries
   **D1: Edit** alongside **Workers Scripts: Edit**.
2. GitHub → Settings → Secrets and variables → Actions → `CLOUDFLARE_API_TOKEN`.
3. *After* the first green run: branch protection on `main` requiring the `test` check.
   Nothing below blocks a merge until this exists — a red check is only advisory on its own.
   Web UI, since `gh` is not authenticated on this machine.

Worth running `npx wrangler d1 migrations list --remote` before the first merge. `0001` and
`0002` are already applied, so the first run should report nothing pending; anything else is
a surprise worth understanding before CI acts on it.

## Done when

A PR shows a red check when a test fails and blocks merge; a push to `main` with passing
tests applies pending migrations and deploys; a push with failing tests deploys nothing.
