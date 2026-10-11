# Decide what the migration adds

Type: grilling
Status: open
Blocked by: —
Map: ../map.md

## Question

Decision 13 puts one column in this map's migration: `form TEXT NOT NULL DEFAULT ''`,
editorial free text beside `style`. Is that the whole migration?

The candidate that is not yet decided is `updated_at`. `players` has `created_at` and
nothing else; an edit UI that can rewrite every field of a row without recording that it
happened is a gap you only notice later, and the column is as cheap as `form`. Against it:
nothing reads it, nothing displays it, and `players` has survived without it.

Also settle, because they are schema questions and this is the only migration this map
produces:

- Whether `form` wants a length cap at the API layer like `style` (200) or `notes` (1000).
- Whether anything else the form will edit lacks a column. Walk the field list against
  `migrations/0001_init.sql` rather than against what the current form renders.

This migration will be applied unseen — CI runs it on push to `main`, and `npm run deploy`
runs it from a laptop, in both cases *before* the new code is live. The `d1-migrations`
skill fires on any edit under `migrations/` and its rules apply here. Adding a nullable or
defaulted column to `players` is the safe shape; confirm nothing in the plan drifts off it.
