# 02 — Decide what the migration adds

Everything that came out of [the ticket](../02-migration-shape.md).

> **The four `.sql` files are no longer here.** They were moved to `migrations/` and
> applied on 2026-10-12 as the build session's first act, exactly as described below. The
> links in the table point at where they live now; everything else on this page is the
> record of why they have the shape they have.

| File | What it holds |
|---|---|
| [decisions.md](decisions.md) | Why the migration has this shape. The decision itself is the ticket's `## Answer` |
| [0003_player_form.sql](../../../../migrations/0003_player_form.sql) | Adds `players.form`. Applied 2026-10-12 |
| [0004_player_updated_at.sql](../../../../migrations/0004_player_updated_at.sql) | Adds `players.updated_at` and backfills it. Applied 2026-10-12 |
| [tickets/](tickets/) | New work this ticket uncovered |

## The two files are deliberately not under `migrations/`

In this repo the file *is* the apply: every push to `main` runs `d1 migrations apply`
before `wrangler deploy`. Leaving them here keeps the map's promise that no migration is
applied from it. The build session's first act is:

```sh
git mv .scratch/admin-player-crud/issues/02-migration-shape/0003_player_form.sql migrations/
git mv .scratch/admin-player-crud/issues/02-migration-shape/0004_player_updated_at.sql migrations/
```

then the `d1-migrations` verification checklist, which was run in full for the
2026-10-12 release — at the time this page was written only a simulation against
`0001_init.sql` had been. Both are additive and defaulted, and the old
code's `INSERT` and `select ${PLAYER_COLUMNS}` were both replayed against the
post-migration schema and both work.

## Tickets opened from here

- [01 — Narrowing the `notes` cap is a silent data loss with no test behind it](tickets/01-cap-change-has-no-test.md)
  — **resolved**. Every editorial field in the live database is empty seed data
  (`max(length(notes)) = 0`), so there is no text for the narrower cap to truncate. What
  `text()` does at the boundary went to [03](../03-form-behaviour-contract.md); the test
  went to [05](../05-handoff-spec.md).

## Two more migrations joined these two

[03](../03-form-behaviour-contract.md) added
[`0005_player_delete_cascade.sql`](../../../../migrations/0005_player_delete_cascade.sql)
— a trigger making the delete cascade independent of foreign key enforcement — and
[`0006_player_name_unique.sql`](../../../../migrations/0006_player_name_unique.sql),
which dedupes colliding handles and then creates the unique index. Both staged in 03's
folder under the same rule, so the build session's first act is four `git mv`s, not two.

`0006` pairs a data fix with its constraint in one file for the same reason `0004` pairs
its `ADD COLUMN` with its backfill: split, there is a window where the fix has run and the
thing it enables has not.

## Notes written back onto open tickets

- [03 — form behaviour contract](../03-form-behaviour-contract.md): the 250 cap, what
  `text()` does at the boundary, and `updated_at` as something `PUT` must write.
- [05 — handoff spec](../05-handoff-spec.md): where the migration files are, and that
  moving them is step one.
- [map.md](../../map.md): decision 13 amended, decision 14 added, one line under
  Decisions so far.
