# The contract

The route and form behaviour settled by [03](../03-form-behaviour-contract.md), written as
the thing [05](../05-handoff-spec.md) folds into `spec.md`. The *reasoning* is in
[decisions.md](decisions.md); this file is the what, not the why.

Line references are to the code as it stands on `main` at 2026-10-11.

## Routes

All four sit behind the existing admin gate (`src/worker.js:113`), which answers `403` for
a missing or non-admin token and is unchanged by this contract.

### `POST /api/admin/players`

Creates a Player. Exists today (`src/worker.js:145`); this changes it.

| | |
|---|---|
| Body | `name`, `game`, `real_name`, `faction`, `style`, `form`, `notes` |
| Required | `name`, `game` — after trimming, so `"   "` is absent |
| Ignored | `slug`, `id`, `active`, `created_at`, `updated_at` |
| Success | `201` + the full profile, exactly as today |

- **The slug is derived server-side from `name` and nothing else**: `uniqueSlug(db, name)`.
  The `b.slug ||` fallback at `src/worker.js:149` is **removed**. No client supplies,
  predicts or displays a slug before the response arrives.
- `uniqueSlug()` keeps suffixing silently. After unique names it can only fire for two
  genuinely *different* names that slugify alike (`Flash!` and `Flash`), which is not the
  duplicate-Player case and needs no error.
- Writes `created_at` and `updated_at` explicitly, both `CURRENT_TIMESTAMP`, one statement
  (decision 14, settled on [02](../02-migration-shape.md)).
- Writes `form`, which the current `INSERT` does not name.

### `PUT /api/admin/players/:slug`

Replaces a Player's editable columns. New.

| | |
|---|---|
| Body | the same seven fields as `POST` |
| Required | `name`, `game` |
| Ignored | `slug`, `id`, `active`, `created_at`, `updated_at` |
| Success | `200` + the full profile, same shape as `POST` |

- **Full replace, not a patch.** An absent field is written as `''`, never read as
  "unchanged". There is no partial update and no `PATCH`.
- **Writes `updated_at = CURRENT_TIMESTAMP` on every call**, including one that changes
  nothing. One `UPDATE`, no read-back, no diff.
- Does **not** filter `active`. Finds the Player by `slug` alone.
- The response is what the form repaints from — the server's row, not the client's
  optimism.

### `DELETE /api/admin/players/:slug`

Destroys a Player, their Ratings and their cached aggregates. New. Irreversible
(decision 2).

| | |
|---|---|
| Body | none. No `confirm` echo — the typed-slug guard is a UI mechanic, not an API one |
| Success | `200 {slug, ratings: n}` — `n` is what was actually destroyed |
| Cascade | `ratings` **and** `player_stats` — `ON DELETE CASCADE`, backed by a trigger |

- `n` is counted in the same statement batch as the delete, before it, so the number
  reported is the number removed.
- `n` counts **all** rows including flagged ones, because the cascade takes those too.
- Does **not** filter `active`.

### `GET /api/players`

Gains one column. Public, unchanged otherwise.

- **`ratings`** — a flat `count(*)` over that Player's rows via a left join, **including
  flagged**. Serves the roster rail's per-row count, the form's read-only Ratings cell and
  the delete guard's number, from one source.
- Not added to `profiles()`. A second, differently-computed count beside
  `community.n`/`professional.n` — which exclude flagged rows (`src/worker.js:214`) — is
  the confusion this column exists to end.

## Rejections

| Case | Status | Body |
|---|---|---|
| `name` or `game` missing | `400` | `name and game are required` |
| Any field over its cap | `400` | `<field> must be <n> characters or fewer` |
| `name` already taken | `409` | `A player called <name> already exists` |
| Slug not found (`PUT`, `DELETE`) | `404` | `Player not found` |
| No/!admin token | `403` | `Admin authentication required` — unchanged |
| Expired token | `401` | unchanged |

### Caps, and what happens at the boundary

**Over-length is a `400`. Nothing is truncated silently.** `text()`'s `.slice(0, max)`
(`src/worker.js:261`) is replaced at the route boundary by a helper that trims and rejects,
naming the field and its limit so the admin can shorten it and save again. `text()` stays
for values no user typed.

| Field | Cap | Source |
|---|---|---|
| `name` | 80 | today's, unchanged |
| `real_name` | 120 | today's, unchanged |
| `game` | 80 | today's, unchanged |
| `faction` | 80 | today's, unchanged |
| `style` | 250 | was 200 (decision 13) |
| `form` | 250 | new (decision 13) |
| `notes` | 250 | was 1000 (decision 13) |

Every one of these is also the input's `maxlength`, so in a browser the `400` never fires.
It exists for the case where the two drift apart, and for anything that is not the form.

### Duplicate names

**`name` is unique across the roster, case-insensitively**, enforced by
[`0006_player_name_unique.sql`](../../../../migrations/0006_player_name_unique.sql). `POST` and `PUT` both wrap
their write in the `UNIQUE`-catch already used for invite codes (`src/worker.js:166`) and
answer `409`; without it the route returns a bare `500`.

Unique **globally**, not per `game`: `filterPlayers()` searches the whole roster, so
per-game uniqueness would not fix the confusion it exists to fix.

### `game` is trimmed and never normalised

Decision 11's split-roster risk (`StarCraft: Brood War` vs `Starcraft: Brood war`) is held
off by the `/api/games` datalist and the field's hint, and by nothing else. Case-folding
would make the display name wrong; matching case-insensitively and rewriting the admin's
input silently is the failure mode the `400` above exists to reject. If the datalist proves
insufficient the answer is a merge tool, not a normaliser.

## The form

### Where the draft lives

**`data.playerForm`**, a plain object in `public/app/main.js`, written by one new branch in
the existing `input` handler (`data-player-field` → store the value, do not render) and
read by the view as `value="${esc(...)}"`.

This is not polish. `render()` replaces `root.innerHTML` wholesale
(`public/app/main.js:66`) with a caret-restore for `#search` alone, and `#search` calls
`go()` on every keystroke (`public/app/main.js:193`). Decision 3 makes that search the only
way to pick the next Player. So without the draft in `data`, half-filling a Player and
typing three letters to find the next one destroys everything typed — no error, no token
involved. The same object carries the pending message and a `saving` flag.

### What each answer does

| Answer | What the form does |
|---|---|
| `201` create | Selection jumps to the returned slug; mode flips `NEW PLAYER` → `EDITING` in place; *Created BoxeR at `/boxer`* |
| `200` save | Stays on the Player; *Saved.*; fields repaint from the response |
| `200` delete | Selection → `null` (decision 9); roster refetched, since the row is gone |
| `400` | Message beside the action row; **the form is untouched** so the field can be corrected and saved again |
| `409` | Same; *A player called Flash already exists.* |
| `404` | *That player no longer exists. The roster has been reloaded.* Selection → `null`, roster refetched — the same landing as a successful delete, because the end state is identical |
| `401` | Today's behaviour: session cleared, page thrown back to Players, draft lost |

Messages go beside the controls that caused them, under the action row, scrolled into view
below ~900px (settled on [01](../01-admin-page-layout.md)).

### The slug is never shown before it exists

No slug field, no live preview, no collision hint in create mode. It first appears in the
success message naming it, and thereafter as the read-only monospace chip in edit mode,
where decision 7's immutability hint lives. **01's four lines of preview copy are
withdrawn.** The browser does not reimplement `slugify()`.

### Three small guarantees

- **Switching Selection discards the draft silently.** No confirm dialog — clicking
  through the roster is the common case and the ergonomics variant A was chosen for.
  "New player" (decision 4) clears it the same way.
- **The submit control is disabled while a save is in flight**, re-enabled in both
  branches. Otherwise a double-click on `Create player` makes BoxeR and BoxeR-2 — the
  duplicate-Player failure this ticket opened with, arriving through the button.
- **A `401` loses the draft and nothing rebuilds it.** Accepted: the expired-token case is
  rare, and sign-in moves to Discord (`accounts/01`) where the page is left anyway. 01's
  *everything you typed is still here* is withdrawn.

## What the build session must prove

- **The cascade still holds through the route.** Delete a Player and assert zero rows
  remain in `ratings` **and** `player_stats` for that `player_id`, flagged rows included.
  The schema already guarantees it twice over — `ON DELETE CASCADE` plus the trigger in
  `0005` — and both were proven against SQLite directly
  ([tickets/02](tickets/02-prove-the-cascade-is-enforced.md)); this asserts the route does
  not undo it.
- **The caps hold.** 250 survives, 251 is a `400`, and `style`, `form` and `notes` agree.
  No test asserts any cap today.
- **The 409 fires**, on create and on rename.
- **`updated_at` moves** on a `PUT` that changes nothing.

## Not decided here

- **The per-player ratings rows.** 01's `▸ 12 ratings about BoxeR` disclosure ships showing
  the count from `/api/players` and a link into the global table. The rows behind it have
  no endpoint and get one of their own:
  [tickets/01](tickets/01-per-player-rating-rows-have-no-endpoint.md).
- **`updated_at` is exposed nowhere.** Not in `PLAYER_COLUMNS`, not in any response. The
  column is written and read by nothing, which is the map's audit-trail fog.
- **Rate limiting.** [04](../04-destructive-routes-and-rate-limiting.md), untouched: the
  decision against a body `confirm` means the API has no second factor at all, so 04
  decides exactly what it already said it decides.
