-- When a Player row was last touched. Equal to created_at on create, moved forward by
-- every write that changes the row.
--
-- The default is '' and NOT CURRENT_TIMESTAMP. SQLite refuses a non-constant default in
-- ADD COLUMN on a table that has rows -- "Cannot add a column with non-constant default".
-- It succeeds on an empty table, so a CURRENT_TIMESTAMP default passes against a freshly
-- wiped local database and fails against the 38-row production table, mid-deploy, after
-- the migration step and before wrangler deploy, leaving every later migration unapplied.
--
-- The backfill gives the 38 seeded rows the invariant updated_at >= created_at. It loses
-- nothing: it only fills rows the ADD COLUMN just created as ''.
--
-- One row shape escapes it: a Player created by the OLD code during the window gets
-- updated_at = '' and no backfill behind it. Admin-only path, minutes wide, and readers
-- handle it with coalesce(nullif(updated_at,''), created_at).

ALTER TABLE players ADD COLUMN updated_at TEXT NOT NULL DEFAULT '';

UPDATE players SET updated_at = created_at WHERE updated_at = '';
