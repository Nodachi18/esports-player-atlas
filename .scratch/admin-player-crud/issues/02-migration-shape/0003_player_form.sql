-- Editorial Form for a Player: free text beside style, written by an editor and never
-- derived from Ratings. Glossary entry: CONTEXT.md, "Form".
--
-- Additive and defaulted, so the old code's explicit-column INSERT at src/worker.js:150
-- keeps working during the window between `d1 migrations apply` and `wrangler deploy`.
--
-- The 250-character cap on this column is enforced in the API by text(), not here:
-- SQLite TEXT is unbounded and a CHECK cannot be added to an existing table without a
-- full rebuild, which is not an additive change.

ALTER TABLE players ADD COLUMN form TEXT NOT NULL DEFAULT '';
