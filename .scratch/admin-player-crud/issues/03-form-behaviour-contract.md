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
