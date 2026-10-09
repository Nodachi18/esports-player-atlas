# Esports Player Atlas v3

Full-stack Node.js + SQLite esports scouting/rating platform.

## New in v3
- Statistical aggregate engine: median, mean, SD and 95% CI.
- Professional panel receives 2x weight in the combined profile; configurable in `server.js`.
- Automatic 3-sigma outlier flagging; flagged votes are excluded from public aggregates but retained for admin review.
- Public leaderboard API.
- Rating history API.
- Admin login endpoint with signed session token.
- Admin review of flagged/raw ratings.
- Professional invite generation.
- Player creation.
- No external runtime dependencies.

## Run
Node.js 22.5+:

`ADMIN_KEY="change-this" APP_SECRET="long-random-secret" node server.js`

Open http://127.0.0.1:3000

Demo professional code on a fresh database: `PRO-DEMO-2026`.

## Important statistical note
The combined profile currently uses community median weight 1 and professional median weight 2. This is a product default, not a claim that professionals are objectively twice as informative. The weights should be configurable once real validation data exists.
