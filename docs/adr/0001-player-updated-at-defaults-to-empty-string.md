# `players.updated_at` defaults to the empty string

`players.created_at` is `TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP`, so the obvious way to
add a sibling `updated_at` is to copy that line. **It does not work.** SQLite refuses a
non-constant default in `ALTER TABLE ... ADD COLUMN` — and only when the table has rows:

```
empty players table → ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP   ok
players with rows   → FAIL: Cannot add a column with non-constant default
```

That asymmetry is why this is written down. Migrations here are applied unattended, by CI
on every push to `main` and by `npm run deploy` from a laptop, and the local verification
step starts from `rm -rf .wrangler/state/v3/d1` — an empty table, where the obvious
spelling passes. It would fail for the first time against production, between
`d1 migrations apply` and `wrangler deploy`, leaving every later migration unapplied.

So the column is `TEXT NOT NULL DEFAULT ''`, backfilled in the same migration with
`UPDATE players SET updated_at = created_at WHERE updated_at = ''`. A reader comparing the
two timestamp columns should not "fix" the inconsistency: `created_at` may use
`CURRENT_TIMESTAMP` because it was written in a `CREATE TABLE`, and `updated_at` may not
because it was added later.

## Consequences

- **`''` is a sentinel meaning "unknown", and it is reachable.** A row inserted by the
  *old* code during the window between the migration and the deploy gets `''` with no
  backfill behind it. Read the column as
  `coalesce(nullif(updated_at, ''), created_at)` rather than assuming it is a timestamp.
- **The contract is the column's whole value**: `updated_at` equals `created_at` on
  create and moves forward on every write that changes the row, so `updated_at >
  created_at` means exactly "edited since it was made". Create writes both columns
  explicitly — `values(..., CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)` — rather than leaning
  on the `created_at` default; SQLite evaluates `CURRENT_TIMESTAMP` once per statement, so
  the two values are identical rather than a moment apart.
- **A nullable column was the alternative** and was rejected: `NULL` is the same sentinel
  wearing a different costume, and it gives up the `NOT NULL DEFAULT` that keeps the old
  code's `INSERT` working during the window.

Decided while settling the admin player CRUD migration shape. Full reasoning, and the
staged migration files, are at
`.scratch/admin-player-crud/issues/02-migration-shape/`.
