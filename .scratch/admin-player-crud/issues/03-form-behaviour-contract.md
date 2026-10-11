# Decide the form's behaviour contract

Type: grilling
Status: open
Blocked by: 01
Map: ../map.md

## Question

What exactly do the two new routes accept and reject, and what does the form do with each
answer?

- **Required fields on update.** Create requires `name` and `game` (`src/worker.js:139`).
  Does `PUT` require them too, and is a partial update — send only what changed — supported
  or refused?
- **Silent slug collision on create.** `uniqueSlug()` turns a second "Flash" into `flash-2`
  without telling anyone. Acceptable for a public create path; for an admin tool it may be
  a bug, because the admin thinks they edited a Player and instead made a duplicate. Does
  create warn, refuse, or keep suffixing?
- **What the UI shows for 400, 401, 403 and 404.** `ApiError` already carries the status
  (`public/app/api.js`). A 401 on save means the 8-hour admin token expired mid-edit, and
  `signOutAdmin()` currently throws the page back to Players — which would discard a filled
  form. That is the ugliest case on this list.
- **What happens after a successful save.** Stay on the Player with a confirmation, or
  clear? After a successful create, does the Selection jump to the new Player (making
  create-then-edit one continuous motion) or stay empty?

Blocked by the layout ticket because half these answers are "where does the message go",
and that is a question about the page, not the contract.

## Comments

**2026-10-11** — Unblocked: [01](01-admin-page-layout.md) is resolved. It answers two of
the questions above and adds one.

- **Where the messages go**: beside the controls that caused them, under the action row,
  scrolled into view below ~900px. The 401 is a requirement rather than a message —
  *Your admin session expired, so nothing was saved. Sign in again in the footer —
  everything you typed is still here.* Today `signOutAdmin()` would throw the page back to
  Players and discard the form, so this contract has to say what replaces that.
- **Silent slug collision**: `uniqueSlug()` may keep suffixing, **provided the UI stops it
  being silent.** The prototype derives the slug live from the handle and shows
  `/flash-2` with *flash is taken, so this becomes flash-2* before the button is pressed.
  That removes the case this ticket was worried about — the admin who thinks they edited
  Flash and instead made a second one — without a new API failure mode. Two tabs can still
  race; decide whether that is worth a 409.
- **New, and this one blocks decision 8**: the guard states the exact number of Ratings
  that will be destroyed, and no endpoint returns a per-player rating count.
  `/api/players` has no count, `/api/admin/stats` is totals only, and counting
  `/api/admin/ratings` in the browser is the wrong shape for a number a destructive
  confirmation depends on. Decide it here, since it is a route-shape question:
  [01-admin-page-layout/tickets/03](01-admin-page-layout/tickets/03-rating-counts-have-no-endpoint.md).
  Note the count must include flagged rows — the cascade takes those too.
