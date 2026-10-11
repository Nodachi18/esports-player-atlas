# Per-player rating counts have no endpoint

Type: task
Status: resolved
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

## Answer

**Resolved 2026-10-11 on [03](../../03-form-behaviour-contract.md).** All three questions
answered; decision 8 is unblocked.

**`/api/players` grows a flat `ratings` count**, a `count(*)` via a left join. It is the
public list endpoint decision 10 already names, and a per-player count is public in
aggregate anyway. No admin-only list endpoint.

**It counts every row, flagged included**, because the cascade takes flagged rows too. This
was the question with a wrong answer available: `profiles()` *does* yield a usable `n`, but
`refreshStats()` builds it from unflagged rows only (`src/worker.js:214`), so it understates
a cascade by exactly the Ratings an admin has already looked at. The count is deliberately
**not** added to `profiles()` for that reason — two differently-computed counts side by side
is the confusion this exists to end.

**The guard reads the value its rail row was rendered from**, without re-fetching. With one
admin and an 8-hour token the stale case is theoretical, and `DELETE` now returns
`{slug, ratings: n}` — what it actually destroyed — so a stale guard shows up as a visible
discrepancy afterwards rather than never.

One number serves the rail row, the form's read-only Ratings cell and the guard, and they
cannot disagree.

The disclosure's **rows** are a separate problem and did not come with this:
[03/tickets/01](../../03-form-behaviour-contract/tickets/01-per-player-rating-rows-have-no-endpoint.md).
