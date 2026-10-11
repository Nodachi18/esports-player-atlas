-- Make the delete cascade unconditional, independent of foreign key enforcement.
--
-- Decision 2 is a hard delete: removing a Player destroys their Ratings and their cached
-- aggregates, irreversibly, on a live public site. The whole guarantee rests on
-- ON DELETE CASCADE in 0001_init.sql, which only fires when foreign keys are enforced --
-- and `foreign_keys` is a PER-CONNECTION pragma that nothing in this repository sets.
--
-- Verified 2026-10-11 against the local database: `PRAGMA foreign_keys` reads 1 and
-- deleting a seeded Player left zero orphans in both `ratings` and `player_stats`,
-- flagged row included. That test ran on Wrangler's own connection. The delete route runs
-- on the Worker's, which is a different connection, so it proves less than it looks like.
--
-- If enforcement were ever off, DELETE FROM players would orphan both child tables rather
-- than fail -- and because SQLite reuses INTEGER PRIMARY KEY rowids, the next Player
-- created could inherit a dead Player's Ratings and cached scores. Wrong numbers on a real
-- profile, no error anywhere, discoverable only by reading them.
--
-- Triggers always fire. They do not consult `foreign_keys`, so this holds on every
-- connection, in the Worker and in the CLI alike.
--
-- AFTER DELETE, not BEFORE: when enforcement IS on, the FK cascade has already removed the
-- child rows by the time this runs and both statements match nothing. The trigger is
-- therefore a no-op in the expected case and the safety net in the unexpected one. It is
-- not a second delete path and it changes no behaviour that currently works.

CREATE TRIGGER players_delete_cascade AFTER DELETE ON players
BEGIN
  DELETE FROM ratings WHERE player_id = OLD.id;
  DELETE FROM player_stats WHERE player_id = OLD.id;
END;
