# Skill: writing a D1 migration that is safe to auto-apply

Status: resolved
Source: deployment spec, accepted risk — CI applies migrations without review

## Outcome — 2026-10-10

`.claude/skills/d1-migrations/SKILL.md`. Model-invoked, so it fires on an edit under
`migrations/` without anyone remembering it exists.

Scope grew after [02](02-ci-test-and-deploy.md) landed: the migrate-then-deploy ordering
moved into `npm run deploy`, so the skill covers manual deploys as well as CI.

Everything it claims was run against this project first: applying from zero after
`rm -rf .wrangler/state/v3/d1`, `d1 migrations list --remote`, and `d1 time-travel info`.
Two things that came out of checking rather than from the ticket:

- The applied-migration record lives in a `d1_migrations` table on the database, which is
  why editing the file after the fact changes nothing.
- Time Travel rewinds `d1_migrations` along with everything else, so a restore past a bad
  migration re-applies it on the next deploy — and takes every rating since with it. It is
  data recovery, not a rollback, and the skill says so.

The retention window is not stated as a number: the docs search did not return one, so the
skill tells you to run `d1 time-travel info DB` against this account instead of trusting a
figure that may be wrong.

## Why

CI applies `db:migrate:remote` on every push to `main`, before the deploy. Nobody sees the
migration run. A deploy can be undone with `wrangler rollback`; **a migration cannot be
undone at all** — D1 migrations are forward-only, so the only fix is another migration.

The guardrail therefore has to sit at authoring time. A skill is the right shape: it loads
when someone is about to write a migration, not after CI has already applied it.

## What the skill must cover

**When it triggers.** Creating or editing anything in `migrations/`, or changing a column a
query reads.

**The ordering fact that drives every rule.** Migrations run *before* the deploy, so for the
window between the two the **old code runs against the new schema**. Everything below
follows from that.

**Rules:**

- Additive only. `ADD COLUMN` with a default, `CREATE TABLE`, `CREATE INDEX`.
- Never `DROP`, `RENAME` or re-type a column in the same release as the code change. Removal
  takes two releases: stop reading it and deploy, then drop it in a later migration.
- A new `NOT NULL` column needs a default, or the insert the old code is still running will
  fail.
- No destructive `UPDATE` or `DELETE` without saying in the PR what is lost and why it is
  acceptable.
- One concern per migration file. A failed migration leaves everything after it unapplied.

**How to verify before merging** — the part the request specifically asked for:

1. `npm run db:migrate:local` against a fresh local database, confirming it applies cleanly
   from zero rather than only on top of your working copy.
2. `npm test` — `src/stats.js` and the frontend modules are pure, so they catch shape changes.
3. Start the app and exercise the pages that touch the changed table.
4. **Run the previous release's code against the new schema.** This is the step everyone
   skips and the one the ordering makes mandatory. `git stash` the code change, keep the
   migration, and check the app still works.
5. `npx wrangler d1 migrations list --remote` before merging, so you know what is pending.

**A checklist to paste into the PR description**, short enough that people actually tick it.

**What to do when it goes wrong.** Write a forward fix; do not try to revert the file, since
the migration is already recorded as applied. Check what D1 Time Travel retention this
account actually has *before* needing it.

## Where it goes

`.claude/skills/<name>/SKILL.md`, following the repo's existing skills. Consult
`mattpocock-skills:writing-for-agents` when writing it — the description line is what decides
whether it loads at the right moment, and a skill that does not trigger is worth nothing.

## Done when

The skill exists, triggers on an edit to `migrations/`, and a new migration written by
following it survives step 4 above.
