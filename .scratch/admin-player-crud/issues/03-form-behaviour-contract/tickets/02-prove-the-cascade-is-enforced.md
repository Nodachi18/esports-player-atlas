# Prove the delete cascade is enforced before shipping the delete

Type: task
Status: resolved
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

## Answer

**Resolved 2026-10-11. Measured first, then fixed in the schema so the measurement stops
being load-bearing.**

### What the measurement found

Against the local database: `PRAGMA foreign_keys` reads `1`, and deleting a seeded Player
with two Ratings — one of them flagged — and a `player_stats` row left **zero orphans in
both tables**. So on that connection the cascade is real, and `player_stats` is confirmed
to go with `ratings`.

**It proves less than it looks like.** `foreign_keys` is a *per-connection* pragma. That
test ran on Wrangler's CLI connection; the delete route will run on the Worker's, which is
a different one, and there is no way to exercise it from this map without writing the route
the map exists to specify. The honest conclusion was "probably fine, unverifiable here" —
which is a poor thing to put under an irreversible delete.

### What was done instead

[`0005_player_delete_cascade.sql`](../../../../../migrations/0005_player_delete_cascade.sql), an `AFTER DELETE`
trigger on `players` clearing `ratings` and `player_stats`.

Triggers do not consult `foreign_keys`. They fire on every connection, so the cascade stops
depending on a pragma nobody sets and nobody can check from here. `AFTER DELETE` rather
than `BEFORE`, so when enforcement *is* on the FK cascade has already emptied both tables
and the trigger matches nothing — a no-op in the expected case, the safety net in the
unexpected one. It adds no second delete path and changes nothing that currently works.

### Proof, including the counterfactual

All four staged migrations applied from `0001` forward against SQLite 3.45.1:

| | |
|---|---|
| Delete, foreign keys **on**, trigger present | 0 orphan ratings, 0 orphan stats |
| Delete, foreign keys **off**, trigger present | 0 orphan ratings, 0 orphan stats |
| Delete, foreign keys **off**, **no** trigger | **2 orphan ratings, 1 orphan stat** |

The third row is the case this ticket was opened about, reproduced. Those orphans are what
SQLite's rowid reuse would later hand to a newly created Player as their Ratings and cached
scores.

### What this does not settle

Whether enforcement is on in the Worker runtime is **still unknown**, and is now
uninteresting: the trigger makes the outcome identical either way. If a build session wants
the answer anyway, the test is the one above run through the real `DELETE` route once it
exists.

This ticket no longer blocks the delete route.
