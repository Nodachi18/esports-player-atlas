# The header search does not say it drives the admin roster

Type: task
Status: resolved
Blocked by: —
Map: ../../../map.md
Found by: ../decisions.md

## Problem

Decision 3 reuses the header search rather than giving the admin page a picker of its own.
The prototype shows that this works — the roster filters as you type — and also that
nothing on screen connects the two. The search sits in the header with the placeholder
`Search player or game`, the roster sits in the page, and the only thing linking them in
the prototype is a line of help text reading *Filtered by the search in the header*, which
is a label apologising for a layout.

Two smaller things fall out of the same decision:

- **`state.query` is global.** A search typed on Admin is still there when you go back to
  Players, and vice versa. That follows from one shared Selection and is probably right,
  but nobody decided it and the Players page silently switches its heading to `Search
  result` because of it.
- **An empty result is a different thing on each page.** On Players it means "no player
  matches". On Admin it means "no player matches, and the create form is one click away",
  which is an invitation, not an error.

## What to decide

- Whether the search placeholder changes on the admin page (`Filter the roster`), or
  whether the roster header carries the search term instead (`38 of 38` →
  `4 matching "fla"`), or both.
- What the admin page's empty-search-result state says. It is the one place in the app
  where finding nothing is a reasonable outcome.
- Whether the query should reset when the page changes. Cheap either way; decide once.

## Answer

Settled by [issue 01](../../01-admin-page-layout.md) on 2026-10-11, all three parts.

- **The roster head carries the search term, not the placeholder.** `38 of 38` becomes
  `4 of 38 matching "fla"`. The header placeholder stays `Search player or game` on every
  page, because a placeholder that changes per page is a second thing to keep true.
- **`state.query` stays global and does not reset on a page change.** That is today's
  behaviour, it follows from one shared Selection, and nothing in this map needs it to
  change. Recorded here so the build session does not treat it as an oversight.
- **An empty result on the admin page is an invitation, not an error**: *No player matches
  "xyz". Clearing the search brings all 38 back.* — with "New player" already on screen at
  the head of the rail. It is the one place in the app where finding nothing is a
  reasonable outcome.
