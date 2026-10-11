# Decide the form's behaviour contract

Type: grilling
Status: resolved
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

**2026-10-11** — [02](02-migration-shape.md) resolved and left three things here.

- **One editorial cap of 250** for `style`, `form` and `notes`, replacing `style` 200 and
  `notes` 1000 (`src/worker.js:151`). Nothing in the schema enforces it — SQLite `TEXT` is
  unbounded — so it is `text()` and the form's `maxlength`, and this contract is where it
  is specified.
- **What `text()` does at the boundary is yours to decide.** Today it truncates silently
  with `.slice(0, max)`. For `notes` that is now a *narrowing*, so a long note saved under
  the old cap would be silently shortened on its next save. Safe at this instant — every
  editorial field in production is empty, checked 2026-10-11 — and
  [02-migration-shape/tickets/01](02-migration-shape/tickets/01-cap-change-has-no-test.md)
  holds the rest of it, including that no test asserts any cap today.
- **`PUT` must write `updated_at`**, and it is not optional dressing: decision 14 makes it
  the column's whole contract. Every write that changes the row moves it forward; create
  writes it equal to `created_at` by naming both columns in the INSERT with
  `CURRENT_TIMESTAMP` (one statement, one value). Decide whether a `PUT` that changes
  nothing still moves it — and if partial updates are supported, whether `updated_at` is a
  field the client may send (it must not be).

## Answer

**Decided 2026-10-11 by grilling, six rounds.** The contract is
[03-form-behaviour-contract/contract.md](03-form-behaviour-contract/contract.md) — routes,
rejections, form behaviour, written as [05](05-handoff-spec.md)'s input. The reasoning,
including three answers reversed mid-session, is in
[decisions.md](03-form-behaviour-contract/decisions.md).

### The routes

`PUT` is a **full replace**, not a patch: same body as `POST`, `name` and `game` required,
absent fields written as `''`, server-owned fields (`slug`, `id`, `active`, `created_at`,
`updated_at`) ignored rather than rejected. It writes `updated_at` on **every** call,
including one that changes nothing — one statement, no diff, so decision 14 reads "every
write moves it forward". Returns `200` and the full profile.

`DELETE` takes **no body**. The typed-slug guard stays a UI mechanic; confirmation is user
safety, not an API concern. It returns `200 {slug, ratings: n}` — the count it actually
destroyed, counted in the same batch — and cascades to `ratings` **and** `player_stats`,
which decision 2 never mentioned. **That cascade no longer depends on foreign key
enforcement**: a trigger makes it unconditional (see below).

Both `404` on a missing slug, and **neither filters `active`**: decision 5's premise is
that the column means nothing, and honouring it in a write path would give it meaning back.

### The slug is the server's, alone

**This reverses the preview [01](01-admin-page-layout.md) specified.** The slug is the
record's identifier and the logic that mints it exists in the backend only. `POST` drops
the client-supplied `b.slug` (`uniqueSlug(db, name)`, not `b.slug || name`), and the form
shows **no slug at all** in create mode — no field, no live derivation, no collision hint.
It first appears in the success message, *Created BoxeR at `/boxer`*, and thereafter as the
read-only chip in edit mode. 01's four lines of preview copy are withdrawn, and `slugify()`
is not reimplemented in the browser.

### `name` is unique, and that is a third migration

**Two Players may no longer share a handle.** Decision 3 makes the header search the only
way to pick a Player to edit, so two rows reading `Flash` is not cosmetic — it is an
unusable picker, and the preview that would have disambiguated them has just been removed.

Unique **globally** (`filterPlayers()` searches the whole roster) and **`COLLATE NOCASE`**
(`Flash` beside `flash` is the same confusion), enforced by
[`0006_player_name_unique.sql`](03-form-behaviour-contract/0006_player_name_unique.sql) —
an index, because SQLite cannot add a constraint to an existing table additively. `POST`
and `PUT` both answer `409` on a taken name, wrapping their write in the `UNIQUE`-catch
already used for invite codes; without it the route returns a bare `500`.

This only works because delete is hard (decision 2): a soft-deleted `Flash` would hold the
name forever.

The `409` therefore moves **from the slug to the name**, which catches this ticket's
opening hazard — *the admin thinks they edited Flash and instead made a duplicate* —
before a slug is ever derived. `uniqueSlug()` keeps suffixing silently, because after
unique names it can only fire for two genuinely different names that slugify alike
(`Flash!` and `Flash`), which is not that hazard.

**Verified before promising it**: the live database holds 38 Players with no duplicate
name — exact, case-insensitive, or after slugification — checked 2026-10-11. The file says
to re-run that query rather than trust the date, because `CREATE UNIQUE INDEX` fails
outright against duplicates, inside `npm run deploy`, in the same window
[`docs/adr/0001`](../../../docs/adr/0001-player-updated-at-defaults-to-empty-string.md) was
written about.

### Over-length is a `400`

`text()`'s silent `.slice(0, max)` is replaced at the route boundary by a helper that trims
and rejects, naming the field and its limit so the admin can shorten it and save again. It
applies to **every** field, not just the editorial three: `name` 80, `real_name` 120,
`game` 80, `faction` 80, and 250 each for `style`, `form` and `notes` (decision 13). Those
numbers are also the inputs' `maxlength`, so a browser never sees the `400` — it exists for
when the two drift apart.

This closes what
[02-migration-shape/tickets/01](02-migration-shape/tickets/01-cap-change-has-no-test.md)
handed here: the `notes` narrowing can no longer shorten anything silently, under any
future data.

`game` is trimmed and **never normalised**. Decision 11's split-roster risk is held off by
the `/api/games` datalist and the field hint and by nothing else; rewriting an admin's
input to match an existing spelling is the same silent-substitution failure the `400`
rejects.

### The rating count, and what it resolves

`/api/players` grows **`ratings`**, a flat `count(*)` including flagged rows. One number,
one source, serving the rail's per-row count, the form's read-only Ratings cell and the
delete guard alike. Deliberately **not** added to `profiles()`: `community.n` and
`professional.n` exclude flagged rows (`src/worker.js:214`), so they understate a cascade
by exactly the rows an admin has already looked at, and a second count beside them would
recreate the confusion.

The guard reads the value its rail row was rendered from rather than re-fetching; `DELETE`
reports what it really destroyed, so a stale guard becomes a visible discrepancy instead of
a silent one.

This **resolves**
[01/tickets/03](01-admin-page-layout/tickets/03-rating-counts-have-no-endpoint.md),
including its last question — the count includes flagged rows, because the cascade does —
and unblocks decision 8.

### The form keeps what was typed, except across a `401`

**The draft lives in `data.playerForm`**, not the DOM. This is not polish: `render()`
replaces `root.innerHTML` wholesale (`public/app/main.js:66`) and `#search` calls `go()` on
every keystroke (`public/app/main.js:193`), so under decision 3 — where the rail *is* the
search's result list — half-filling a Player and typing three letters to find the next one
destroys everything typed. No error, no token involved. The fix is ~15 lines shaped like
the slider branch already at `public/app/main.js:189`, and it is also what makes the `400`
path work at all, since a message rendered through `render()` would wipe the field being
corrected.

**A `401` is the exception and loses the draft.** `signOutAdmin()` keeps today's behaviour
— session cleared, page thrown back to Players — because an 8-hour token expiring mid-fill
is genuinely rare and sign-in is moving to Discord, where the page is left anyway. **01's
requirement, *everything you typed is still here*, is withdrawn rather than built.**

Three smaller guarantees: switching Selection discards the draft silently (clicking through
the roster is the common case variant A was chosen for); the submit control is disabled
while a save is in flight, or a double-click makes BoxeR and BoxeR-2; and a `404` lands the
admin where a successful delete lands them — Selection `null`, roster refetched — while
still answering `404`, because "there was nothing there" is information an admin who typed
a slug into a guard should have.

### Where a successful save leaves you

Create sets the Selection to the returned slug, so the mode flips `NEW PLAYER` → `EDITING`
in place and create-then-edit is one motion. Save stays on the Player. Delete sets it to
`null` (decision 9) and refetches the roster, because the row is gone.

### Two more migrations, and nothing left blocking

**The cascade stops depending on a pragma.** Nothing in this repository sets
`PRAGMA foreign_keys`, and it is a *per-connection* setting — so measuring it from the CLI,
which was done and came back clean, says nothing about the Worker connection the delete
route will actually run on. Rather than carry that as a blocking ticket,
[`0005_player_delete_cascade.sql`](03-form-behaviour-contract/0005_player_delete_cascade.sql)
adds an `AFTER DELETE` trigger clearing `ratings` and `player_stats`. Triggers ignore the
pragma, so the outcome is identical either way; when enforcement *is* on the FK cascade has
already run and the trigger matches nothing. Proven with the counterfactual: foreign keys
off and no trigger leaves **2 orphan ratings and 1 orphan stat row**, which is precisely
what SQLite's rowid reuse would later hand to a newly created Player.

**The unique index moves back behind its own fix.**
[`0006_player_name_unique.sql`](03-form-behaviour-contract/0006_player_name_unique.sql)
renames colliding handles to `<name> #<id>` before creating the index, in the same file,
the way `0004` pairs its `ADD COLUMN` with its backfill. So the one migration on this map
that could fail on apply no longer realistically can. The residual is stated in the file
rather than implied, and the pre-flight query stays.

Four migrations now, applied and tested together from `0001` forward against SQLite 3.45.1,
including against a roster seeded with deliberate duplicates.

### Opened from here

Two tickets in [03-form-behaviour-contract/tickets/](03-form-behaviour-contract/tickets/),
**neither blocking**.
[02](03-form-behaviour-contract/tickets/02-prove-the-cascade-is-enforced.md) is resolved by
`0005` above — measured, then fixed in the schema so the measurement stops mattering.
[01](03-form-behaviour-contract/tickets/01-per-player-rating-rows-have-no-endpoint.md) never
blocked anything; 01's disclosure ships showing the count.

### Left to 04, undiluted

A body `confirm` echo was proposed and rejected: the API stays slim. The consequence is
stated rather than buried — the delete route has **no** second factor, so a guessed
`ADMIN_KEY` destroys the roster by walking `/api/players` in a loop. That is exactly the
exposure [04](04-destructive-routes-and-rate-limiting.md) exists to weigh, arriving there
unmitigated.
