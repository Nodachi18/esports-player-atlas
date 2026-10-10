# Deployment and rollout plan

Live at **https://www.esports-player-atlas.workers.dev**, in Cloudflare account
`877776dfd5a7c2cc7304cb6456115313` (recorded in `wrangler.jsonc`).

**Public, deliberately.** `README.md` warns against exposing this without the anti-abuse
work, and that warning stands: without accounts a voter id is a `localStorage` UUID that
resets in two clicks, so ratings here are stuffable by anyone who cares to. The decision is
to ship it anyway as a prototype, treat the ratings as **disposable**, and prioritise
Discord auth. What that buys is a URL you can open and show people; what it costs is listed
under Accepted risks.

## Decisions

| | |
|---|---|
| Gate | **None.** See the reversal below |
| Account | `877776dfd5a7c2cc7304cb6456115313` |
| Worker name | `www`, so the host is `www.esports-player-atlas.workers.dev` |
| Host | `workers.dev`; custom domain deferred |
| Environments | One. No staging until there is data worth protecting |
| Deploy | CI on push to `main`, after tests; PRs run tests only |
| Migrations | Applied by CI, before the deploy |
| Production data | By migration only. No API scripting, no service token |
| Indexing | `robots.txt` disallows all, so a prototype is not indexed as fact |

### Reversal: the gate was dropped

The plan originally called for Cloudflare Access on the Worker, chosen because it protects
the Worker **and its assets** — a check inside `src/worker.js` cannot, since assets are
served without invoking the Worker.

**Access turned out to require a payment method on the account**, even for the free Zero
Trust tier. Rather than add one, the deployment goes public.

The considered alternative was Basic auth in the Worker with path-scoped
`run_worker_first: ["/", "/index.html"]` — gating the page and `/api/*` while leaving CSS
and JS free and direct, at a cost of one extra counted request per page load. Rejected as
not worth the code for a prototype whose data is disposable anyway, and which would be
deleted again the moment Discord auth lands.

## Phase 1 — provision and first deploy (by hand, once) — **done**

1. `npx wrangler d1 create esports-player-atlas` → `a5d65c76-5b23-49d1-bf45-49383957a680`
2. `npm run db:migrate:remote` — `0001_init` and `0002_players`, giving 38 players
3. `npm run deploy`
4. `npx wrangler secret put ADMIN_KEY` and `APP_SECRET` — both set, confirmed by
   `/api/admin/stats` returning `403` rather than the `503` an unconfigured Worker gives
   ([src/worker.js:269](../../src/worker.js#L269))
5. Worker renamed to `www` in the dashboard, with `name` in `wrangler.jsonc` following

**Renaming is a dashboard action, not a config one.** Wrangler deploys *by name*, so
changing `name` without renaming first creates a second Worker and orphans the old one —
still deployed, still serving, still bound to the same database.

## Phase 2 — CI

One workflow, on pull requests and pushes to `main`. Tests and `npm run check` run on both;
migrations and deploy run only on `main`, only after the tests pass in the same run — so
what deploys is the merged tree that was just tested.

Needs one GitHub Actions secret: a Cloudflare API token scoped to **Workers Scripts: Edit**
and **D1: Edit** on this account only. Never a global API key. `account_id` is in
`wrangler.jsonc`, so CI needs nothing else.

See [02-ci-test-and-deploy](02-ci-test-and-deploy.md).

## Phase 3 — production data — **done**

The roster lives in `migrations/0002_players.sql`, so production and local share one
version-controlled source. `seed/demo.sql` keeps only what must never reach production: the
demo player and the public `PRO-DEMO-2026` invite, which anyone reading this repo could
exchange for a professional token valid 30 days.

## Limits

Two separate ceilings, both resetting at midnight UTC:

| | Free plan | What happens past it |
|---|---|---|
| Worker requests | 100,000/day | **Error 1027**; the site stops serving |
| D1 rows read / written | per the D1 pricing page | Queries fail with an explicit error, as of 1 Sep 2026 |

**Static asset requests are free and uncounted** — a request only counts when it invokes the
Worker. Here that means `/api/*` alone: `index.html`, `styles.css` and the seven ES modules
are served directly. A page load costs about **three** counted requests, not twelve, so the
practical ceiling is roughly 33,000 page loads a day.

That is also the reason to never set `run_worker_first: true` blanket — it converts every
asset request into a counted one and quarters the ceiling.

## Rollback

**Code**: `npx wrangler rollback` returns to the previous deployment.

**Schema**: nothing. D1 migrations are forward-only, so a bad one is fixed by writing
another. That asymmetry is why migrations must be additive — see
[04-migration-safety-skill](04-migration-safety-skill.md).

## Accepted risks

Going public without accounts is a deliberate trade, not an oversight. What it means:

- **Anyone can rate, repeatedly.** A voter id is a resettable browser token, so the
  published medians are not defensible. Treat all pre-account ratings as disposable, which
  is also what [accounts/06](../accounts/06-legacy-ratings-after-accounts.md) has to decide.
- **The admin key field sits in the footer of every public page**, and
  `/api/admin/login` has no rate limiting. The key itself still protects admin — 16+ chars,
  constant-time comparison — but the form now advertises the endpoint to the open internet.
  [moderation/01](../moderation/01-rate-limit-admin-login.md) moves from nice-to-have to the
  next thing worth doing.
- **A publicly reachable site operated from Germany brings legal obligations** that were
  hypothetical while this was local: provider information that is easily recognisable, and a
  privacy statement, since the app stores rating data and will store Discord identifiers.
  [content-pages/01](../content-pages/01-help-and-legal-notice.md) is no longer deferrable on
  the same terms.
- **No security headers.** The Worker sets `content-type` and `cache-control` and nothing
  else — no CSP, no `X-Frame-Options`, no HSTS.
- **The site is not indexed**, by `robots.txt`, so the ratings are not presented to search
  engines as fact. Delete that file when the data is worth finding.
- **CI applies migrations automatically**, against the recommendation to keep that manual.
  The guardrail moved to authoring time instead:
  [04-migration-safety-skill](04-migration-safety-skill.md).

## What closes the gap

In priority order, now that it is public:

1. [accounts/01](../accounts/01-discord-oauth-sign-in.md) — sign-in, which is what makes a
   rating attributable and the whole thing defensible.
2. [moderation/01](../moderation/01-rate-limit-admin-login.md) — rate limiting.
3. [content-pages/01](../content-pages/01-help-and-legal-notice.md) — the legal pages.
4. [frontend/01](../frontend/01-unrated-players-in-ranked-views.md) — the 38 players have no
   ratings, so the leaderboard is empty and every player shows a dash on first load.
