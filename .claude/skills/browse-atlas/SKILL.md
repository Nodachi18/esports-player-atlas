---
name: browse-atlas
description: Open and drive the local Esports Player Atlas app in the user's Chrome (via Claude in Chrome) to check UI changes, click through flows, read console errors or take screenshots. Use when asked to browse, open, click through, screenshot or visually verify the app.
---

# Browse the local Atlas app

Uses the user's Chrome through the **Claude in Chrome** extension. Invoke the `claude-in-chrome` skill first and follow its instructions before calling any `mcp__claude-in-chrome__*` tool. If the extension isn't connected, ask the user to open Chrome with the extension enabled. Don't fall back to another browser tool.

## 1. Make sure the app is running

```bash
curl -sf http://localhost:8787/api/health
```

If that fails, start it from the project root and poll the health endpoint until it responds (the first build can take a minute):

```bash
docker compose up --build -d
```

Without Docker: `npm run db:migrate:local && npm run db:seed:local && npm run dev` (needs `.dev.vars`, see README).

The app is at **http://localhost:8787**. Open it in a new tab, not the user's current one.

## 2. Local test data

| What | Value |
|---|---|
| Demo player | `JYJ` (slug `jyj`), StarCraft II |
| Pro invite code | `PRO-DEMO-2026` |
| Admin key (Docker default) | `local-admin-key-change-me`, unless `ADMIN_KEY` was overridden. With `npm run dev` it's whatever `.dev.vars` sets |

These only work locally. Never type them into a deployed `*.workers.dev` site.

## 3. Page map (`public/index.html`)

Everything is on a single page. Element IDs:

- **Search:** `#q` (text), `#game` (select), then the Search button. Results show in `#players`; click a row to select the player.
- **Profile header:** `#name`, `#badge`, `#meta`. `#view` switches the radar between combined, community and professional.
- **Tabs:** buttons for Profile, Leaderboard / Compare, History and Admin. The sections are `#profile`, `#compare`, `#history` and `#admin`.
- **Radar and scores:** `svg#radar`, `#scores`.
- **Voting:** `#panel` (community or professional), range sliders `#vstrategy`, `#vtactics`, `#vmicro`, `#vmacro`, `#vdecisions`, then "Submit rating". Status messages appear in `#msg`.
- **Pro unlock:** enter the code in `#procode`, then click Unlock. The token is stored in `localStorage.proAtlas`.
- **Leaderboard:** `#metric`, `#category`, Refresh, results in `#leaders`.
- **History:** a table in `#hist`.
- **Admin:**
  1. Enter the key in `#adminkey`.
  2. Click "Login / refresh". The token is stored in `sessionStorage.adminAtlas` and the key field is cleared.
  3. Totals show in `#astats`. "Load ratings" fills `#adminout`.
- **Connection status:** `#conn` shows "Connected" when the initial API calls succeeded.

## 4. Typical checks

- **Smoke test:** the page loads, `#conn` says Connected, and JYJ shows a radar. The console has no errors.
- **Community vote:** move the sliders and submit. `#msg` says "Rating submitted.", and the vote count in `#meta` goes up.
  - A second vote from the same browser returns "Already rated this player". To vote again, clear `localStorage.voterAtlas`.
- **Professional vote:** unlock with the invite code, set `#panel` to professional and submit.
- **Admin:** log in, check `#astats`, then load the ratings table.

Read the console for errors after each interaction. To test the API behind a UI result directly, use `curl` against `http://localhost:8787/api/...` (routes are listed in the README).

## 5. Resetting state

`docker compose down -v && docker compose up -d` wipes the local database and re-seeds the demo data. Ask the user before doing this, because it deletes any test data they created.
