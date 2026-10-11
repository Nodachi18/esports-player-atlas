-- A Player's handle is unique across the roster, case-insensitively.
--
-- Decided on 03 (form behaviour contract). Without it two Players may both be called
-- "Flash" -- legal today, since only `slug` is UNIQUE -- and the header search, which is
-- the only way to pick a Player to edit (decision 3), shows two identical rows with no
-- way to tell which is which. `uniqueSlug()` would quietly make the second one `flash-2`.
--
-- An index, not a constraint: SQLite cannot add a UNIQUE constraint to an existing table
-- without a full rebuild, and a unique index is additive and does the same job.
--
-- COLLATE NOCASE, because "Flash" and "flash" side by side in a result list is precisely
-- the confusion this exists to prevent. Honest limit: SQLite's NOCASE folds ASCII A-Z
-- only, so "Muller" and "muller" fold but a non-ASCII pair would not. Irrelevant for this
-- roster, whose 38 handles are ASCII.
--
-- This only works because delete is hard (decision 2). Under a soft delete a deleted
-- "Flash" would hold the name forever and no new one could ever be created.
--
-- CREATE UNIQUE INDEX fails outright if duplicates already exist, and it fails inside
-- `npm run deploy` after `d1 migrations apply` and before `wrangler deploy`, leaving every
-- later migration unapplied. So the index does not go first: the UPDATE below clears the
-- way for it, in this same file, the way 0004 pairs its ADD COLUMN with its backfill.
--
-- The UPDATE keeps the lowest-id row of each colliding group unchanged and renames the
-- rest to `<name> #<id>`, which is unique because `id` is. A renamed handle is visibly
-- wrong, which is the point -- an admin can see it in the roster rail and fix it properly
-- through the form this map is specifying.
--
-- It is a no-op today. Verified against the live database on 2026-10-11: 38 players, no
-- duplicate name exact, case-insensitive, or after slugification. It exists for whenever
-- this is actually applied, which is not today.
--
-- RESIDUAL, stated rather than implied: this removes the realistic failure, not every
-- conceivable one. The index can still fail if some untouched row is already named
-- literally `Flash #7` while id 7 is a duplicate `Flash`. Nothing can rule that out in a
-- single pass of SQL. So the pre-flight query stays worth running before applying:
--
--   select lower(name) n, count(*) c from players group by n having c > 1;
--
-- DEPLOY WINDOW: the index exists before the new code does, so during the minutes between
-- the migration and the deploy the OLD POST /api/admin/players can hit it and return a
-- bare 500 instead of the 409 the new code returns -- it has no UNIQUE catch. Admin-only
-- and minutes wide; the alternative is sequencing two deploys.

UPDATE players
SET name = name || ' #' || id
WHERE EXISTS (
  SELECT 1 FROM players q
  WHERE q.name = players.name COLLATE NOCASE AND q.id < players.id
);

CREATE UNIQUE INDEX players_name_unique ON players(name COLLATE NOCASE);
