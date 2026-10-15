# Esports Player Atlas

A lightweight full-stack esports player rating and scouting prototype. It collects ratings from a community panel and an invite-only professional panel, then publishes aggregate player profiles, radar charts, leaderboards, comparisons, and rating history.

> **Status:** Prototype / early-stage project.
>
> A public prototype runs at <https://www.esports-player-atlas.workers.dev>. It is **not** a
> production deployment: there are no accounts yet, a voter identity is a browser token that
> resets in two clicks, and the ratings there are therefore **disposable** rather than
> authoritative. It is excluded from search engines for that reason.
>
> Do not treat it as production, and do not complete a real production deployment without
> the security and anti-abuse work listed below.

## Features

- Player profiles and search
- Five configurable-in-code rating dimensions: strategy, tactics, micro, macro, and decisions
- Separate community and professional panels
- Median-based panel scores and a weighted combined score
- Mean, standard deviation, confidence intervals, and outlier flags in the backend
- Leaderboard, player comparison, and rating history APIs
- Admin login and protected admin endpoints
- Professional invite-code flow
- Runs on Cloudflare Workers + D1 (SQLite); fits the free plan at hobby-level traffic

## Architecture

| Path | Purpose |
|---|---|
| `public/index.html` | Shell, served by Workers Assets (does not invoke the Worker) |
| `public/app/` | Frontend ES modules; the pure ones are unit-tested |
| `public/icon.svg`, `favicon.ico`, `og.png` … | Favicons, the web manifest and the link-preview image, all generated |
| `tools/make-brand-assets.py` | Regenerates those; run it when the mark or the preview wording changes |
| `src/worker.js` | API routes (`/api/*`), WebCrypto tokens, D1 queries |
| `src/stats.js` | Pure aggregation and outlier logic (unit-tested) |
| `migrations/` | D1 schema migrations |
| `seed/demo.sql` | Demo player and invite code, **local only** |
| `wrangler.jsonc` | Worker, assets, and D1 binding configuration |

Aggregates are precomputed into the `player_stats` table whenever a rating is added or an admin flags/unflags one. Public reads (profiles, leaderboard, compare) only read that table, which keeps D1 "rows read" usage — the main free-tier limit — low.

## Requirements

- Node.js **22 or newer** (for Wrangler)
- A free Cloudflare account (for deployment only)

## Run locally

```bash
git clone https://github.com/YOUR-USERNAME/esports-player-atlas.git
cd esports-player-atlas
npm install
cp .dev.vars.example .dev.vars    # then edit the secrets
npm run db:migrate:local
npm run db:seed:local             # optional demo player + invite code PRO-DEMO-2026
npm run dev
```

Open <http://localhost:8787>. The local D1 database lives in `.wrangler/` (git-ignored).

`ADMIN_KEY` must be at least 16 characters and `APP_SECRET` at least 32. If either is missing, admin and professional routes return `503` instead of falling back to a default.

## Run with Docker

No local Node.js needed:

```bash
docker compose up --build
```

Open <http://localhost:8787>. On start the container applies migrations and seeds the demo player and invite code `PRO-DEMO-2026` (set `SEED_DEMO=false` to skip). The admin key defaults to `local-admin-key-change-me`; override `ADMIN_KEY` / `APP_SECRET` via your shell or a `.env` file next to `docker-compose.yml`.

`src/`, `public/`, `migrations/` and `seed/` are mounted, so edits hot-reload. The database persists in the `atlas-data` volume; `docker compose down -v` resets it. This setup is for local development only.

## Deploy to Cloudflare

```bash
npx wrangler login
npx wrangler d1 create esports-player-atlas
```

Copy the printed `database_id` into `wrangler.jsonc`, then:

```bash
npx wrangler secret put ADMIN_KEY
npx wrangler secret put APP_SECRET
npm run deploy
```

The app is served at `https://esports-player-atlas.<your-subdomain>.workers.dev`. A custom domain can be attached in the Cloudflare dashboard. Do **not** run `seed/demo.sql` against the remote database; create players and invites through the admin API instead.

`npm run deploy` applies any pending migrations and then uploads the Worker, in that order — new code against an old schema fails immediately, so the ordering is part of the command rather than something to remember. It follows that a deploy can change the database schema, and that D1 migrations are forward-only: there is no undo. `npm run db:migrate:remote` still runs the migrations on their own, and `npm run db:migrate:local` runs them against the local database.

Pushes to `main` deploy through [`.github/workflows/ci.yml`](.github/workflows/ci.yml), which runs the same command once the tests pass.

## API overview

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/games` | Games with player counts |
| `GET` | `/api/players?q=&game=` | Search/list players, each with a `ratings` count (flagged included) |
| `GET` | `/api/players/:slug` | Player profile and aggregates |
| `GET` | `/api/leaderboard?metric=&category=` | Aggregate rankings (`metric`: combined, community, professional) |
| `GET` | `/api/history?player=:slug` | Daily rating averages |
| `GET` | `/api/compare?players=slug1,slug2` | Compare up to four players |
| `POST` | `/api/ratings` | Submit a rating |
| `POST` | `/api/pro/verify` | Exchange professional invite for a session token |
| `POST` | `/api/admin/login` | Exchange admin key for an admin token (8 h) |

Admin routes require `Authorization: Bearer <admin token>`:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/admin/stats` | Totals and daily counts |
| `GET` | `/api/admin/ratings` | Latest 1000 ratings |
| `POST` | `/api/admin/players` | Create a player (`name` and `game` required; optional `real_name`, `faction`, `style`, `form`, `notes`). The slug is derived from `name` by the server; one sent in the body is ignored |
| `PUT` | `/api/admin/players/:slug` | Replace a player's editable fields. Full replace, not a patch: an absent field is written as `''`. Always moves `updated_at` |
| `DELETE` | `/api/admin/players/:slug` | Delete a player, their ratings and their cached aggregates. No body. Returns `{slug, ratings}`, the number destroyed |
| `POST` | `/api/admin/pro-invites` | Create an invite (optional `code`, `label`); returns the code once |
| `POST` | `/api/admin/ratings/flag` | Set `flagged` on rating `id`; marks it reviewed so auto-flagging leaves it alone |

Request bodies are JSON and limited to 16 KB.

`POST` and `PUT` on a player reject rather than truncate: over-length is `400` naming the
field and its limit, a handle already taken (case-insensitively) is `409`, and an unknown
slug is `404`. The caps are `name` 80, `real_name` 120, `game` 80, `faction` 80, and 250
each for `style`, `form` and `notes`; they live in `src/players.js` and in the form's
`maxlength`, because SQLite `TEXT` is unbounded.

`POST /api/admin/login` is rate limited to 5 **failed** attempts per 60 seconds per
`CF-Connecting-IP`, answering `429`. A correct key never spends budget, and a request with
no such header is not limited at all.

## Frontend

`public/index.html` is an empty shell; everything is rendered in the browser from the API by
ES modules under `public/app/`.

| Module | Holds |
|---|---|
| `scores.js` | Per-category scores for a panel, and radar geometry |
| `ranking.js` | Merging the leaderboard with the full player list, filtering, paging |
| `nav.js` | Which navigation items a session sees, and in which of three states |
| `state.js` | The one selection object, and its mapping to and from the query string |
| `api.js` | The only module that calls `/api`; failures arrive as `ApiError` with a status |
| `views.js` | HTML builders — pure string functions, no DOM access |
| `main.js` | Wiring: owns the state, listens for events, paints the document |

The first four are pure and unit-tested in `test/frontend.test.js`; `npm test` covers them
alongside the aggregation logic.

Pages are `Players`, `Leaderboard`, `Rate`, `Account` and `Admin`, selected by `?page=`.
A player is `?player=<slug>`, a search `?q=`, the radar panel `?lens=`, and the leaderboard's
own ranking `?metric=` and `?category=`. Client-side routing with real paths is deferred;
`state.js` is the only module that would change when it lands.

Two conventions worth knowing before editing:

- **Role tint versus lens tint.** `--role` colours the chrome and says who you are; `--lens`
  colours the data and says which panel you are reading. They are never the same job.
- **`planned` means not built yet**, and nothing else. An item a role may not use is absent
  from the DOM rather than dimmed.
- **The brandmark is one pentagon, drawn three ways.** The header builds it from
  `polygonPoints()` in `scores.js`, and the favicons and `og.png` are generated from the
  same geometry by `tools/make-brand-assets.py` (Pillow, fonttools and brotli; neither a
  runtime nor a build dependency). Edit the script and re-run it rather than touching an
  image, and commit what it writes.

The Open Graph tags in `index.html` describe the site rather than the page: routing is
client-side, so a scraper is served the same shell whatever the URL says. Per-player
previews need the Worker to render the tags, which it does not do. Previews also depend on
`public/robots.txt`, which disallows everything except a named list of unfurl bots — search
engines stay out, chat link cards work.

A manual smoke test: the page loads with a ranked strip and a radar, and the console is
clean. Rating a player confirms, and a second attempt reports that you have already rated
them. Switching the radar to a panel with no ratings shows em dashes and draws no polygon.
Entering the admin key in the footer reveals the Admin item. `localStorage.voterAtlas`
carries the browser-local voter id; clear it to rate again.

## Checks

```bash
npm test       # unit tests for aggregation and outlier logic
npm run check  # syntax check + Wrangler dry-run build
```

Never commit `.dev.vars`, API secrets, database files, private voter data, or production data. `.gitignore` excludes them.

## Statistical caveats

The current combined score gives the professional panel more weight than the community panel. This is a configurable product choice, not an empirically established fact. Outlier detection can also misclassify legitimate ratings, particularly with small samples. Treat flags as review signals, not proof of manipulation.

## Before public production use

- Add robust account-based voter identity and anti-bot protection; browser IDs are easy to reset
- Verify professional identities
- Add rate limiting (e.g. Cloudflare WAF rate-limiting rules) and D1 backups/Time Travel review
- Add invite revocation and end-to-end tests against a local D1
- Review privacy, data-retention, moderation, and appeal policies
- Revisit the outlier methodology and minimum sample-size rules with real data

## License

MIT. See [LICENSE](LICENSE).
