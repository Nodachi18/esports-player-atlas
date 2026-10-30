# Accounts schema, the ratings FK, and the flush

Status: resolved
Part of: [../01-discord-oauth-sign-in.md](../01-discord-oauth-sign-in.md)
Blocked by: —

## Problem

There is no table for an Account, nothing on a rating that points at one, and the three
pre-account ratings in production are hashes of browser tokens that no person can be
attached to.

Decided during planning on 2026-10-29: **the legacy ratings are discarded.** That answers
[../06-legacy-ratings-after-accounts.md](../06-legacy-ratings-after-accounts.md) — including
the question it was really about, which is that `UNIQUE (player_id, panel, voter_hash)` would
otherwise let one person rate the same player twice, once anonymously and once signed in.

## What to build

One migration, `migrations/0007_accounts.sql`:

```sql
CREATE TABLE accounts (
  id INTEGER PRIMARY KEY,
  discord_id TEXT NOT NULL UNIQUE,
  username TEXT NOT NULL DEFAULT '',
  global_name TEXT NOT NULL DEFAULT '',
  avatar TEXT NOT NULL DEFAULT '',
  role TEXT NOT NULL DEFAULT 'community' CHECK (role IN ('community', 'professional')),
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  last_login_at TEXT NOT NULL DEFAULT ''
);

DELETE FROM ratings;
DELETE FROM player_stats;

ALTER TABLE ratings ADD COLUMN account_id INTEGER REFERENCES accounts(id) ON DELETE SET NULL;
CREATE INDEX ratings_account ON ratings(account_id);
```

- `discord_id` is **TEXT**. A snowflake is 19 digits and does not survive a JavaScript
  number; it is a string everywhere, in the database and in the code.
- `username`, `global_name` and `avatar` are a display cache, refreshed on every sign-in.
  `username` is mutable and not unique — never a join key.
- `avatar` holds the hash only. Nothing renders it: an `<img>` pointing at
  `cdn.discordapp.com` breaks the site's no-third-party-origin rule.
- `role` is here rather than in [../04-promote-account-to-professional.md](../04-promote-account-to-professional.md)
  because `/api/auth/me` has to hand `nav.js` a role from somewhere, and the alternative is
  a hardcoded `'community'` in two places plus a second migration later.
- `last_login_at` defaults to `''`, not `CURRENT_TIMESTAMP` — see
  [`docs/adr/0001`](../../../docs/adr/0001-player-updated-at-defaults-to-empty-string.md).
  Here it is a plain column default on `CREATE TABLE`, which is legal either way, but the
  empty-string convention is the one this repo already uses for "never happened yet".

## Watch out

- **The flush is destructive and runs on deploy.** `npm run deploy` applies migrations
  before `wrangler deploy`, so merging this to `main` deletes those rows from production.
  That is intended, and it is why the whole set lands as one PR. **Do not deploy, and do
  not apply this against the remote database.** Local verification only.
- **Re-check the row count before this lands.** 3 community ratings on 3 players on
  2026-10-13; **5 on 5 players, 0 professional, re-counted against the live API on
  2026-10-29**. Growing at roughly a rating a week, so the decision holds — but it is a
  decision about a number, and if this sits unmerged the number moves. If it has grown
  meaningfully, stop and say so.
- **`migrations/0005_player_delete_cascade.sql` does not help here.** Its trigger is
  `AFTER DELETE ON players`; a direct `DELETE FROM ratings` never fires it, which is why
  `player_stats` is flushed explicitly. Leaving it would strand cached aggregates whose
  rating rows are gone — the public site reads `player_stats`, so stale scores would keep
  rendering for players with no ratings.
- **`ON DELETE SET NULL` is advisory in this codebase.** `PRAGMA foreign_keys` is per
  connection and nothing sets it, so deleting an account will not reliably null these.
  Written anyway as a statement of intent; whatever needs it enforced gets a trigger, the
  way `0005` did. Say so in a comment so the next reader does not trust it.
- SQLite accepts a `REFERENCES` clause on `ADD COLUMN` only when the column's default is
  NULL, which it is here. Do not add `NOT NULL`: legacy and professional rows have no
  account.

## Done when

The `d1-migrations` skill's checklist has been followed (it fires on any edit under
`migrations/`), the migration applies cleanly from an empty local database **and** against
the previous release's schema, `npm test` is green, and a local
`wrangler d1 execute` shows the `accounts` table present, `ratings.account_id` present,
and zero rows in `ratings` and `player_stats`.
