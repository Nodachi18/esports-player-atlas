# Decide what the migration adds

Type: grilling
Status: resolved
Blocked by: —
Map: ../map.md

## Question

Decision 13 puts one column in this map's migration: `form TEXT NOT NULL DEFAULT ''`,
editorial free text beside `style`. Is that the whole migration?

The candidate that is not yet decided is `updated_at`. `players` has `created_at` and
nothing else; an edit UI that can rewrite every field of a row without recording that it
happened is a gap you only notice later, and the column is as cheap as `form`. Against it:
nothing reads it, nothing displays it, and `players` has survived without it.

Also settle, because they are schema questions and this is the only migration this map
produces:

- Whether `form` wants a length cap at the API layer like `style` (200) or `notes` (1000).
- Whether anything else the form will edit lacks a column. Walk the field list against
  `migrations/0001_init.sql` rather than against what the current form renders.

This migration will be applied unseen — CI runs it on push to `main`, and `npm run deploy`
runs it from a laptop, in both cases *before* the new code is live. The `d1-migrations`
skill fires on any edit under `migrations/` and its rules apply here. Adding a nullable or
defaulted column to `players` is the safe shape; confirm nothing in the plan drifts off it.

## Comments

**2026-10-11** — Grilled and decided. Everything the ticket produced is in
[`02-migration-shape/`](02-migration-shape/): the reasoning
([decisions.md](02-migration-shape/decisions.md)), the two migration files staged but not
placed under `migrations/`, and one new ticket
([tickets/](02-migration-shape/tickets/)).

The fact that moved the `updated_at` question: `ALTER TABLE players ADD COLUMN updated_at
TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP` **fails** against a table that has rows — SQLite
refuses a non-constant default in `ADD COLUMN` — and **succeeds** against an empty one. It
would have passed the local verification step (`rm -rf .wrangler/state/v3/d1`) and failed
for the first time on the 38 rows in production, inside `npm run deploy`, after the
migration step and before `wrangler deploy`.

## Answer

**Two migrations, both additive, both staged outside `migrations/`.** Decided 2026-10-11.
Reasoning in [02-migration-shape/decisions.md](02-migration-shape/decisions.md).

### `0003_player_form.sql`

```sql
ALTER TABLE players ADD COLUMN form TEXT NOT NULL DEFAULT '';
```

Decision 13's column, unchanged in shape. Editorial free text beside `style`, never derived
from Ratings; the glossary entry in `CONTEXT.md` already says so and needs no edit.

### `0004_player_updated_at.sql`

```sql
ALTER TABLE players ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

UPDATE players SET updated_at = created_at WHERE updated_at = '';
```

**`updated_at` is in.** The contract: it equals `created_at` on create and moves forward on
every write that changes the row, so `updated_at > created_at` means exactly "edited since
it was made" and the column is never earlier than `created_at`.

**The default is `''` and not `CURRENT_TIMESTAMP`, because it cannot be.** See the comment
above, and
[`docs/adr/0001`](../../../docs/adr/0001-player-updated-at-defaults-to-empty-string.md). The backfill gives the 38 seeded rows the invariant and loses nothing — it fills
only the `''` the `ADD COLUMN` just created.

**One row shape escapes the backfill**: a Player created by the *old* code during the
window lands `updated_at = ''`. Admin-only, minutes wide. Readers use
`coalesce(nullif(updated_at,''), created_at)` rather than a second migration.

**The create path writes both columns explicitly** —
`..., created_at, updated_at) values(..., CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)` — rather
than leaning on the `created_at` default. SQLite evaluates `CURRENT_TIMESTAMP` once per
statement, so the two values are identical rather than a microsecond apart; this was
checked against the real schema.

### Two files, not one

`d1-migrations` says one concern per file, and these are two: `form` is the editorial
content this map exists to add, `updated_at` is audit metadata it picked up on the way.
Split, a build session that rethinks `updated_at` drops `0004` and still ships the form.
`0004` is also the file carrying the `UPDATE`, so a backfill failure blocks nothing else.

### The cap: 250, for `style`, `form` and `notes` alike

`style` 200 and `notes` 1000 both become **250**, and `form` joins them there. One number
for the whole Editorial fieldset — two numbers for three fields of the same kind is a
distinction the form cannot show, and 1000 invites a paragraph into a short editorial
phrase.

**Nothing in the schema enforces it.** SQLite `TEXT` is unbounded and a `CHECK` cannot be
added to an existing column additively, so 250 lives in `text()` (`src/worker.js:261`) and
the form's `maxlength`. The migration comments say so, to stop the next reader hunting for
a constraint that was never written.

**The narrowing is safe today**: the live database holds 38 players with
`max(length(notes)) = 0` and `max(length(style)) = 0`, checked 2026-10-11. It stops being
safe the moment a long note exists, because `text()` truncates silently — hence
[tickets/01](02-migration-shape/tickets/01-cap-change-has-no-test.md). What `text()` does
at the boundary, truncate or 400, is a route question and went to
[03](03-form-behaviour-contract.md).

### The rest of the field walk

Walked against `migrations/0001_init.sql`, not against what the form renders today:
handle/`name`, `real_name`, `game`, `faction`, `style`, `notes` and `slug` all have
columns. **`form` is the only gap.** `players.active` stays where decision 5 left it.

### The files are not under `migrations/`

In this repo the file *is* the apply — every push to `main` runs `d1 migrations apply`
before `wrangler deploy` — so merging them would put two columns into production weeks
before any code writes them. Both are safe in the window (additive, defaulted; the old
code's `INSERT` at `src/worker.js:150` and `select ${PLAYER_COLUMNS}` were both replayed
against the post-migration schema and both work), so this is sequencing, not danger.
Moving them is one `git mv` and is the build session's first act. The `d1-migrations`
verification checklist has **not** been run — only a simulation against `0001_init.sql`.

### Opened from here

[tickets/01](02-migration-shape/tickets/01-cap-change-has-no-test.md) — the `notes`
narrowing is silent truncation with no test behind it.
