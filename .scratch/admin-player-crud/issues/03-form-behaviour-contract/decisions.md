# Why the contract has this shape

The argument behind [contract.md](contract.md), kept as it was made. Reached by grilling on
2026-10-11, six rounds. The decision itself is the `## Answer` on
[the ticket](../03-form-behaviour-contract.md).

Two answers in round 4 reversed three earlier ones. That is recorded here rather than
tidied away, because the reversed versions are the ones a reader is likely to arrive
carrying — [01](../01-admin-page-layout.md)'s answer still describes a live slug preview
that no longer exists.

## The three facts that decided more than they look like

**`render()` replaces the whole document.** `root.innerHTML = …` at
`public/app/main.js:66`, with a caret-restore special case for `#search` and nothing else.
Anything typed into any other field is destroyed by any re-render.

**`#search` re-renders on every keystroke.** `public/app/main.js:193`. Combined with
decision 3 — the roster rail *is* the header search's result list — this means the admin's
central loop, fill a Player then search for the next, destroys the draft on the first
keypress. This was found while answering a question about expired tokens and turned out to
have nothing to do with tokens.

**The aggregate `n` is not the cascade count.** `refreshStats()` summarises unflagged rows
only (`src/worker.js:214`), so `community.n + professional.n` understates what a delete
destroys by exactly the flagged rows. A delete guard built on it would promise to destroy
fewer Ratings than it destroys — in the direction that matters, since flagged rows are the
ones an admin has already looked at.

## Full replace, not a patch

A partial update needs a present-vs-absent sentinel — `{notes: ""}` clears, `{}` leaves
alone — and JSON gives one only by convention. There is exactly one client, a form that
always holds all seven fields, so the sentinel would exist to serve nobody.

Full replace also makes "what did I just save" answerable from the request alone, which
matters for a surface with no audit trail (the map's own fog) and no optimistic locking.

The server-owned fields are **ignored, not rejected**. A `400` for sending `slug` would
punish a client for echoing back a response it was given, which is the obvious way to write
one.

## `400` at the cap, not truncation

`text()` truncates with `.slice(0, max)` and returns, silently. For `notes` the 1000 → 250
narrowing makes that a *shortening* of text the admin wrote. Safe at this instant — every
editorial field in the live database is empty, checked 2026-10-11 and recorded on
[02-migration-shape/tickets/01](../02-migration-shape/tickets/01-cap-change-has-no-test.md)
— but safe by accident.

Silently storing something other than what was typed is the failure mode this map keeps
designing against: it is why the delete guard makes you type a slug, and why create reports
the slug it actually minted. Truncation is the same failure with a smaller blast radius.

The cap is extended to **every** field, not just the editorial three, because one rule is
easier to hold than two and `name` at 80 truncates just as silently as `notes` at 250.

The browser never sees the `400` — `maxlength` stops it first. That is the point: it is
there for when the two numbers drift apart, which is the only way this bites.

## The slug belongs to the server alone

**Reversed in round 4.** The earlier answer kept 01's live slug preview and let
`uniqueSlug()` suffix silently behind it, on the argument that the UI made the suffix
visible before the click.

The reversal: the slug is the record's identifier, so the logic that mints it should exist
in one place, and that place is the backend. A preview requires `slugify()` reimplemented
in the browser and kept in step with `src/worker.js:265` forever; it requires the collision
message as a second UI state; and it is still only a guess, because another tab can take
the name between the prediction and the click.

Dropping it deletes all three. The slug is reported when it becomes real — *Created BoxeR
at `/boxer`* — which is the thing the preview was approximating. The client-supplied
`b.slug` goes with it: an input nothing sends is an input nobody tests, and it is the one
field that would let two clients disagree about a Player's permanent public address.

## `name` is unique

**Reversed in round 4.** The earlier answer allowed duplicate names, reasoning that real
rosters have genuine collisions across games and that the slug preview disambiguated them.

The reversal is a search argument and it is correct: decision 3 makes the header search the
*only* way to pick a Player to edit, so two rows reading `Flash` with no visible difference
is not a cosmetic problem, it is an unusable picker. And the preview that was supposed to
disambiguate them had just been removed.

Consequences, in order:

- The `409` moves from the slug to the name. The hazard this ticket opened with — *the
  admin thinks they edited Flash and instead made a duplicate* — is now caught before a
  slug is ever derived, which is a better place to catch it than a message about a suffix.
- Slug collisions become genuinely rare: after unique names, `uniqueSlug()` can only fire
  for two different names that slugify alike, `Flash!` and `Flash`. Those are different
  Players with different handles, so silent suffixing is right for them.
- It needs a third migration, which [02](../02-migration-shape.md) had settled at two.
- **It only works because delete is hard** (decision 2). Under a soft delete a deleted
  `Flash` would hold the name forever.

Global rather than per-game, because `filterPlayers()` searches the whole roster and
per-game uniqueness would leave the confusion exactly where it was found. `COLLATE NOCASE`,
because `Flash` and `flash` in one result list is that confusion spelled differently.

The migration is the risky one on this map: `CREATE UNIQUE INDEX` **fails** against
existing duplicates, and it fails inside `npm run deploy` between `d1 migrations apply` and
`wrangler deploy` — the same window `docs/adr/0001` was written about. Verified clean
against the live database on 2026-10-11 (38 Players, no duplicate exact, case-insensitive,
or after slugification) and the file says to re-run that check rather than trust the date.

## No `confirm` in the delete body

**Proposed and rejected.** The proposal was `{confirm: "<slug>"}`, 400 on mismatch, making
decision 8's typed-slug guard a server-side fact rather than a client-side courtesy.

Rejected on the grounds that confirmation is a user-safety mechanic and the API should stay
slim. Taken, and the consequence is stated rather than buried: the API has **no** second
factor, so a guessed `ADMIN_KEY` destroys the roster by walking `/api/players` in a loop.
That is precisely the exposure [04](../04-destructive-routes-and-rate-limiting.md) exists
to decide about, arriving at 04 undiluted rather than half-mitigated — which is arguably
the cleaner input for that decision.

## The draft moves into `data`

**Raised twice.** The first time it was attached to the expired-token case and was
correctly judged an edge case not worth building for. The second time, with the
search-rerender fact attached, it was taken.

The distinction matters: a `401` mid-edit needs an 8-hour token to expire during a form
fill, and sign-in is moving to Discord anyway. A keystroke in the search box needs an admin
to use the page as designed. These are not the same risk and the first one was hiding the
second.

The fix is ~15 lines shaped exactly like the slider branch already at
`public/app/main.js:189`: store on `input`, do not render, read in the view. It is not a
framework and it is cheaper than the alternative, which is exempting the admin page from
search re-renders — a special case in `render()` that would have to be remembered by
everything added to that page afterwards.

Having it also makes the `400` path work at all. Your answer on the caps requires the admin
to correct a field and save again, which requires the form to survive a rejected save; with
the draft in the DOM, any message rendered through `render()` would wipe the field being
corrected.

So: the `401` loses the draft, and that is accepted. A keystroke does not.

## One count, one source

`/api/players` grows a flat `ratings` count including flagged rows. Not `profiles()`,
because putting a second count beside `community.n`/`professional.n` — computed
differently, meaning something else — recreates the confusion that made the column
necessary. One number serves the rail row, the form's read-only Ratings cell and the delete
guard, and they cannot disagree because there is nothing to disagree with.

The guard uses the value its rail row was rendered from rather than re-fetching. With one
admin and an 8-hour token the stale case is theoretical, and `DELETE` returns what it
actually destroyed, so a stale guard becomes a visible discrepancy afterwards instead of a
silent one.

This resolves
[01/tickets/03](../01-admin-page-layout/tickets/03-rating-counts-have-no-endpoint.md),
including its last question — the count includes flagged rows, because the cascade does.

## `404`, and why delete is not idempotent

A `DELETE` on a slug that is already gone answers `404`, not `200`. The REST-flavoured
argument for idempotence is that the caller's desired end state is satisfied either way,
but the caller here is an admin who typed a slug into a guard to destroy something, and
"there was nothing there" is information they should have. The UI lands them where a
successful delete lands them, because the end state really is identical; the status still
tells the truth about what happened.

## The admin routes ignore `active`

Every read filters `active=1`. Decision 5 keeps the column vestigial: nothing will ever
write `0`, and it survives only because dropping a column four queries filter on is a
flag-day change for no gain.

Honouring it in a *write* path would give it meaning back — a row with `active=0` would be
invisible to the form while still holding its slug and, now, its name. The admin surface
should see what is actually in the table.

## What was considered and is not here

- **A `PATCH` route.** No client wants one. See full replace, above.
- **Normalising `game`.** See [contract.md](contract.md); the datalist and the hint are the
  whole defence, stated as a decision rather than left as an omission.
- **A uniqueness check on `name` in application code** rather than an index. Loses the race
  and would have to be written twice, once per route.
- **Reading the row before a `PUT`** to decide whether `updated_at` moves. Buys a truer
  timestamp, for a column nothing surfaces, at the cost of a second query on every save.
- **Per-player drafts** kept across Selection changes. A cache with no invalidation story.
