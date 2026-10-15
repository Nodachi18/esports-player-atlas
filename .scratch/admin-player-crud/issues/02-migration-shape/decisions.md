# 02 — Why the migration has this shape

Everything behind the `## Answer` on [the ticket](../02-migration-shape.md). Decided
2026-10-11.

## The field walk

The ticket asked for the form's field list to be walked against
`migrations/0001_init.sql` rather than against what the current form renders. The field
list is the one [01](../01-admin-page-layout.md) settled: Identity — handle, real name,
game, faction; Editorial — style, form, notes; plus the slug, read-only (decision 7).

| Form field | Column in `0001_init.sql` |
|---|---|
| Handle | `name TEXT NOT NULL` |
| Real name | `real_name TEXT NOT NULL DEFAULT ''` |
| Game | `game TEXT NOT NULL` |
| Faction | `faction TEXT NOT NULL DEFAULT ''` |
| Style | `style TEXT NOT NULL DEFAULT ''` |
| **Form** | **missing** |
| Notes | `notes TEXT NOT NULL DEFAULT ''` |
| Slug (read-only) | `slug TEXT NOT NULL UNIQUE` |

`form` is the only gap. Nothing else the form edits lacks a column, and
`players.active` stays where decision 5 left it — filtered by every read, written by
nothing.

## `updated_at` goes in

The ticket left this undecided and it is in.

**Why it is not just cheap.** The argument against was that nothing reads it and `players`
has survived without it. That is true of `created_at` too — it sits in `PLAYER_COLUMNS`
(`src/worker.js:9`), rides out of `/api/players/:slug` on every request, and is rendered
nowhere in `public/app/`. So the repo already has precedent for a timestamp that exists
and does nothing, which is an argument *for* nothing rather than against this. What
changes with this map is that `PUT /api/admin/players/:slug` can rewrite every field of a
row. D1 is forward-only: the column has to exist before the first edit if it is ever to
describe that edit, and there is no later migration that can recover when a row changed.

**The contract.** `updated_at` equals `created_at` on create, and moves forward on every
write that changes the row. So it is never earlier than `created_at`, and
`updated_at > created_at` means exactly "this Player has been edited since it was made" —
a question no other column in the table can answer.

### The default is `''`, and this is the part that matters

The obvious column is `updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`, matching
`created_at` in `0001_init.sql`. **It cannot be written that way.** SQLite refuses a
non-constant default in `ALTER TABLE ... ADD COLUMN`. Verified on 3.51.1 against the real
`0001_init.sql`:

```
empty players table   → ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP   ok
players with rows     → FAIL: Cannot add a column with non-constant default
```

The asymmetry is the trap. `0001_init.sql` may use `CURRENT_TIMESTAMP` because it is a
`CREATE TABLE`; an `ADD COLUMN` may not. And the failure does not reproduce locally if you
test the way the verification step says to — `rm -rf .wrangler/state/v3/d1` leaves an empty
table, where it passes. It fails for the first time against the 38 rows in production,
inside `npm run deploy`, *after* `d1 migrations apply` and *before* `wrangler deploy`, with
every later migration left unapplied behind it.

So: `TEXT NOT NULL DEFAULT ''`, with a backfill in the same file. Recorded as
[`docs/adr/0001`](../../../../docs/adr/0001-player-updated-at-defaults-to-empty-string.md),
because it is a deliberate deviation that reads as an inconsistency: the next person to
open the schema sees two timestamp columns with different defaults and reaches for the
one that cannot work.

### `created_at` and `updated_at` really are identical on create

`CURRENT_TIMESTAMP` is evaluated once per statement in SQLite, so an INSERT that writes
both gets one value in both columns rather than two readings a microsecond apart.
Confirmed against the real schema — see [the simulation](#what-was-actually-run).

The create path therefore writes both explicitly rather than leaning on the `created_at`
default, because leaning on it is what would make them differ if SQLite ever stopped
guaranteeing that.

### The row shape that escapes the backfill

A Player created by the **old** code during the window gets `updated_at = ''`: the backfill
ran before that INSERT existed, and the old `INSERT` names its columns explicitly so the
`''` default applies. One admin-only path, open for the length of a `wrangler deploy`.

Readers handle it with `coalesce(nullif(updated_at,''), created_at)` rather than a second
migration. The alternative — a nullable column and `coalesce(updated_at, created_at)` —
is the same sentinel in a different costume and loses the `NOT NULL DEFAULT` the
`d1-migrations` rules ask for.

## The cap is 250, and it is the same for all three

`style` 200 and `notes` 1000 become **250**, and `form` joins them at 250. One number for
the whole Editorial fieldset.

The caps today are `text(b.style, 200)` and `text(b.notes, 1000)` at `src/worker.js:151`.
Two different numbers for three fields of the same kind is a distinction the form cannot
show and the editor cannot predict, and 1000 invites a paragraph into what the layout
renders as a short editorial phrase — the glossary's own example is *"Top ~50,
inconsistent"*.

**Narrowing `notes` 1000 → 250 cannot truncate anything.** Checked against the live
database on 2026-10-11: 38 players, `max(length(notes)) = 0`, `max(length(style)) = 0`.
Every editorial field in production is empty, which is what `0002_players.sql` says it
intended — the Liquipedia source list has no equivalent field. There is no existing text
for a narrower cap to eat.

**The cap is not in the migration, and nothing in the schema enforces it.** SQLite `TEXT`
is unbounded; `VARCHAR(250)` would be accepted and ignored. A `CHECK` cannot be added to
an existing column without rebuilding the table, which is not an additive change and is
not worth a flag day for a limit the API already applies. So 250 lives in `text()` and in
the form's `maxlength`, and the migration comments say so to stop the next reader looking
for a constraint that was never there.

What `text()` does at the boundary — truncate silently, as it does today, or reject with a
400 — is a route-shape question and belongs to
[03](../03-form-behaviour-contract.md), which now carries it.

## Two files, not one

`0003` adds `form`; `0004` adds `updated_at` and backfills it. The `d1-migrations` rule is
one concern per file, and these are two: `form` is editorial content this map exists to
add, `updated_at` is audit metadata it picked up on the way. Split, a build session that
wants to rethink `updated_at` drops `0004` and still ships the form. Merged, it has to
rethink the file that the form depends on.

It also matters that `0004` is the file with the `UPDATE` in it. A failure there is a
failure of the backfill alone, with `form` already applied and nothing later in the
sequence blocked by a half-applied mixed file.

## Where the files are, and why not in `migrations/`

They are staged here, as
[`0003_player_form.sql`](../../../../migrations/0003_player_form.sql) and
[`0004_player_updated_at.sql`](../../../../migrations/0004_player_updated_at.sql), not under `migrations/`.

The map says no migration is applied from it. But in this repo **the file is the apply**:
every push to `main` runs `d1 migrations apply` before `wrangler deploy`, so merging the
file applies it, unattended, to production. Landing them now would put two columns in the
live database weeks before any code writes them.

Both are safe in the window — additive, defaulted, and the old code's explicit-column
`INSERT` and `select ${PLAYER_COLUMNS}` were both run against the post-migration schema and
both work. This is about sequencing, not danger. Moving them is one `git mv` and is the
build session's first act, so the columns and the code that writes them arrive together.

## What was actually run

Against the real `migrations/0001_init.sql`, with two rows inserted exactly as
`0002_players.sql` inserts them, then both migrations applied, then the old code's
statements replayed verbatim:

```
0003+0004 applied
window insert ok                       ← src/worker.js:150, unchanged, post-migration
flash    c=2026-10-11 09:12:29 u="2026-10-11 09:12:29" form=""   ← backfilled
boxer    c=2026-10-11 09:12:29 u="2026-10-11 09:12:29" form=""   ← backfilled
oldcode  c=2026-10-11 09:12:29 u=""                    form=""   ← the window row
newcode  c=2026-10-11 09:12:29 u="2026-10-11 09:12:29" form="Top ~50"
created_at === updated_at on create: true
old-code select ok                     ← PLAYER_COLUMNS, src/worker.js:9
```

This is a simulation, not the verification the `d1-migrations` skill requires. Steps 1–5
of that checklist — apply from zero on a fresh local database, `npm test`, exercise the
pages, run the previous release against the new schema, `d1 migrations list --remote` —
are the build session's, when the files move into `migrations/`.

## Opened from here

- [tickets/01 — Narrowing the `notes` cap is a decision with no test behind it](tickets/01-cap-change-has-no-test.md)
