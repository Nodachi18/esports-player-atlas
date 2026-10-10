# Handoff — 2026-10-10

## Where things stand

The navigation overhaul shipped and merged. The app is **live and public** at
<https://www.esports-player-atlas.workers.dev> — deliberately, as a prototype with
disposable data, because Cloudflare Access turned out to need a payment method on the
account even for its free tier.

| | |
|---|---|
| Live | `www.esports-player-atlas.workers.dev`, Worker `www`, account `877776dfd5a7c2cc7304cb6456115313` |
| Database | D1 `a5d65c76-5b23-49d1-bf45-49383957a680`, migrations `0001` and `0002` applied |
| Data | 38 players, no accounts, ratings open to anyone |
| `main` | deploys itself — every push runs the tests, then migrations, then `wrangler deploy` |

Ratings are already arriving from whoever has found the site. They are unattributable by
construction — a voter id is a browser token that resets in two clicks — so treat them as
disposable, which is what [accounts/06](accounts/06-legacy-ratings-after-accounts.md) exists
to decide.

Plans worth reading before touching anything: [deployment/spec.md](deployment/spec.md) and
[navigation-overhaul/spec.md](navigation-overhaul/spec.md).

## Do this first

**[accounts/01](accounts/01-discord-oauth-sign-in.md) — Discord sign-in.** The single
change that makes this product defensible. Until ratings are attributable, the published
medians are decoration. Blocked by
[accounts/02](accounts/02-token-kind-discriminator.md), which must come first: the OAuth
`state` value is what creates the token-confusion risk, and adding the discriminator is a
flag-day change for live 30-day pro tokens. Step 0 of sign-in is human-only — registering
the Discord redirect URIs and storing the secrets. The redirect URI used to be a ticket of
its own; there is no integration in the codebase for a wrong URI to break, so it is
provisioning for sign-in rather than a defect.

## Then, by value

**[moderation/01](moderation/01-rate-limit-admin-login.md) — rate limiting.** The admin key
form sits in the footer of every public page and `/api/admin/login` throttles nothing. The
key itself still holds, but the form advertises the endpoint to the open internet.

**[content-pages/01](content-pages/01-help-and-legal-notice.md) — the legal pages.**
Obligations that attach to a publicly reachable service operated from Germany attach now.
`robots.txt` keeps it out of search results; it does not make it private. Needs facts only
the operator has, and probably a lawyer's eye.

**[frontend/01](frontend/01-unrated-players-in-ranked-views.md) — unrated players.** The
leaderboard route drops anyone with no ratings, so most of the 38 are invisible and the site
opens nearly empty. First impression, and it also hides newly created players from the admin
who just made them.

Lower: [stats/01](stats/01-history-means-vs-medians.md) (history shows means while the radar
beside it shows medians — same data, visibly different numbers),
[player-profiles/01](player-profiles/01-profile-image-and-form-field.md),
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
  schema. Additive only; removals take two releases. They are forward-only — there is no
  rollback, which is why `wrangler rollback` saves code but not schema. That ordering lives
  in `npm run deploy`, not in the CI workflow, so **any** deploy can change the schema.
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
  from the DOM, not dimmed.

## Waiting on a human

- The Discord application: redirect URIs and secrets, step 0 of
  [accounts/01](accounts/01-discord-oauth-sign-in.md).
- Branch protection on `main` requiring the `test` check. CI reports a red check on a
  failing pull request but cannot block the merge without it — GitHub settings, not code.
- `gh` is not authenticated on this machine, so pull requests have to be opened in the web
  UI until `gh auth login` is run.
- Whether to add a payment method and gate this after all, which would reverse the public
  decision recorded in [deployment/spec.md](deployment/spec.md).
- [content-pages/01](content-pages/01-help-and-legal-notice.md) needs operator details that
  are not in this repo, and deliberately are not.
