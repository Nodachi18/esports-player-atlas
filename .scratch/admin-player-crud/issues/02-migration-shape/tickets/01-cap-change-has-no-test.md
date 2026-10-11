# Narrowing the notes cap is a silent data loss with no test behind it

Type: task
Status: resolved
Blocked by: —
Map: ../../../map.md

## Question

[02](../../02-migration-shape.md) sets one editorial cap of **250** for `style`, `form` and
`notes`. For `notes` that is a narrowing, from 1000.

It is safe *today*: the live database holds 38 players with `max(length(notes)) = 0`, so
there is nothing to truncate. It stops being safe the moment an admin writes a long note
under the old cap and saves it again under the new one, because `text()`
(`src/worker.js:261`) truncates with `.slice(0, max)` and returns, silently. No error, no
warning, and the row is overwritten with the short version.

That window exists if the cap change ships *after* the form does, or if any note is written
between now and the change landing. Nothing in `test/` asserts any cap at all —
`frontend.test.js` and `stats.test.js` do not touch `text()`.

So:

- Does the 250 cap ship **in the same release** as the form, closing the window by
  construction? That is the cheap answer and the recommendation.
- What does the API do at the boundary — keep truncating, or reject with a 400? This is
  the same question [03](../../03-form-behaviour-contract.md) carries for the route
  contract; decide it once, there.
- Whatever is decided, a test has to assert it. At minimum: a value at 250 survives, a
  value at 251 does whatever was decided, and all three fields agree.

Re-check `max(length(notes))` against the live database before assuming the window is
still empty.

## Answer

**Resolved 2026-10-11: there is nothing to lose, so the narrowing ships as decided.**

Every editorial field in the database is seed data and every one of them is empty. Checked
against the live database the same day:

```
players 38 · max(length(style)) 0 · max(length(notes)) 0
```

`0002_players.sql` says why, and says it on purpose: *style and notes are intentionally
empty: the source list has no equivalent field.* So the 1000 → 250 narrowing on `notes`
cannot truncate anything, because no `notes` value exists to truncate. The data-loss case
this ticket was opened for is empty, not merely unlikely.

The window it worried about — a long note written under the old cap and silently shortened
on its next save — needs an admin edit surface to open it, and that surface is what this
map is still specifying. The cap and the form arrive together.

### What does not close with it

Two things outlive this ticket and are already carried elsewhere, so they are not dropped:

- **What `text()` does at the boundary** — truncate silently, as today, or reject with a
  400 — is a route-shape question and sits on
  [03](../../03-form-behaviour-contract.md).
- **A test asserting the cap** is on [05](../../05-handoff-spec.md)'s list of what a test
  has to assert. Still true that nothing in `test/` asserts any cap today.

Re-check `max(length(notes))` before reopening this on the strength of the original
argument; it is only correct while that number is 0.
