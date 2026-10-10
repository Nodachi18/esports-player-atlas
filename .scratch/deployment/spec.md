# Deployment and rollout plan

Target: a **gated** deployment on `workers.dev`, in Cloudflare account
`877776dfd5a7c2cc7304cb6456115313` (recorded in `wrangler.jsonc`).

Gated, not public, because `README.md` line 5 forbids a public deployment in this state and
is right to: without accounts, a voter id is a `localStorage` UUID that resets in two clicks,
so ratings are trivially stuffable. Gating buys the real deploy path, the real D1 and the
real migrations with no abuse surface and no bad data to live down. Going public later is a
toggle, not a new project.

## Decisions

| | |
|---|---|
| Gate | Cloudflare Access on the **Worker**, policy *Cloudflare account membership*, All traffic |
| Account | `877776dfd5a7c2cc7304cb6456115313` |
| Host | `workers.dev`; custom domain deferred |
| Environments | One. No staging until there is production data worth protecting |
| Deploy | CI on push to `main`, after tests; PRs run tests only |
| Migrations | Applied by CI, before the deploy |
| Production data | By migration only. No API scripting, no service token |

### Why Access rather than Basic auth

Access protects the Worker **and its assets** — the static-assets docs say so explicitly —
without `run_worker_first`. Basic auth in the Worker cannot: assets are served without
invoking the Worker, so a check in `src/worker.js` would guard `/api/*` and leave the page
wide open. Covering assets would need `run_worker_first: true`, turning every asset request
into a Worker invocation — about ten per cold page load here — and that setting must be
reverted before going public or it quietly costs money at scale.

Access also avoids adding a third credential path next to `ADMIN_KEY` and the coming Discord
auth, and it can be revoked per person.

## Phase 1 — provision and first deploy (by hand, once)

**The ordering matters.** A Worker must exist before Access can be attached to it, so a naive
sequence leaves the app publicly reachable for however long it takes to click through the
Access setup. Avoid that by deploying with no public route at all:

1. `npx wrangler login`
2. `npx wrangler d1 create esports-player-atlas` — note the printed `database_id`
3. Put that id in `wrangler.jsonc`, replacing the `00000000-…` placeholder
4. Set **`"workers_dev": false`** in `wrangler.jsonc`
5. `npm run db:migrate:remote`
6. `npm run deploy` — the Worker now exists and is reachable by nobody
7. `npx wrangler secret put ADMIN_KEY` (≥16 chars) and `APP_SECRET` (≥32), both generated
   randomly and kept in a password manager. Secrets take effect without a redeploy. Until
   they exist, admin and professional routes return `503` by design
   ([src/worker.js:269](../../src/worker.js#L269)) rather than falling back to a default
8. Enable Zero Trust on the account, then **Workers & Pages → the Worker → Access → Protect
   this Worker behind Access**, All traffic, policy *Cloudflare account membership*
9. Set `"workers_dev": true` and `npm run deploy` again
10. Verify per the checklist below

Steps 4 and 9 are the whole trick: the app is never once reachable without the gate.

## Phase 2 — CI

One workflow, triggered on pull requests and on pushes to `main`. Tests and `npm run check`
run on both; migrations and deploy run only on `main`, only after the tests pass in the same
run — so what deploys is the merged tree that was just tested, not the branch.

Needs one GitHub Actions secret: a Cloudflare API token scoped to **Workers Scripts: Edit**
and **D1: Edit** on this account only. Never a global API key. `account_id` is in
`wrangler.jsonc`, so CI needs nothing else.

## Phase 3 — production data

The 38 Brood War players move from `seed/demo.sql` into a migration, so production and local
share one version-controlled roster. `seed/demo.sql` keeps only what must never reach
production: the demo player and the public `PRO-DEMO-2026` invite.

That invite is why the seed is local-only. Its code is in plaintext in this repo and the
repo is public; anyone who reads it could exchange it for a professional token valid 30 days
and rate on the panel weighted 2:1 in every combined score.

Style and Notes stay blank until someone writes them — the Liquipedia source has no
equivalent field. See [player-profiles/01](../player-profiles/01-profile-image-and-form-field.md).

## Verification checklist

- [ ] Signed out of Cloudflare, the `workers.dev` URL shows the Access login, not the app
- [ ] The same is true for a static asset directly, e.g. `/app/styles.css` — this is the one
      Basic auth would have failed
- [ ] Signed in, the app loads and the ranked strip is populated
- [ ] `GET /api/health` returns `{"ok":true}` only from behind the gate
- [ ] Admin sign-in works from the footer, proving both secrets are set
- [ ] `wrangler d1 migrations list --remote` shows nothing pending
- [ ] Workers Logs show requests (observability is already enabled in `wrangler.jsonc`)
- [ ] Note the real `workers.dev` host and fix the Discord redirect URI
      ([accounts/03](../accounts/03-correct-deployed-redirect-uri.md))

## Rollback

**Code**: `npx wrangler rollback` returns to the previous deployment.

**Schema**: nothing. D1 migrations are forward-only, so a bad one is fixed by writing
another. Verify what D1 Time Travel retention this plan actually gets before relying on it.

That asymmetry is the reason for the rule in the next section.

## Accepted risks

**CI applies migrations automatically.** The recommendation was to keep that manual, since a
deploy can be rolled back and a dropped column cannot. The decision was to automate it and
move the guardrail to authoring time instead, via
[04-migration-safety-skill](04-migration-safety-skill.md). Recorded here so the trade is
visible rather than forgotten.

The rule that makes automation survivable: **migrations must be additive and
backward-compatible.** They run *before* the deploy, so for the seconds between the two
steps the *old* code runs against the *new* schema. Removing anything therefore takes two
releases — stop using it and deploy, then drop it in a later migration. This is exactly what
[accounts/05](../accounts/05-retire-pro-invite-surface.md) will need when `pro_invites` goes.

Also live at launch, and deliberately:

- No rate limiting anywhere, including `/api/admin/login`
  ([moderation/01](../moderation/01-rate-limit-admin-login.md)). The gate hides it for now.
- No security headers — the Worker sets `content-type` and `cache-control` and nothing else.
  No CSP, no `X-Frame-Options`, no HSTS.
- No accounts, so rating remains open to anyone past the gate. That is the whole reason for
  the gate.

## Going public, later

Not part of this plan. It needs, at minimum: Discord auth
([accounts/01](../accounts/01-discord-oauth-sign-in.md)), rate limiting, the legal pages
([content-pages/01](../content-pages/01-help-and-legal-notice.md)), and a decision on the
pre-account ratings ([accounts/06](../accounts/06-legacy-ratings-after-accounts.md)). At that
point removing the Access policy is one toggle.
