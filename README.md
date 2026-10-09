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
- SQLite persistence with no third-party runtime packages

## Requirements

- Node.js **22.5 or newer** (`node:sqlite` is used)
- Git (to clone or publish the repository)

## Run locally

```bash
git clone https://github.com/YOUR-USERNAME/esports-player-atlas.git
cd esports-player-atlas
cp .env.example .env
```

Edit `.env` and set unique secrets. Then start the app:

```bash
npm start
```

Open <http://127.0.0.1:3000>.

The current server reads environment variables directly; it does **not** automatically load `.env`. For a simple local run, set the variables in your shell instead:

**PowerShell**

```powershell
$env:ADMIN_KEY="use-a-long-unique-admin-key"
$env:APP_SECRET="use-a-different-random-secret-at-least-32-characters"
$env:DEMO_PRO_CODE="change-this-before-first-run"
npm start
```

**macOS / Linux**

```bash
export ADMIN_KEY='use-a-long-unique-admin-key'
export APP_SECRET='use-a-different-random-secret-at-least-32-characters'
export DEMO_PRO_CODE='change-this-before-first-run'
npm start
```

The database is created at `atlas.db` by default. Set `DB_FILE` to choose another path. The demo player and demo invite are seeded only when the database has no players. Set `DEMO_PRO_CODE` **before the first launch**; do not use the example invite code on a public deployment.

## API overview

The API routes are implemented in `server.js`. Common routes include:

| Method | Route | Purpose |
|---|---|---|
| `GET` | `/api/health` | Health check |
| `GET` | `/api/players` | Search/list players |
| `GET` | `/api/players/:slug` | Player profile and aggregates |
| `GET` | `/api/leaderboard` | Aggregate rankings |
| `GET` | `/api/players-history?player=:slug` | Rating history |
| `GET` | `/api/compare?players=slug1,slug2` | Compare players |
| `POST` | `/api/ratings` | Submit a rating |
| `POST` | `/api/pro/verify` | Exchange professional invite for a session token |
| `POST` | `/api/admin/login` | Exchange admin key for an admin token |

Admin routes require the admin authentication mechanism. Review `server.js` for exact request bodies and route details before building integrations.

## Publish to GitHub

1. Create an **empty repository** on GitHub named `esports-player-atlas`. Do not initialize it with a README or license because those already exist here.
2. From this folder, run:

   ```bash
   git init
   git add .
   git commit -m "Initial commit: Esports Player Atlas v3"
   git branch -M main
   git remote add origin https://github.com/YOUR-USERNAME/esports-player-atlas.git
   git push -u origin main
   ```

3. Replace `YOUR-USERNAME` with your GitHub username. GitHub will prompt you to authenticate if needed.

Never commit `.env`, API secrets, database files, private voter data, or production data. `.gitignore` excludes common local secret and SQLite files.

## GitHub Actions

A basic workflow runs a syntax check when code is pushed or a pull request is opened. It does not yet run end-to-end or security tests.

## Statistical caveats

The current combined score gives the professional panel more weight than the community panel. This is a configurable product choice, not an empirically established fact. Outlier detection can also misclassify legitimate ratings, particularly with small samples. Treat flags as review signals, not proof of manipulation.

## Before public production use

- Replace SQLite with PostgreSQL if deploying multiple application instances
- Add robust account-based voter identity and anti-bot protection; browser IDs are easy to reset
- Verify professional identities and provide invite revocation
- Add automated tests for vote deduplication, aggregation, authorization, and edge cases
- Add HTTPS, deployment secrets, database backups, migrations, monitoring, and request limits
- Review privacy, data-retention, moderation, and appeal policies
- Revisit the outlier methodology and minimum sample-size rules with real data

## License

MIT. See [LICENSE](LICENSE).
