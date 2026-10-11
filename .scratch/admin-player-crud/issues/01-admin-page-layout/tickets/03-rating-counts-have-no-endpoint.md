# Per-player rating counts have no endpoint

Type: task
Status: open
Blocked by: —
Map: ../../../map.md
Found by: ../prototype.md

## Problem

Decision 8 requires the delete guard to state **the exact number of Ratings that will be
destroyed**. The layout prototype also puts a rating count beside every row of the roster,
in all three variants, because "who has ratings" is what tells the admin which rows matter.

Nothing serves that number.

- `GET /api/players` returns `id,slug,name,real_name,game,faction,style,notes` and no
  counts (`src/worker.js:52`).
- `GET /api/admin/stats` returns totals across the whole table, not per player.
- `GET /api/players/:slug` goes through `profiles()`, which carries aggregate scores —
  check whether a usable `n` falls out of it, and whether it is per panel or combined.
- `GET /api/admin/ratings` returns up to 1000 rows and would have to be counted in the
  browser. That is the wrong shape for a number the guard depends on being right.

A guard that states a stale or wrong count is worse than one that states none: it is the
only fact the admin is given before an irreversible delete.

## What to decide

- Whether `/api/players` grows a count (it is the public endpoint — a count is already
  public via the ratings aggregates, so this is probably fine), or whether the admin picker
  uses an admin-only list endpoint instead.
- Whether the guard reads its count from the list it was rendered from, or re-fetches
  immediately before showing the dialog. With one admin and an 8-hour token the stale case
  is theoretical, but the count is load-bearing.
- Whether the count is "ratings" flat, or excludes flagged ones. The cascade deletes
  flagged rows too, so the guard must count **all** of them, not the ones the scores use.

Decision 10 says the picker lists from `/api/players`; this ticket is what that endpoint
has to return for the picker to be useful.
