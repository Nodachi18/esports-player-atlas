# Lay out the admin page around the player form

Type: prototype
Status: resolved
Blocked by: —
Map: ../map.md

## Question

What does the admin page actually look like once a player form lives in it?

Today it is 17 lines: three stat cards and a ratings table behind a "Load ratings" button
(`public/app/views.js:281`). The form, the Selection it reads, and the create path all have
to find a place in that, and the page has to make its mode obvious — decision 4 means the
same form is Create or Edit depending only on whether a Selection exists, which is exactly
the kind of state that reads as a bug when it is not shown.

Produce a throwaway prototype to react to — cheap and rough, not the real implementation.
Render, side by side:

- **No Selection** — the create form, empty, and whatever tells you that is what you are
  looking at.
- **A Selection** — the same form loaded with a Player, Save and Delete present, slug shown
  read-only (decision 7).
- **The delete dialog** — naming the Player, stating the exact number of Ratings that will
  be destroyed, with Delete disabled until the slug is typed (decision 8).

Open questions the prototype should answer rather than assume: whether the stats cards and
ratings table stay above the form, below it, or move; how the header search and the form
sit together when searching is how you pick what to edit (decision 3); whether "New player"
is a button, a tab, or just the state you get by clearing the search.

Call the `prototype` and `frontend-design` skills. Note the two-tint rule from the handoff:
`--role` colours the chrome, `--lens` colours the data, and collapsing them makes an admin
see amber scores.

## Comments

**2026-10-11** — Prototype built. Everything it produced is in
[`01-admin-page-layout/`](01-admin-page-layout/): the three variants and how to run them
([prototype.md](01-admin-page-layout/prototype.md)), the design pass
([design-plan.md](01-admin-page-layout/design-plan.md)), the proposed answers
([decisions.md](01-admin-page-layout/decisions.md)) and six new tickets
([tickets/](01-admin-page-layout/tickets/)).

Running prototype: `http://localhost:8787/prototype/admin-layout` — three layouts
(roster rail / one column / mode tabs) × three states, switchable with the floating bar or
`←` `→` `1` `2` `3` `t`. Code lives at `public/prototype/` because it has to be served by
Wrangler to sit in the real header, stylesheet and fonts. **It is throwaway and `public/`
deploys to the live public site: delete `public/prototype/` before this branch merges.**

Recommendation is variant **A (roster rail)**, taking C's read-only ratings cell. Left
`claimed` rather than resolved: the ticket asked for something to react to, and the pick
is the reader's.

One live defect found on the way: `/api/admin/stats` counts players from the `ratings`
table, so the admin page's `players` card shows the number of *rated* players — 0 against
39 locally, 3 against 38 live.
[tickets/06](01-admin-page-layout/tickets/06-admin-stats-players-card-counts-rated-players.md).

## Answer

**Variant A, the roster rail**, taking C's read-only Ratings cell. Chosen 2026-10-11 after
flipping through the prototype. Reasoning and the two rejected layouts are in
[01-admin-page-layout/decisions.md](01-admin-page-layout/decisions.md).

The prototype itself is captured on the branch **`prototype/admin-page-layout`** and is
not on this one: `public/` is served to the live public site, so a throwaway admin screen
with a Delete button on it cannot sit there. To run it again:
`git switch prototype/admin-page-layout && docker compose restart atlas`, then
<http://localhost:8787/prototype/admin-layout>. Everything needed to write the spec without
it — the layout, the copy, the screenshots — is in
[01-admin-page-layout/](01-admin-page-layout/).

### The page

Two columns. A roster rail on the left, the form on the right, a totals line at the foot.

- **The rail is the result list of the header search, not a picker of its own** (decision
  3). No second search box. The rail head carries the match count — `38 of 38`, and
  `4 of 38 matching "fla"` once something is typed — which is what connects the two.
  `state.query` stays global and does not reset when the page changes; that is today's
  behaviour and nothing here needs it to change.
- **The rail lists from `/api/players`** (decision 10), unranked, with a rating count per
  row right-aligned. A player with none shows `–`, which is what makes "who still needs
  editorial text" scannable across 38 rows.
- **"New player" is a pinned row at the head of the rail**, above the roster it replaces.
  Not a tab — that is variant C, and it would reopen decision 4 by making the mode the
  control and the Selection its consequence. Not "clear the search" — invisible, and an
  empty result already shows an empty rail, so the create form would appear by accident.
  Its only job stays clearing the Selection (decision 4).

### Where today's content goes

- **The three stat cards become one totals line at the foot of the page**:
  `38 players · 39 ratings · 2 flagged`. They are site-wide totals and the page is now
  about one player; above the form they make the first thing read the least relevant thing
  on screen. Their colour is a separate problem — see tickets/01.
- **The global ratings table stays on the admin page, at the bottom, behind today's
  `Load ratings` button, unchanged.** It is how an admin finds a rating to flag
  (`POST /api/admin/ratings/flag`) and nothing else offers that yet, so this map does not
  move it. What is *new* is a per-player disclosure under the form —
  `▸ 12 ratings about BoxeR` — which is what an editor actually wants. Whether the global
  table eventually belongs to rating moderation is
  [tickets/04](01-admin-page-layout/tickets/04-where-the-global-ratings-table-goes.md).

### The form

Two fieldsets, Identity and Editorial, in a two-column grid:

- Identity: handle, real name, game (free text with a `/api/games` datalist, decision 11),
  faction.
- Editorial: style, form, notes.
- `Handle` is the label for `players.name` — the word the privacy page already uses.
- Each rule is stated once, where it bites, rather than in a legend. The exact strings
  the prototype uses are in
  [design-plan.md](01-admin-page-layout/design-plan.md#copy) and are part of the spec.

**Mode is shown three ways at once**, because decision 4 derives it from state that reads
as a bug when it is not visible: a filled `EDITING` tag or a dashed `NEW PLAYER` tag, the
handle set large beside it, and the slug as a read-only monospace chip (decision 7).

**On create the slug is derived live from the handle and shown before the click**, with
the collision made explicit: typing `Flash` shows `/flash-2` and *flash is taken, so this
becomes flash-2*. Four lines copied from `src/worker.js:261`. This is evidence for
[03](03-form-behaviour-contract.md): `uniqueSlug()` may keep suffixing silently in the API
as long as the UI stops it being silent.

### Where the server's answer goes

Beside the controls that caused it, under the action row. The form is seven fields and
fits one screen at desktop widths; below ~900px the message has to be scrolled into view.

The 401 is the case that matters and it is a requirement, not a message: *Your admin
session expired, so nothing was saved. Sign in again in the footer — everything you typed
is still here.* `signOutAdmin()` currently throws the page back to Players and would take
the form with it, so saying this means changing that. Hand it to
[03](03-form-behaviour-contract.md).

### The delete guard

A modal. The non-modal forms B and C were built and are worse: both can be scrolled away
from, leaving a half-typed confirmation in the page, which looks like progress.

- Names the player, states the exact rating count, says there is no undo and no backup.
- The button reads `Delete BoxeR and 12 ratings`, never `Confirm`.
- Delete is disabled until the slug is typed exactly (decision 8).
- `Enter` inside the confirm field is swallowed. The focused control is `Keep BoxeR`, so a
  reflexive Enter cancels. Escape cancels too, because cancelling is safe.
- **The zero-rating case needs its own sentence** — *They have no ratings yet, so nothing
  else goes with them* — or the guard reads as a lie for 31 of the 38 players.

The count the guard states has no endpoint behind it today. That is
[tickets/03](01-admin-page-layout/tickets/03-rating-counts-have-no-endpoint.md), and it is
the one piece of this that blocks the build.

### What this ticket does not decide

Mobile beyond "it stacks". How far rating data goes into the edit surface beyond one
read-only cell. Whether this UI replaces the seed migration as the way players arrive.
All three stay fog on the map.

### Opened from here

Six tickets in [01-admin-page-layout/tickets/](01-admin-page-layout/tickets/). None of them
blocked this ticket. One of them —
[03](01-admin-page-layout/tickets/03-rating-counts-have-no-endpoint.md) — blocks
implementing decision 8, and one —
[06](01-admin-page-layout/tickets/06-admin-stats-players-card-counts-rated-players.md) — is
a live defect found on the way: `/api/admin/stats` counts players from the `ratings` table,
so the admin page reports the number of *rated* players under the label `players`.
