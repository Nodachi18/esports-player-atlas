# Handoff — 2026-10-11

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

One plan *is* current: [admin-player-crud/map.md](admin-player-crud/map.md), charted
2026-10-11 and still open. It is a live map with a frontier, not a record of a finished
argument.

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

**[moderation/01](moderation/01-rate-limit-admin-login.md) — rate limiting.** The admin key
form sits in the footer of every public page and `/api/admin/login` throttles nothing. The
key itself still holds, but the form advertises the endpoint to the open internet. **Its
stakes are about to rise**: admin-player-crud adds an irreversible cascading delete behind
that login, which turns a guessed key from "can flag ratings and mint invites" into "can
destroy the roster". Whether the delete waits for this is
[admin-player-crud/04](admin-player-crud/issues/04-destructive-routes-and-rate-limiting.md),
an open ticket on that map rather than a decision made here.

**[frontend/01](frontend/01-unrated-players-in-ranked-views.md) — unrated players.** The
leaderboard route drops anyone with no ratings, and only 3 of the 38 have any, so the public
site currently opens showing **3 players**. Worse than "nearly empty" as previously written,
and arguably worth doing before the two above it: it is the first thing every visitor sees,
and it also hides newly created players from the admin who just made them.

**[admin-player-crud](admin-player-crud/map.md) — the admin can create players and nothing
else.** `POST /api/admin/players` creates; there is no update and no delete anywhere in the
API, so a typo in a name is permanent and the Admin page renders only stats and a ratings
table. Charted as a wayfinder map on 2026-10-11, destination a handoff spec plus one
migration. **Three tickets are on the frontier and takeable now**:
[01 layout](admin-player-crud/issues/01-admin-page-layout.md) (prototype),
[02 migration shape](admin-player-crud/issues/02-migration-shape.md), and
[04](admin-player-crud/issues/04-destructive-routes-and-rate-limiting.md) above. Delete was
decided as a **hard** delete, against the recommendation on the map — it cascades to that
player's ratings and nothing restores them, so the typed-slug guard is the only line of
defence there is. Needs no accounts, so it does not queue behind sign-in.

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
