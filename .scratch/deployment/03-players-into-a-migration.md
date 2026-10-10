# Move the player roster from the seed into a migration

Status: ready-for-agent
Source: deployment spec, Phase 3

## Why

Production data now arrives only by migration — no API scripting, no service token. The 38
Brood War players currently live in `seed/demo.sql`, which must never run against
production, so as things stand production would launch with an empty atlas.

## What to do

1. Create `migrations/0002_players.sql` holding the 38 `INSERT OR IGNORE` rows currently at
   the bottom of `seed/demo.sql`, with the Liquipedia source and CC BY-SA attribution
   comment moved with them.
2. Remove those rows from `seed/demo.sql`, leaving only what must stay local: the demo
   player and the `PRO-DEMO-2026` invite.
3. Check local still works from zero: a fresh database plus migrations plus seed gives 39
   players and one invite, with no duplicates. `INSERT OR IGNORE` on a unique slug makes
   re-running harmless either way.
4. Update the `seed/demo.sql` header comment, which currently describes the file as carrying
   the roster.

## Watch out

**This is a data migration, so the safety rules still apply.** It is purely additive, which
is the easy case — but it is also the first migration to run under CI auto-apply, so it is
worth walking through
[04-migration-safety-skill](04-migration-safety-skill.md) on it even though the answer will
be "fine".

Editing a player afterwards means another migration, until the admin UI exists. Acceptable
for reference data; note it so nobody is surprised.

`style` and `notes` stay empty — the Liquipedia list has no equivalent field, so the detail
column renders mostly em dashes until someone writes them
([player-profiles/01](../player-profiles/01-profile-image-and-form-field.md)).

## Done when

A fresh remote database gets the 38 players from migrations alone, and `seed/demo.sql`
contains nothing that would be harmful in production.
