# Prove the delete cascade is enforced before shipping the delete

Type: task
Status: open
Blocked by: —
Map: ../../../map.md
Found by: ../contract.md

## Problem

Decision 2 rests entirely on `ON DELETE CASCADE`. Nothing in this repository sets
`PRAGMA foreign_keys` — not `migrations/`, not `src/`, not `wrangler.jsonc`, not `test/`.
Cloudflare's documentation implies enforcement is on by default, since it documents how to
*temporarily disable* foreign key constraints for a migration rather than how to enable
them. That is an inference from an absence, and it is load-bearing.

If it is wrong, `DELETE FROM players` silently orphans rows instead of cascading, and
because SQLite reuses `INTEGER PRIMARY KEY` rowids, **the next Player created can inherit a
dead Player's Ratings and cached aggregate scores.** Wrong scores on a real profile, with
no error anywhere and no way to notice except by reading them.

A second thing the map does not say: the cascade reaches **two** tables, not one.
`player_stats` carries the same clause (`migrations/0001_init.sql:43`), so a delete also
destroys that Player's precomputed aggregates. Correct, and worth stating — decision 2 only
ever mentions `ratings`.

## What to do

A test, run before `DELETE /api/admin/players/:slug` ships:

- Create a Player, attach at least one Rating per panel and let `refreshStats()` write
  `player_stats`.
- Flag one of the Ratings, so the flagged path is covered — the cascade takes those too.
- Delete the Player.
- Assert zero rows remain in **both** `ratings` and `player_stats` for that `player_id`.

Nothing in `test/` touches foreign keys today.

## If it turns out they are not enforced

Do not paper over it in the route with a `PRAGMA` or three manual deletes. An unenforced
foreign key means every cascade in this schema is decorative, which is a finding that
reopens decision 2 rather than a bug in the delete path.
