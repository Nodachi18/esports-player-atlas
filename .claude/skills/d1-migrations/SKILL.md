---
name: d1-migrations
description: Writing or editing a file in migrations/, changing a column a query reads, or deploying while a migration is pending. Every migration here is applied unseen — CI runs them on each push to main, and `npm run deploy` runs them from a laptop — and D1 migrations are forward-only, so whether one is safe is decided while it is being written.
---

# Writing a D1 migration

## The window

`npm run deploy` applies pending migrations and *then* uploads the Worker. Between those two
steps the **old** code runs against the **new** schema. That interval is the **window**, and
every rule below is a consequence of it.

The window is unavoidable, short, and live: the site is public and taking ratings while it
is open.

Migrations are also **forward-only**. There is no down-migration and no undo — the only way
back is another migration. `npx wrangler rollback` returns the *code* to a previous version
and leaves the schema exactly where it is, which makes a bad migration strictly worse than a
bad deploy.

Nobody reviews the apply. CI runs it unattended on every push to `main`.

## Rules

- **Additive only.** `ADD COLUMN` with a `DEFAULT`, `CREATE TABLE`, `CREATE INDEX`.
- **A new `NOT NULL` column carries a `DEFAULT`**, so the inserts the old code is still
  running inside the window succeed.
- **Removal takes two releases — expand, then contract.** Release one stops reading the
  column and deploys; a later release drops it. Renaming and re-typing are removals wearing
  a disguise: add the new column, backfill, switch the code, drop the old one in a later
  release.
- **A destructive `UPDATE` or `DELETE` states in the pull request what is lost and why that
  is acceptable.** Ratings are the only data here that cannot be regenerated from the repo.
- **One concern per file.** A migration that fails part-way leaves every later file
  unapplied, so a file that does two things can leave the schema in a state no release
  expects.

## Verify before merging

1. **Apply from zero against a fresh local database**, which proves the file works on an
   empty schema rather than only on top of your working copy:
   `rm -rf .wrangler/state/v3/d1 && npm run db:migrate:local`
   (Docker: `docker compose down -v && docker compose up -d`.)
2. `npm test`. `src/stats.js` and the frontend modules are pure, so they catch shape changes.
3. Start the app and exercise the pages that read the changed table.
4. **Run the previous release's code against the new schema.** `git stash` the code change,
   keep the migration applied, and use the app. This is the window, reproduced on purpose —
   the step that is easiest to skip and the only one that tests what the ordering actually
   does.
5. `npx wrangler d1 migrations list DB --remote`, so you know what the merge will apply.

## Checklist for the pull request

```markdown
- [ ] Additive only — no DROP, RENAME or re-type in this release
- [ ] Any new NOT NULL column has a DEFAULT
- [ ] Applies from zero on a fresh local database
- [ ] `npm test` passes
- [ ] Previous release's code runs against the new schema (step 4)
- [ ] `d1 migrations list --remote` shows what this merge will apply
```

## When it goes wrong

**Write a forward fix.** Once applied, a migration is recorded in the `d1_migrations` table;
editing or deleting the file changes nothing about the database, and leaves the repo
describing a schema that does not exist. Add a new migration instead.

**Time Travel is data recovery, not a migration rollback.**
`npx wrangler d1 time-travel restore DB --bookmark=<id>` rewinds the *entire* database to a
point in time — every rating cast since that moment goes with it, and `d1_migrations` rewinds
too, so the bad migration re-applies on the next deploy. Run
`npx wrangler d1 time-travel info DB` to see the current bookmark and what retention this
account actually has, **before** there is a reason to need it.
