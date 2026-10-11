# Handoff — 2026-10-12

## Where things stand

The navigation overhaul shipped, and `main` now tests and deploys itself. The app is
**live and public** at
<https://www.esports-player-atlas.workers.dev> — deliberately, as a prototype with
disposable data, because Cloudflare Access turned out to need a payment method on the
account even for its free tier.

| | |
|---|---|
| Live | `www.esports-player-atlas.workers.dev`, Worker `www`, account `877776dfd5a7c2cc7304cb6456115313` |
| Database | D1 `a5d65c76-5b23-49d1-bf45-49383957a680`, migrations `0001` and `0002` applied |
| Data | 38 players, 3 ratings on 3 of them, no accounts, rating open to anyone |
| `main` | deploys itself — every push runs the tests, then migrations, then `wrangler deploy` |

Ratings have started arriving from whoever has found the site, but only just: **3
community ratings, 0 professional, spread over 3 players** — `boxer`, `jaehoon` and
`free`, one each, re-checked against the live API on 2026-10-11. They are unattributable
by construction — a voter id is a browser token that resets in two clicks. Three rows is
small enough that [accounts/06](accounts/06-legacy-ratings-after-accounts.md), which
decides what becomes of them once accounts exist, can probably be answered with "discard"
and closed. Check the count again before assuming that still holds.

Plans worth reading before touching anything: [deployment/spec.md](deployment/spec.md) and
[navigation-overhaul/spec.md](navigation-overhaul/spec.md). **Both record what was decided
then, not what runs now**, and the whole `navigation-overhaul/` directory — spec, map,
closed issues, prototype — is deliberately left that way rather than kept current. Check a
claim against the code before building on it; several pages it calls `planned` are built,
and one footer link it never mentions exists.

One plan *is* current, and as of 2026-10-12 it is **finished and ready to build**:
[admin-player-crud/spec.md](admin-player-crud/spec.md), labelled `ready-for-agent`. Every
decision on its map is resolved, the spec folds all of them in, and
[admin-player-crud/map.md](admin-player-crud/map.md) is **closed** — read the map only for
*how* a decision was reached, never to find out what is open, because nothing is. This is
the one plan in `.scratch/` that describes what will be built rather than what was decided
once; build from the spec.

## Do this first

**[accounts/01](accounts/01-discord-oauth-sign-in.md) — Discord sign-in.** The single
change that makes this product defensible. Until ratings are attributable, the published
medians are decoration. Blocked by
[accounts/02](accounts/02-token-kind-discriminator.md), which must come first: the OAuth
`state` value is what creates the token-confusion risk, and adding the discriminator is a
flag-day change for live 30-day pro tokens. Step 0 of sign-in is human-only — registering
the Discord redirect URIs and storing the secrets. **It also has a published promise
attached**: the privacy page carries a `planned` section stating what signing in with
Discord will mean and that none of it happens yet. Rewriting that is part of shipping this,
before it goes live rather than after.

**Five more tickets are queued behind it** and cannot start until it lands:
[accounts/04](accounts/04-promote-account-to-professional.md) promotion →
[05](accounts/05-retire-pro-invite-surface.md) retiring the invite surface,
[07](accounts/07-admin-accounts-replace-the-key.md) replacing the shared admin key with a
role, [moderation/02](moderation/02-session-revocation.md) revocable sessions, and
[03](moderation/03-ban-accounts-and-moderate-ratings.md) banning. That is the real
argument for its position here: nothing else on this list unblocks anything.

The redirect URI used to be a ticket of its own; there is no integration in the codebase
for a wrong URI to break, so it is provisioning for sign-in rather than a defect.

## Then, by value

**~~moderation/01 — rate limiting~~ — resolved 2026-10-12, and it is off this list.** The
answer to *does the delete wait for it* turned out to be that there was nothing to wait
for: the Workers `ratelimit` binding went GA in 2025 and needs no KV, no D1 and no
provisioning, so the limit is fifteen lines and lives in **admin-player-crud's own spec**,
shipping in the same build session as the delete.
[moderation/01](moderation/01-rate-limit-admin-login.md) is closed and its body rewritten,
because both options it recommended were wrong — see the traps below. Its one surviving
instruction, *apply it to `/api/auth/*`*, is now a line item on
[accounts/01](accounts/01-discord-oauth-sign-in.md).

What it did **not** cover, deliberately: `POST /api/pro/verify` is still unthrottled and is
the weaker of the two guessable endpoints, because `src/worker.js:157` takes an
admin-supplied invite code at ≥ 8 characters. Left alone only because
[accounts/05](accounts/05-retire-pro-invite-surface.md) deletes that surface. If sign-in
slips, this is worth revisiting.

**[frontend/01](frontend/01-unrated-players-in-ranked-views.md) — unrated players.** The
leaderboard route drops anyone with no ratings, and only 3 of the 38 have any, so the public
site currently opens showing **3 players**. Worse than "nearly empty" as previously written,
and arguably worth doing before the two above it: it is the first thing every visitor sees,
and it also hides newly created players from the admin who just made them.

**[admin-player-crud](admin-player-crud/spec.md) — the admin can create players and nothing
else.** `POST /api/admin/players` creates; there is no update and no delete anywhere in the
API, so a typo in a name is permanent and the Admin page renders only stats and a ratings
table. Charted as a wayfinder map on 2026-10-11 and **done planning on 2026-10-12**: all five
tickets resolved, the map closed, and
[admin-player-crud/spec.md](admin-player-crud/spec.md) written and labelled
`ready-for-agent`. **It is the only thing on this list that is fully specified and waits on
no human** — unlike sign-in, which needs a Discord application registered first. Build from
the spec; the map and the issue files are the arguments behind it, not a second source of
truth.

The spec already folds in
[contract.md](admin-player-crud/issues/03-form-behaviour-contract/contract.md) (routes,
rejections, caps, form behaviour) and
[rate-limit.md](admin-player-crud/issues/04-destructive-routes-and-rate-limiting/rate-limit.md)
(the limiter), both near enough verbatim, so neither needs re-reading to build.

**It names two new pure modules as its test seams**, which is the one thing in it that no
ticket decided: `src/players.js` (`validatePlayerInput`, `CAPS`, called by both `POST` and
`PUT` so the two cannot drift) and `public/app/playerForm.js` (`formMode`, `formValues`,
`canDelete`, `resultFor`). The repo's existing one-pure-module-per-concern idiom, and the
reason four of the eight required assertions are now `npm test` rather than a `curl` — see
the route-testing trap below.

Delete was decided as a **hard** delete, against the recommendation on the map — it
cascades to that player's ratings *and* their `player_stats` row, and the typed-slug guard
is the only line of defence in front of it. Needs no accounts, so it does not queue behind
sign-in.

**Correction, 2026-10-12**: this page used to say "nothing restores them", and the map said
"irreversibly". Both were reasoning from `wrangler rollback`, which is no help — but **D1
Time Travel restores rows**, to any minute in the last 7 days on this account's free plan,
automatically and with no setup. See the traps below. Nothing is built on it and no
decision changed; the point is that a build session reading the old wording would believe
the roster is unrecoverable, and it is not.

04 also put a rate limit on `POST /api/admin/login` into that map's spec — the thing that
used to be moderation/01 — so the delete no longer ships behind a login that throttles
nothing.

The schema is decided and **four migration files are written but deliberately not under
`migrations/`** — `players.form` and `players.updated_at` in
[issues/02-migration-shape/](admin-player-crud/issues/02-migration-shape/), a delete-cascade
trigger and a unique index on `players.name` in
[issues/03-form-behaviour-contract/](admin-player-crud/issues/03-form-behaviour-contract/).
In this repo a migration that reaches `main` is a migration that has been applied, so
moving all four is the build session's first act, not this map's.

**None of them can realistically fail on apply, and that took work for one of them.**
`CREATE UNIQUE INDEX players_name_unique` dies outright if two players already share a
name — inside `npm run deploy`, in the same window the ADD COLUMN trap above describes — so
`0006` renames colliding handles to `<name> #<id>` first and creates the index second, in
one file, the way `0004` pairs its ADD COLUMN with its backfill. It is a no-op against
today's roster: verified live 2026-10-11, 38 players, no duplicate exact, case-insensitive
or after slugification.

All four were applied and tested together from `0001` forward against SQLite 3.45.1,
including against a roster seeded with deliberate duplicates. That is **not** the
`d1-migrations` verification checklist, which still has not been run.

Lower: [stats/01](stats/01-history-means-vs-medians.md) (history shows means while the radar
beside it shows medians — same data, visibly different numbers),
[player-profiles/01](player-profiles/01-profile-image-and-form-field.md) (narrowed
2026-10-11 to the image and the rights question under it; its Form column and admin editing
moved onto the map above, and the filename is now stale),
[frontend/02](frontend/02-header-row-overflow.md),
[frontend/03](frontend/03-compare-up-to-four-players.md).

## Traps that cost time to rediscover

- **Wrangler deploys by *name*.** Changing `name` in `wrangler.jsonc` creates a new Worker;
  it does not rename the existing one. Rename in the dashboard first, then update config.
- **The D1 `binding` is not the database name.** `src/worker.js` reads `env.DB` and the npm
  scripts pass `DB`. Renaming the binding breaks both, and the error is unhelpful.
- **`workers_dev` is the public site; `preview_urls` is the review environment.** Since
  Wrangler 4.44 the latter defaults to following the former, so enabling the site quietly
  enables preview hostnames. Both are now set explicitly.
- **Static asset requests do not count** toward the 100k/day free limit — only requests that
  invoke the Worker do, which here means `/api/*` alone. Roughly 33,000 page loads a day.
  Never set `run_worker_first: true` blanket; it converts every asset into a counted request
  and quarters that.
- **Migrations run before the deploy**, so the *old* code briefly runs against the *new*
  schema, and they are forward-only — `wrangler rollback` saves code but not schema. That
  ordering lives in `npm run deploy` rather than in the CI workflow, so **any** deploy can
  change the schema. The rules and the verification steps are in the `d1-migrations` skill,
  which fires on an edit under `migrations/`; there is nothing to remember here.
- **`ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP` succeeds on an empty table and fails on one
  with rows.** SQLite refuses a non-constant default in `ALTER TABLE ADD COLUMN`, but takes
  it when there are no rows to fill. So the obvious timestamp column passes the local
  verification step — which starts from `rm -rf .wrangler/state/v3/d1` — and fails for the
  first time against the 38 rows in production, inside `npm run deploy`, *after*
  `d1 migrations apply` and *before* `wrangler deploy`, leaving every later migration
  unapplied. Use a constant default and a backfill. Found while deciding
  [admin-player-crud/02](admin-player-crud/issues/02-migration-shape.md) and recorded as
  [`docs/adr/0001`](../docs/adr/0001-player-updated-at-defaults-to-empty-string.md), the
  repo's first ADR.
- **`PRAGMA foreign_keys` is per connection, and nothing in this repo sets it.** So
  `ON DELETE CASCADE` is a guarantee that holds on whichever connection happens to have
  enforcement on. Measuring it from `wrangler d1 execute` proves nothing about the Worker's
  connection, which is where routes run, and there is no way to check the Worker's without
  a route that deletes something. Reproduced the failure directly: foreign keys off, delete
  a player with two ratings and a `player_stats` row, and you get **2 orphan ratings and 1
  orphan stat** — which SQLite's rowid reuse then hands to the next player created, as
  their ratings and their cached scores. Wrong numbers on a live profile, no error
  anywhere. admin-player-crud's staged `0005_player_delete_cascade.sql` settles it with an
  `AFTER DELETE` trigger, which fires regardless of the pragma; **do not delete it as
  redundant with the FK clause it duplicates.**
- **`wrangler rollback` is not the only restore, and the obvious reading of "forward-only"
  is wrong about rows.** Migrations are forward-only and rollback restores code, both true —
  but **D1 Time Travel** restores the database itself to any minute in a window,
  automatically, with no setup and no cost: **30 days on a paid plan, 7 on free**, and this
  account is free. `npx wrangler d1 time-travel restore esports-player-atlas --timestamp=<unix>`.
  Caveats that stop it being a backup strategy: it is a *destructive whole-database*
  overwrite, so recovering one deleted row reverts every write since that minute; it needs a
  human with Wrangler authenticated against the account; and it expires silently after a
  week. Nothing is built on it. Found while deciding
  [admin-player-crud/04](admin-player-crud/issues/04-destructive-routes-and-rate-limiting.md),
  where two files in this repo — including this one — were asserting the opposite.
- **Zone-level Cloudflare features do not exist for a `workers.dev` host.** WAF rules,
  rate-limiting rules, firewall rules, cache rules: all of them are configured *on a zone*,
  and `www.esports-player-atlas.workers.dev` is not a zone on this account — `workers.dev`
  is Cloudflare's. There is no dashboard surface to attach one to, at any price, without
  buying a domain and onboarding it. This cost
  [moderation/01](moderation/01-rate-limit-admin-login.md) its recommended solution, which
  had sat in the tracker as the cheap option for months. **The in-Worker equivalent is the
  `ratelimit` binding** — GA since 2025-09-19, no KV, no D1, no Durable Object, no
  provisioning call, `namespace_id` is just an integer you pick, and it adds no storage read
  to the request. Needs Wrangler ≥ 4.36.0. If anything else in this repo ever reaches for a
  dashboard-level control, check this first.
- **Nothing in this repository tests a route.** `npm test` is `node --test`, and both suites
  import modules and assert on pure functions — `test/stats.test.js` on `src/stats.js`,
  `test/frontend.test.js` on six modules out of `public/app/`. Nothing boots `src/worker.js`,
  makes a request, or has an `env`. So a route-level guarantee ships asserted by hand or
  not at all. Do not read a green CI run as covering one.
  **`admin-player-crud/spec.md` works around this rather than waiting for it**: the caps,
  the required fields and the whole Selection-to-form path move into two new pure modules
  (`src/players.js`, `public/app/playerForm.js`) that `node --test` can import. **Four
  things stay manual** and the spec lists them as such — the `409` on a duplicate name, the
  `PUT` that moves `updated_at`, the cascade leaving zero rows in both child tables, and
  the six-`curl` check on the rate limit whose final `200` is the half that matters.
  [admin-player-crud/04/tickets/01](admin-player-crud/issues/04-destructive-routes-and-rate-limiting/tickets/01-no-worker-level-test-harness.md).
- **CI deploys show as *deployed by unknown*** in the Cloudflare dashboard. An API token has
  no user session behind it; that is expected, not a misconfiguration.
- **`seed/demo.sql` must never touch production.** It holds `PRO-DEMO-2026`, published in
  this repo, exchangeable for a professional token valid 30 days on the panel weighted 2:1.
- **Wrangler builds its asset manifest at startup.** Adding a directory under `public/`
  404s until `docker compose restart atlas`.
- **Two tints, two meanings.** `--role` colours the chrome and says who you are; `--lens`
  colours the data and says which panel you are reading. Collapsing them makes an admin see
  amber scores, which reads as a fourth panel that does not exist.
- **`planned` means not built yet, and nothing else.** An item a role may not use is absent
  from the DOM, not dimmed. Only the header renders one now; `footer()` has no branch for
  it, so a footer link that is not built needs that branch back.
- **Nothing on the site may load from another origin, and a test enforces it.** It walks
  `index.html` and all of `public/app/` for an `http(s)` `src`, `href` or `url()` and fails
  on any, because a third-party request falsifies the privacy page. This will bite
  [player-profiles/01](player-profiles/01-profile-image-and-form-field.md) first: the
  obvious way to give 38 Liquipedia players a photo is to hotlink Liquipedia, and that is
  the one thing the test forbids. Images have to be served from here. **The test has a blind
  spot**, found while charting admin-player-crud: it greps *source files*, so an
  `<img src="${player.image_url}">` built from a database value passes it while breaking
  precisely what it protects. A same-origin assertion on rendered output has to ship with
  any image feature. Same reason the
  typefaces live in `public/fonts/` — `OFL.txt` stays with them, the licence requires it.
- **`noindex` lives in three places** — `public/_headers` for static responses, the
  Worker's `json()` for the API, and a `<meta>` in `index.html` — because Workers Assets
  serves `public/` without invoking the Worker, so no one of them covers everything.
- **robots.txt and that header do not reinforce each other.** A crawler obeying
  `Disallow: /` never fetches a page, so it never reads `X-Robots-Tag`. They cover
  different bots. The gap neither closes is a URL learned from a link elsewhere; closing it
  means allowing the crawl so the header can be read. The reasoning is in `robots.txt`.

## Waiting on a human

- The Discord application: redirect URIs and secrets, step 0 of
  [accounts/01](accounts/01-discord-oauth-sign-in.md).
- Branch protection on `main` requiring the `test` check. CI reports a red check on a
  failing pull request but cannot block the merge without it. **Owner-only**: this is a
  personal repository, which has exactly two permission levels, so no collaborator
  permission covers Settings → Rules. Either the owner creates the ruleset, or the
  repository moves to an organisation where an Admin role exists. Verifiable without any
  access: `api.github.com/repos/Nodachi18/esports-player-atlas/branches/main` reports
  `protected`, currently `false`.
- `gh` is not authenticated on this machine (`gh auth status`: "not logged into any GitHub
  hosts"), so pull requests have to be opened in the web UI until `gh auth login` is run.
- Whether to add a payment method and gate this after all, which would reverse the public
  decision recorded in [deployment/spec.md](deployment/spec.md).
- Nothing further on the legal pages. The one missing fact — that this is a private,
  non-commercial project — was supplied on 2026-10-11, and no operator details are held in
  this repo by design.
