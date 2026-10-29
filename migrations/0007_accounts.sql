-- Accounts, the rating -> account link, and the discard of every pre-account rating.
--
-- DESTRUCTIVE. This deletes live rows from a public site. `npm run deploy` applies
-- migrations and then uploads the Worker, so merging this to main empties `ratings` and
-- `player_stats` in production. That is the point, not a side effect, and it is why this
-- file ships in the same pull request as the sign-in that justifies it.
--
-- WHAT IS LOST: every rating cast before accounts existed, and the cached aggregates
-- computed from them. Counted live on 2026-10-13: 3 community ratings across 3 players,
-- 0 professional. Nothing here is regenerable -- the ratings are the only data in this
-- project that does not come out of the repository. "Discard" was decided against that
-- number (see .scratch/accounts/06-legacy-ratings-after-accounts.md); re-count before
-- this merges and stop if it has grown meaningfully.
--
-- WHY DISCARD RATHER THAN KEEP: a pre-account rating is a hash of something no person can
-- be attached to -- a browser-local voter id for the community panel, the invite row's id
-- for the professional one, where every holder of a code collapsed into a single rater.
-- Keeping them is not merely untidy. `UNIQUE (player_id, panel, voter_hash)` in
-- 0001_init.sql is keyed on the hash, so the same person who rated anonymously can rate
-- the same player a second time once signed in, under a different hash, and both rows
-- count toward the published median. Deleting the rows closes that by removing its
-- subject.
--
-- WHY player_stats GOES EXPLICITLY: 0005's cascade trigger is AFTER DELETE ON players. A
-- direct DELETE FROM ratings never fires it. Without the second statement the cached
-- aggregates outlive the ratings that produced them, and the public read routes touch
-- only `player_stats` -- so every profile would keep rendering a score backed by nothing.
--
-- ORDER MATTERS: the flush runs before the ADD COLUMN, so the column is added to an empty
-- table. The default is NULL, which is constant and legal on a table with rows either
-- way, but see docs/adr/0001 for why that is never assumed here -- SQLite rejects a
-- non-constant ADD COLUMN default only when rows are present, which is exactly the case
-- local verification does not have and production does.
--
-- ONE FILE, several statements, against the usual one-concern-per-file rule: the schema
-- and the flush are one decision, and splitting them puts a release between a `ratings`
-- table that has an `account_id` and a `ratings` table whose rows can never fill it. A
-- part-way failure here is recoverable by re-running the remaining statements in a
-- forward migration; a part-way flush is not worse than a complete one, since the rows
-- are being discarded regardless.
--
-- DEPLOY WINDOW: between the migration and the upload, the old code runs against the new
-- schema. It never names `account_id`, so its INSERTs into `ratings` still succeed and
-- land with account_id NULL. Such a row is a rating cast in the minutes after the flush
-- by a browser token -- attributable to nobody, exactly what this migration exists to
-- remove. It is minutes wide and 05 gates rating on a session immediately after, which
-- closes it. Stated rather than silently accepted.

CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  -- TEXT, not INTEGER. A Discord snowflake is 19 digits and does not survive a JavaScript
  -- number; it is a string in the database and in the code, everywhere, without exception.
  discord_id TEXT NOT NULL UNIQUE,
  -- username/global_name/avatar are a display cache, refreshed on every sign-in.
  -- `username` is mutable and not unique on Discord's side: never a join key, never an
  -- identity. The snowflake is the identity.
  username TEXT NOT NULL DEFAULT '',
  global_name TEXT NOT NULL DEFAULT '',
  -- The avatar HASH only, and nothing renders it. An <img> pointing at cdn.discordapp.com
  -- would break the no-third-party-origin rule the privacy page states.
  avatar TEXT NOT NULL DEFAULT '',
  -- Here rather than in a later migration because /api/auth/me has to hand nav.js a role
  -- from somewhere, and the alternative is a hardcoded 'community' in two places plus a
  -- second migration to undo it.
  role TEXT NOT NULL DEFAULT 'community' CHECK (role IN ('community', 'professional')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  -- '' rather than CURRENT_TIMESTAMP, meaning "never happened yet". Legal either way in a
  -- CREATE TABLE; it follows the convention docs/adr/0001 established for this repository
  -- so that readers do not have to work out which columns are safe to copy.
  last_login_at TEXT NOT NULL DEFAULT ''
);

DELETE FROM ratings;
DELETE FROM player_stats;

-- ON DELETE SET NULL IS ADVISORY HERE -- DO NOT TRUST IT. `foreign_keys` is a
-- per-connection pragma and nothing in this repository sets it, so deleting an account
-- will not reliably null these rows. The clause is written as a statement of intent and
-- as documentation of the relationship. Whatever actually needs it enforced gets a
-- trigger, the way 0005 did for the player cascade.
--
-- Nullable, with no NOT NULL: SQLite accepts a REFERENCES clause on ADD COLUMN only when
-- the column's default is NULL, and the column must stay nullable regardless -- a
-- professional rating cast against an invite has no account behind it.
ALTER TABLE ratings ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;

CREATE INDEX ratings_account ON ratings(account_id);
