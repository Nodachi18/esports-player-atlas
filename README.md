# Esports Player Atlas

A lightweight full-stack esports player rating and scouting prototype. It collects ratings from a community panel and an invite-only professional panel, then publishes aggregate player profiles, radar charts, leaderboards, comparisons, and rating history.

> **Status:** Prototype / early-stage project. Do not expose a public production deployment without completing the security and anti-abuse work listed below.

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
| `public/` | Static frontend, served by Workers Assets (does not invoke the Worker) |
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
npm run db:migrate:remote
npx wrangler secret put ADMIN_KEY
npx wrangler secret put APP_SECRET
npm run deploy
```

The app is served at `https://esports-player-atlas.<your-subdomain>.workers.dev`. A custom domain can be attached in the Cloudflare dashboard. Do **not** run `seed/demo.sql` against the remote database; create players and invites through the admin API instead.

Apply new files in `migrations/` with `npm run db:migrate:remote` before deploying code that depends on them.

## API overview

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/games` | Games with player counts |
| `GET` | `/api/players?q=&game=` | Search/list players |
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
| `POST` | `/api/admin/players` | Create a player (`name`, `game`, optional `slug`, `real_name`, `faction`, `style`, `notes`) |
| `POST` | `/api/admin/pro-invites` | Create an invite (optional `code`, `label`); returns the code once |
| `POST` | `/api/admin/ratings/flag` | Set `flagged` on rating `id`; marks it reviewed so auto-flagging leaves it alone |

Request bodies are JSON and limited to 16 KB.

## Frontend page map

Everything lives on one page (`public/index.html`). The element IDs below are the handles for driving it by hand or from a browser automation tool:

| Area | Elements |
|---|---|
| Search | `#q`, `#game`, results in `#players` (click a row to select a player) |
| Profile header | `#name`, `#badge`, `#meta`; `#view` switches between combined, community and professional |
| Tabs | sections `#profile`, `#compare`, `#history`, `#admin` |
| Radar and scores | `svg#radar`, `#scores` |
| Voting | `#panel`, sliders `#vstrategy`, `#vtactics`, `#vmicro`, `#vmacro`, `#vdecisions`, status in `#msg` |
| Professional unlock | `#procode`; the token is kept in `localStorage.proAtlas` |
| Leaderboard | `#metric`, `#category`, results in `#leaders` |
| History | table in `#hist` |
| Admin | `#adminkey`, totals in `#astats`, ratings in `#adminout`; the token is kept in `sessionStorage.adminAtlas` |
| Connection status | `#conn`, reads "Connected" once the initial API calls succeed |

A manual smoke test against a local run: the page loads with `#conn` on "Connected" and a radar for the demo player, and the console is clean. A community vote puts "Rating submitted." in `#msg` and raises the vote count in `#meta`; a second vote from the same browser returns "Already rated this player", so clear `localStorage.voterAtlas` to vote again. A panel with no ratings yet shows em dashes in `#scores` and draws no polygon — only the radar grid.

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
