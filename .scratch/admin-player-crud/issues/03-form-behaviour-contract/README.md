# 03 — Decide the form's behaviour contract

Everything that came out of [the ticket](../03-form-behaviour-contract.md).

> **The four `.sql` files are no longer here.** They were moved to `migrations/` and
> applied on 2026-10-12 as the build session's first act, exactly as described below. The
> links in the table point at where they live now; everything else on this page is the
> record of why they have the shape they have.

| File | What it holds |
|---|---|
| [contract.md](contract.md) | The contract itself: routes, rejections, form behaviour. **This is what [05](../05-handoff-spec.md) folds into `spec.md`** |
| [decisions.md](decisions.md) | Why it has this shape, including three answers that were reversed mid-session |
| [0005_player_delete_cascade.sql](../../../../migrations/0005_player_delete_cascade.sql) | A **third** migration: makes the delete cascade unconditional. Applied 2026-10-12 |
| [0006_player_name_unique.sql](../../../../migrations/0006_player_name_unique.sql) | A **fourth**: dedupe, then the unique index. Applied 2026-10-12, a no-op against the live roster |
| [tickets/](tickets/) | New work this ticket uncovered |

The ticket's `## Answer` is the short form. Read [contract.md](contract.md) to build from,
[decisions.md](decisions.md) to argue with.

## Three decisions a reader is likely to arrive carrying the old version of

Round 4 reversed three earlier answers. The superseded versions are still written down in
[01](../01-admin-page-layout.md) and in this session's own earlier rounds, so they are
named here rather than left to be rediscovered:

1. **There is no live slug preview.** 01's answer describes one — typing `Flash` showing
   `/flash-2` with *flash is taken, so this becomes flash-2* — and its four lines of copy
   are **withdrawn**. Slug derivation lives in the backend only. The slug first appears in
   *Created BoxeR at `/boxer`*.
2. **`name` is unique**, case-insensitively, across the whole roster. Duplicate Players
   are a `409` on the name, not a silently suffixed slug. This is what the third migration
   is for.
3. **The `401` does what it does today** — session cleared, page thrown back to Players,
   draft lost. 01's requirement, *Your admin session expired, so nothing was saved … 
   everything you typed is still here*, is **withdrawn** and not built.

## Two more migrations, making four

Staged here under the same rule as 02's two — a migration that reaches `main` is a
migration that has been applied — so the build session's first act is four `git mv`s:

```sh
git mv .scratch/admin-player-crud/issues/02-migration-shape/0003_player_form.sql migrations/
git mv .scratch/admin-player-crud/issues/02-migration-shape/0004_player_updated_at.sql migrations/
git mv .scratch/admin-player-crud/issues/03-form-behaviour-contract/0005_player_delete_cascade.sql migrations/
git mv .scratch/admin-player-crud/issues/03-form-behaviour-contract/0006_player_name_unique.sql migrations/
```

**`0005` makes the cascade unconditional.** An `AFTER DELETE` trigger on `players` that
clears `ratings` and `player_stats`. Triggers do not consult the `foreign_keys` pragma, so
the cascade holds on every connection rather than on the one that happened to be measured.
A no-op whenever enforcement is on, since the FK cascade has already run by the time it
fires. This is what resolved [tickets/02](tickets/02-prove-the-cascade-is-enforced.md).

**`0006` clears its own way before it constrains.** `CREATE UNIQUE INDEX` fails outright
against existing duplicates, mid-deploy; so the file renames colliding handles to
`<name> #<id>` first and creates the index second, the way `0004` pairs its `ADD COLUMN`
with its backfill. It is a no-op against today's roster — verified against live on
2026-10-11, 38 Players, no duplicate exact, case-insensitive or after slugification — and
exists for whenever it is actually applied.

Its residual is written in the file rather than implied: a row already named literally
`Flash #7`, where id 7 is a duplicate `Flash`, still breaks it. One pass of SQL cannot rule
that out, so the pre-flight query stays worth running.

### All four were applied and tested together

Against SQLite 3.45.1, from `0001` forward:

| | |
|---|---|
| Four migrations apply in order | clean |
| Applied to a roster seeded with `Flash` / `FLASH` / `BoxeR` duplicates | clean — survivors `Flash`, `BoxeR`, `Flash #39`, `FLASH #40`, `BoxeR #41` |
| Delete a Player, foreign keys **on** | 0 orphans in `ratings` and `player_stats` |
| Delete a Player, foreign keys **off**, trigger present | 0 orphans |
| Delete a Player, foreign keys **off**, **no** trigger | **2 orphan ratings, 1 orphan stat row** — what `0005` prevents |

## Tickets opened from here

- [01 — The per-player ratings disclosure has no endpoint behind its rows](tickets/01-per-player-rating-rows-have-no-endpoint.md)
  — blocks nothing; the disclosure ships as a count.
- [02 — Prove the delete cascade is enforced before shipping the delete](tickets/02-prove-the-cascade-is-enforced.md)
  — **resolved**, and it blocks nothing now. It was measured, then fixed in the schema by
  `0005` so the measurement stops mattering.

## Resolved from here

- [01/tickets/03 — Per-player rating counts have no endpoint](../01-admin-page-layout/tickets/03-rating-counts-have-no-endpoint.md)
  — `/api/players` grows a flat `ratings` count including flagged rows. All three of its
  questions answered. This unblocks decision 8.

## Notes written back onto open tickets

- [04 — destructive routes and rate limiting](../04-destructive-routes-and-rate-limiting.md):
  the delete route has **no** second factor, because the typed-slug guard stays a UI
  mechanic. 04's exposure is exactly what 04 says it is.
- [05 — handoff spec](../05-handoff-spec.md): [contract.md](contract.md) is its input for
  the routes, the failure modes and the form behaviour; its test list grows four items.
- [02 — migration shape](../02-migration-shape.md): amended from two staged migrations to
  three.
- [map.md](../../map.md): decision 7 amended, decision 15 added, one line under Decisions
  so far.
