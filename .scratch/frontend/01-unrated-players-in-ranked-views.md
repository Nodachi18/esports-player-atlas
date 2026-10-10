# Decide where unrated players belong

Status: needs-triage
Source: navigation-overhaul spec §15, decision 16

## Problem

`GET /api/leaderboard` filters out every player whose value is null — that is, everyone with
no ratings ([src/worker.js:76](../../src/worker.js#L76)). Since Players is a view over that
ranking, an unrated player is invisible across the whole UI.

This bites hardest on exactly the players that matter most to the flow: an admin creates a
player, and it cannot be found in order to rate it. Admin-created, unclaimed professional
players — the thing the claim flow exists to resolve — land in the same hole.

Seeding proved it: straight after adding 38 players, the leaderboard returned 2 of 40.

**It is now the live site's first impression.** Production has 38 players and zero ratings,
so <https://www.esports-player-atlas.workers.dev> opens on an empty leaderboard with a dash
against every player. Nothing is broken; it just looks that way.

## The current workaround

`buildRanking()` in `public/app/ranking.js` fetches `/api/players` as well and appends
whatever the leaderboard omitted, with `rank: null` and `value: null`. They render with a
dash for rank and an em dash for score.

It works, and it costs a second request on every load that exists only to paper over the
first one.

## Options

1. **Keep the client-side merge.** No backend change, two requests forever.
2. **Add `?include=unrated` to the leaderboard route**, returning them last with a null
   value. One request, and the route stays honest about what a ranking is.
3. **Rank unrated players last by convention**, giving them a value of 0. Simplest, and
   wrong: it says they scored zero rather than that nobody has said.

Option 3 is listed only to be rejected explicitly.

## Done when

One answer is implemented and the second request is either justified or gone.
