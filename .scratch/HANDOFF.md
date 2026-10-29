# Handoff — 2026-10-30

## Where things stand

The navigation overhaul shipped, the admin player form shipped on 2026-10-12, and `main`
tests and deploys itself. The app is **live and public** at
<https://www.esports-player-atlas.workers.dev> — deliberately, as a prototype with
disposable data, because Cloudflare Access turned out to need a payment method on the
account even for its free tier.

| | |
|---|---|
| Live | `www.esports-player-atlas.workers.dev`, Worker `www`, account `877776dfd5a7c2cc7304cb6456115313` |
| Database | D1 `a5d65c76-5b23-49d1-bf45-49383957a680`, migrations `0001`–`0006` applied |
| Data | 38 players, 5 ratings on 5 of them, no accounts, rating open to anyone |
| `main` | deploys itself — every push runs the tests, then migrations, then `wrangler deploy` |
| Unmerged | **`discord-sign-in`** — the whole accounts set, built and green, not deployed |

**Read that last row before anything else.** Everything below about live behaviour describes
`main`. The branch changes most of it, and the two are deliberately out of step until one
merge: rating becomes session-gated, the pre-account ratings are deleted by a migration, and
four published pages are rewritten. Nothing on the live site has moved yet.

Ratings keep arriving from whoever has found the site, at about one a week: **5 community
ratings, 0 professional, one each on `barracks`, `boxer`, `jaehoon`, `light` and `free`**,
re-counted against the live API on 2026-10-29. They are unattributable by construction — a
voter id is a browser token that resets in two clicks.
[accounts/06](accounts/06-legacy-ratings-after-accounts.md) is **closed: discard**, and
`migrations/0007` on the branch deletes them along with their `player_stats`. **Count again
before merging** — the decision is about a number and the number keeps moving.

Plans worth reading before touching anything: [deployment/spec.md](deployment/spec.md) and
[navigation-overhaul/spec.md](navigation-overhaul/spec.md). **Both record what was decided
then, not what runs now**, and the whole `navigation-overhaul/` directory — spec, map,
closed issues, prototype — is deliberately left that way rather than kept current. Check a
claim against the code before building on it; several pages it calls `planned` are built,
and one footer link it never mentions exists.

`admin-player-crud/` used to be the exception — the one plan describing what would be
built rather than what was decided once. **It was built and merged on 2026-10-12** (#12),
so it is no longer an exception: its spec, map and issues are now history like everything
else here. Read
[admin-player-crud/spec.md](admin-player-crud/spec.md) for the argument behind a shape in
the code, not as a description of the code.

**One directory is the exception again**, for the first time since then:
[accounts/01-discord-oauth-sign-in/](accounts/01-discord-oauth-sign-in/) describes work that
is built but **not merged**, and its parent
[accounts/01](accounts/01-discord-oauth-sign-in.md) carries the decisions behind it — why
rating is gated rather than prompted, why the legacy ratings go, why the avatar is stored
and never rendered, and why the rate limiter sits where it does. Read it as current until
`discord-sign-in` lands; after that it is history like the rest.

## Do this first

**Merge [`discord-sign-in`](accounts/01-discord-oauth-sign-in.md), then walk the deployed
site.** The eight tickets under
[accounts/01-discord-oauth-sign-in/](accounts/01-discord-oauth-sign-in/) are built, committed
and green — 155 tests, up from 110. Sign-in was walked end to end **locally** on 2026-10-30
against the real Discord application: a real account, landing back on the page the signed
state carried, one `accounts` row, two ratings carrying its `account_id`.

What is left is [08](accounts/01-discord-oauth-sign-in/08-turn-accounts-on.md): the same walk
on the deployed origin. It is not ceremony. The deployed `DISCORD_REDIRECT_URI` is a
write-only Worker secret, so **no check in this repository can read it back** — a value
stored with the localhost URI, or without the `www.` prefix, passes everything up to the
first real sign-in on the live site and then fails as `invalid_redirect_uri`.

**The merge deletes live data.** `migrations/0007` flushes `ratings` and `player_stats`, and
migrations apply before `wrangler deploy`. That was decided against 3 rows on 2026-10-13 and
re-counted at 5 on 2026-10-29. **Count again before merging** — the site is public and the
argument is about a number.

**Five tickets unblock the moment it lands:**
[accounts/04](accounts/04-promote-account-to-professional.md) promotion →
[05](accounts/05-retire-pro-invite-surface.md) retiring the invite surface,
[07](accounts/07-admin-accounts-replace-the-key.md) replacing the shared admin key with a
role, [moderation/02](moderation/02-session-revocation.md) revocable sessions, and
[03](moderation/03-ban-accounts-and-moderate-ratings.md) banning.

**Two things the set shipped knowingly incomplete**, both written down where they will be
found rather than left to be discovered:

- **The terms page overstates on blocking.** Rules 8 and 9 say a blocked account cannot sign
  in and its ratings leave the published scores. Nothing can block an account;
  [moderation/03](moderation/03-ban-accounts-and-moderate-ratings.md) owns it, and rule 9
  constrains it to *exclusion from the aggregates*, not deletion. The rule was published
  ahead of its code on purpose. A successor tripwire in `test/frontend.test.js` fires when
  blocking lands — but it greps for **column names**, so moderation/03 can slip past it by
  choosing different ones.
- **A 30-day session with no revocation.** "Cannot sign in" is therefore true only at the
  next sign-in. [moderation/02](moderation/02-session-revocation.md) closes it; a
  blocked-account check on the write routes closes it sooner, without touching the cookie.

[accounts/02](accounts/02-token-kind-discriminator.md) — the `kind` discriminator — is
**still not implemented**. Sign-in checks `kind` at its own call sites instead, which is why
it could ship first. Its job remains: move the check inside `verifyToken` so a new call site
cannot forget. Decided while breaking down 01: hard break, no grandfathering.

## Then, by value

**~~moderation/01 — rate limiting~~ — resolved 2026-10-12 and now shipped.** The answer
to *does the delete wait for it* turned out to be that there was nothing to wait for: the
Workers `ratelimit` binding went GA in 2025 and needs no KV, no D1 and no provisioning, so
the limit was fifteen lines and went out in the same commit as the delete.
`POST /api/admin/login` is live at **5 failed attempts per 60s per `CF-Connecting-IP`,
then 429**, the binding is `LOGIN_LIMIT` in `wrangler.jsonc`, and `.limit()` sits in the
failure branch after the key check so a correct login never spends budget.
[moderation/01](moderation/01-rate-limit-admin-login.md) is closed and its body rewritten,
because both options it recommended were wrong — see the traps below. Its one surviving
instruction, *apply it to `/api/auth/*`*, is now a line item on
[accounts/01](accounts/01-discord-oauth-sign-in.md).

What it did **not** cover, deliberately: `POST /api/pro/verify` is still unthrottled and is
the weaker of the two guessable endpoints, because `src/worker.js:157` takes an
admin-supplied invite code at ≥ 8 characters. Left alone only because
[accounts/05](accounts/05-retire-pro-invite-surface.md) deletes that surface. If sign-in
slips, this is worth revisiting — and it is now a ten-line copy of something that already
works in `src/worker.js`, not a design question.

**[frontend/01](frontend/01-unrated-players-in-ranked-views.md) — unrated players, and
arguably worth doing before sign-in.** The leaderboard route drops anyone with
no ratings, and only 3 of the 38 have any, so the public site still opens showing **3
players** — re-checked live 2026-10-13. It was already the first thing every visitor sees.
What changed on 2026-10-12 is that an admin can now create a player through the form, and
the player they just created does not appear on the site at all until someone rates them.
Cheap, visible, and it blocks nothing.

**~~admin-player-crud~~ — shipped 2026-10-12 in #12, and off this list.** The admin could
create a player and nothing else; now `POST`, `PUT` and `DELETE /api/admin/players/:slug`
all exist, the Admin page carries a form with a roster rail beside it, and `players` has a
`form` column and an `updated_at`. Migrations `0003`–`0006` are under `migrations/` and
applied — the `0005` delete-cascade trigger and the `0006` unique index among them.
The full `d1-migrations` checklist **was** run for this release, including the previous
release against the new schema. Verified against the live API on 2026-10-13: 38 players,
every row carrying `form` and a flat `ratings` count, `PUT` and `DELETE` answering `403`
without the admin key.

Read [admin-player-crud/spec.md](admin-player-crud/spec.md) only for *why* something has
the shape it has. The code is the truth now, and the commit message on `9ee0da8` is the
honest account of what was verified by hand, since nothing in CI covers a route.

**Three tickets survived it**, none blocking anything:

- [03/tickets/01](admin-player-crud/issues/03-form-behaviour-contract/tickets/01-per-player-rating-rows-have-no-endpoint.md)
  — the per-player disclosure under the form shows a **count and a link** to the global
  table, because no endpoint serves one player's rating *rows*. Decide route versus filter
  when someone wants them.
- [01/tickets/04](admin-player-crud/issues/01-admin-page-layout/tickets/04-where-the-global-ratings-table-goes.md)
  — where the global ratings table lives long term, and whether `Load ratings` stays a
  button. Properly owned by
  [moderation/03](moderation/03-ban-accounts-and-moderate-ratings.md).
- [04/tickets/01](admin-player-crud/issues/04-destructive-routes-and-rate-limiting/tickets/01-no-worker-level-test-harness.md)
  — no route-level harness. Still the gap behind four hand-checked guarantees; see the
  route-testing trap below.

Delete shipped as a **hard** delete, against the recommendation on the map — it cascades to
that player's ratings *and* their `player_stats` row, and the typed-slug guard in a
`showModal()` is the only line of defence in front of it. **D1 Time Travel is what restores
a player deleted by mistake**, within 7 days on this free plan, and it is a destructive
whole-database rewind rather than a row-level undo; see the traps below.

Lower: [stats/01](stats/01-history-means-vs-medians.md) (history shows means while the radar
beside it shows medians — same data, visibly different numbers),
[player-profiles/01](player-profiles/01-profile-image-and-form-field.md) (narrowed
2026-10-11 to the image and the rights question under it — its Form column and admin
editing shipped with admin-player-crud, so only the image is left and the filename is now
stale),
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
  anywhere. `migrations/0005_player_delete_cascade.sql`, applied 2026-10-12, settles it
  with an `AFTER DELETE` trigger, which fires regardless of the pragma; **do not delete it
  as redundant with the FK clause it duplicates.** The delete route was checked by hand
  against a real player and left zero rows in both child tables.
- **`wrangler rollback` is not the only restore, and the obvious reading of "forward-only"
  is wrong about rows.** Migrations are forward-only and rollback restores code, both true —
  but **D1 Time Travel** restores the database itself to any minute in a window,
  automatically, with no setup and no cost: **30 days on a paid plan, 7 on free**, and this
  account is free. `npx wrangler d1 time-travel restore esports-player-atlas --timestamp=<unix>`.
  Caveats that stop it being a backup strategy: it is a *destructive whole-database*
  overwrite, so recovering one deleted row reverts every write since that minute; it needs a
  human with Wrangler authenticated against the account; and it expires silently after a
  week. Nothing is built on it — but since the delete route shipped on 2026-10-12 it is
  the only thing standing behind a mistyped confirmation. Found while deciding
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
- **Nothing in this repository tests a route.** `npm test` is `node --test`, and all three
  suites import modules and assert on pure functions — `test/stats.test.js` on
  `src/stats.js`, `test/players.test.js` on `src/players.js`, `test/frontend.test.js` on
  six modules out of `public/app/`. Nothing boots `src/worker.js`,
  makes a request, or has an `env`. So a route-level guarantee ships asserted by hand or
  not at all. Do not read a green CI run as covering one.
  **admin-player-crud worked around this rather than waiting for it**, and those seams
  now exist: `src/players.js` (`validatePlayerInput`, `CAPS`, imported by both `POST` and
  `PUT` so they cannot drift) and `public/app/playerForm.js` (`formMode`, `formValues`,
  `canDelete`, `deletePrompt`, `resultFor`), covered by `test/players.test.js` and the
  additions to `test/frontend.test.js`. **Four guarantees are hand-checked and nothing
  re-checks them** — the `409` on a duplicate handle, the `PUT` that moves `updated_at`,
  the cascade leaving zero rows in both child tables, and the six-`curl` limiter check
  whose final `200` is the half that matters. They passed once, on 2026-10-12, against a
  running Worker; a change touching any of them has to repeat that by hand. Recorded in
  `9ee0da8` and in
  [admin-player-crud/04/tickets/01](admin-player-crud/issues/04-destructive-routes-and-rate-limiting/tickets/01-no-worker-level-test-harness.md).
- **The `ratelimit` binding works under `wrangler dev`**, and `wrangler dev` supplies a
  `CF-Connecting-IP`. admin-player-crud's spec recorded both as undocumented and assumed
  the limiter could only be exercised against a deployed Worker; it can be exercised
  locally. **But it keys on that header, and a request without one is not limited at all** —
  which is correct on Cloudflare, where the header is injected at the edge, and a trap for
  anyone testing through something that strips it.
- **D1's `meta.changes` counts matched rows, not differing rows.** So `PUT` on a player
  whose fields are unchanged still reports `1` and returns `200`; the `404` branch, which
  keys on `changes === 0`, cannot misfire on a no-op save. Three identical `PUT`s inside
  one second all return `200`. Worth knowing before anyone uses `changes` to detect "did
  anything actually change", because it does not answer that question.
- **A Discord client secret is 32 mixed-case characters; the public key is 64 lowercase hex.**
  They sit on different pages of the developer portal and one is very easy to paste where the
  other belongs. The wrong one produces `401 invalid_client` on the token exchange, which the
  callback turns into the same `auth=failed` redirect as a cancelled sign-in — so it looks
  like the user declined. Cost a browser round trip to diagnose on 2026-10-30. **A shape check
  is instant, and the pair can be validated outright with no browser and no consent screen**
  via the client-credentials grant; both are written up in
  [accounts/01-discord-oauth-sign-in/01](accounts/01-discord-oauth-sign-in/01-provision-the-discord-application.md).
  The secret is shown once, so the recovery is Reset Secret, not a hunt for the old one.
- **`wrangler dev` reads `.dev.vars` once, at startup.** Correcting a secret while it runs
  changes nothing, so a fixed value goes on failing and sends you looking somewhere else.
  Restart after any edit.
- **`wrangler dev` also serves a local explorer** at `/cdn-cgi/local/explorer` on the dev
  port — a UI over local D1, KV and traces. The D1 file itself is plain SQLite under
  `.wrangler/state/v3/d1/miniflare-D1DatabaseObject/<hash>.sqlite` and opens in any client,
  but the name is derived from the binding, so do not hard-code it, and treat it read-only
  while the dev server holds it.
- **CI deploys show as *deployed by unknown*** in the Cloudflare dashboard. An API token has
  no user session behind it; that is expected, not a misconfiguration.
- **`seed/demo.sql` must never touch production.** It holds `PRO-DEMO-2026`, published in
  this repo, exchangeable for a professional token valid 30 days on the panel weighted 2:1.
- **Wrangler builds its asset manifest at startup.** Adding a directory under `public/`
  404s until `docker compose restart atlas`.
- **Two tints, two meanings — and since 2026-10-12 a third token that is neither.**
  `--role` colours the chrome and says who you are; `--lens` colours the data and says
  which panel you are reading. Collapsing them makes an admin see amber scores, which
  reads as a fourth panel that does not exist. `--danger` is what cannot be undone: the
  delete button, the guard, a failed result. All three are commented in `:root`, and
  site-wide totals deliberately take `--ink` because they belong to no panel. `.err` and
  `.result.ok` are still hardcoded near-misses of the red and the green.
- **`planned` means not built yet, and nothing else.** An item a role may not use is absent
  from the DOM, not dimmed. Only the header renders one now; `footer()` has no branch for
  it, so a footer link that is not built needs that branch back. It also has to be *taken
  back* when the thing is built: the public profile went on rendering Form as `planned`
  with "No column for this yet" after `0003` added the column, and the build had to notice
  that by hand.
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

- ~~The Discord application: redirect URIs and secrets.~~ **Done 2026-10-29.** What replaces
  it: merging `discord-sign-in` and walking sign-in on the deployed origin —
  [08](accounts/01-discord-oauth-sign-in/08-turn-accounts-on.md). A consent screen needs a
  human, and the deployed redirect URI cannot be read back by anything.
- Branch protection on `main` requiring the `test` check. CI reports a red check on a
  failing pull request but cannot block the merge without it. **Owner-only**: this is a
  personal repository, which has exactly two permission levels, so no collaborator
  permission covers Settings → Rules. Either the owner creates the ruleset, or the
  repository moves to an organisation where an Admin role exists. Verifiable without any
  access: `api.github.com/repos/Nodachi18/esports-player-atlas/branches/main` reports
  `protected`, still `false` on 2026-10-13.
- `gh` is not authenticated on this machine (`gh auth status`: "not logged into any GitHub
  hosts"), so pull requests have to be opened in the web UI until `gh auth login` is run.
- Whether to add a payment method and gate this after all, which would reverse the public
  decision recorded in [deployment/spec.md](deployment/spec.md).
- Nothing further on the legal pages. The one missing fact — that this is a private,
  non-commercial project — was supplied on 2026-10-11, and no operator details are held in
  this repo by design.
