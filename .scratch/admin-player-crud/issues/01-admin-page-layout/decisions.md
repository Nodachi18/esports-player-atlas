# What the prototype answers

**Decided 2026-10-11: variant A.** What follows is the reasoning that produced that pick,
kept as written. The decision itself, with the details it grew when it was taken, is the
`## Answer` on [the ticket](../01-admin-page-layout.md) — read that first; this is the
argument behind it, including the two layouts that lost.

## Recommendation

**Variant A (roster rail) as the base, with two borrowings from the others.**

Take from C: the read-only `Ratings` cell inside the form.
Take from B: nothing structural — but see "the message" below, which B gets right and A
only gets away with.

### Why A

The admin's actual work is not editing one player they already had in mind. It is going
through a roster where **34 of 38 rows have no `style` and no `notes`**, and where a new
`form` column starts empty on all 38. That job needs the roster on screen: which row is
next, which are done, which have ratings attached. A shows it; B hides it behind a search
you have to already know the answer to; C shows it but then pushes it off screen with a
drawer.

A also keeps the roster visible *during* an edit, so clicking the next player is one
click, not a search and a click. Over 38 rows that is the whole ergonomics of the thing.

### Why not B

B is the better-looking page and the worse tool. Its one-column form at 720px leaves half
of a 1440px screen empty while the thing the admin needs — the list — is not rendered at
all. It wins on exactly one point, below.

### Why not C

Two problems, one of them a conflict with the map.

1. **It contradicts decision 4.** Decision 4 derives the mode from the Selection; C makes
   the mode a tab you pick and the Selection follows it. That is a defensible design, and
   it is the clearest of the three about which mode you are in — but it is a *different*
   decision, and taking it means reopening 4 rather than implementing it.
2. The drawer is cramped. Three columns of inputs inside a table row, with the roster
   pushed down below the fold, and a save message that scrolls away.

C's roster table is the best of the three at one thing — a `Form` column lets you see at a
glance which players still need editorial text — which is worth remembering when the
roster grows past a scrollable rail.

## The three open questions

### Do the stats cards and the ratings table stay above the form?

**No. Both move, and neither belongs above the form.**

The cards are site-wide totals; the page is now about one player. Above the form they make
the first thing you read the least relevant thing on screen. Put them in a single totals
line at the foot of the page: `38 players · 39 ratings · 2 flagged`. Same three numbers,
one line, no cards.

The global ratings table stops being the admin page's main content. Under the form, a
disclosure scoped to the selected player — `▸ 12 ratings about BoxeR` — is what an editor
actually wants. Where the *global* table goes is a real gap:
[tickets/04](tickets/04-where-the-global-ratings-table-goes.md).

### How do the header search and the form sit together?

**The header search filters the rail. The rail has no search box of its own.**

This works, and it honours decision 3 without leaving the admin without a roster — the
rail is the result list, not a second picker. Two caveats the prototype exposed:

- Nothing on screen says the header search is what filters the rail. The prototype papers
  over it with a line of help text; that is a fix, not a design.
  [tickets/05](tickets/05-search-does-two-jobs.md).
- `state.query` is shared with the Players page, so a search typed on Admin follows you
  back to Players. That is consistent with one global Selection and is probably right, but
  it is a behaviour nobody decided.

### Is "New player" a button, a tab, or clearing the search?

**A button — specifically, a pinned row at the head of the roster it replaces.**

- **Not a tab.** That is variant C, and it contradicts decision 4.
- **Not "clear the search".** Invisible, undiscoverable, and clearing a search that
  matches nothing already shows an empty rail, which would make the create form appear by
  accident.
- A row at the top of the list reads as "one more thing you can pick", which is exactly
  what it is under decision 4: a control whose only job is to clear the Selection.

## Three more things the prototype settled

### Where the save result goes

Not in the ticket, but [ticket 03](../03-form-behaviour-contract.md) is blocked on it
being a question about the page.

Put it with the buttons that caused it. In A the form is seven fields and fits one screen
at desktop widths, so a message beside Save is seen. Below ~900px it is not, and the
message has to be scrolled into view — B's sticky bar is the one thing B does better than
A, and it is worth copying if the form ever grows.

The **401 mid-edit** is the case that matters, and it is a requirement rather than a
message: *Your admin session expired, so nothing was saved. Sign in again in the footer —
everything you typed is still here.* Today `signOutAdmin()` would throw the page back to
Players and discard the form, so saying this means changing that. Hand it to ticket 03.

### Create tells you the slug before it mints one

The prototype derives the slug live from the handle and shows it: `Flash` → `/flash-2`,
with *flash is taken, so this becomes flash-2.* That turns `uniqueSlug()`'s silent
suffixing from a trap into a visible fact, and it costs nothing — the derivation is four
lines copied from `src/worker.js:261`.

It does not make the create path safe (two tabs can still race), but it removes the case
ticket 03 is actually worried about: the admin who thinks they edited Flash and instead
made a second one. Hand it to ticket 03 as evidence that "keep suffixing" is acceptable
**if** the suffix is shown before the click.

### The guard holds

Decision 8 built out works, and the shape is the same in all three variants:

- `Delete BoxeR and 12 ratings`, not `Confirm`.
- Disabled until `boxer` is typed exactly.
- `Enter` in the confirm field is swallowed; the focused control is `Keep BoxeR`, so a
  reflexive Enter cancels. Escape cancels too, because cancelling is safe.
- The zero-rating case needs its own sentence — *They have no ratings yet, so nothing else
  goes with them* — or the guard reads as a lie for 31 of 38 players.

A modal (A) is the right form. The non-modal versions (B, C) are easy to scroll away from
and leave a half-typed confirmation sitting in the page, which is worse than no guard
because it looks like progress.

## What the prototype did not answer

- **Mobile.** All three were built responsive and none were designed for it. The rail
  stacks above the form below 1000px, which is adequate and not thought through.
- **How deep rating data goes into the edit surface.** C's read-only `Ratings` cell is one
  number and a date. The map's fog item — counts only, or a link into moderation — is
  untouched.
- **The 39th player.** Nothing here says whether this UI replaces the seed migration as
  the way players arrive. Still fog.
