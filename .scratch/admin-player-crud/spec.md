# Admin player CRUD

Status: `ready-for-agent`
Map: [map.md](map.md) — closed by this spec
Written: 2026-10-12, from [issues/05-handoff-spec.md](issues/05-handoff-spec.md)

Everything here is decided. A build session implements it without reopening any of it.
Where a section folds in a file written as spec input, the file is named — read it only if
you want the argument behind the decision, not to find out what the decision is.

## Problem Statement

The Admin can create Players and nothing else.

`POST /api/admin/players` exists; there is no update and no delete anywhere in the API, so
a typo in a handle is permanent and a Player created by mistake stays on a live public
site forever. The Admin page is seventeen lines — three stat cards and a global Ratings
table behind a *Load ratings* button — and has no form in it at all.

Two things make that worse than it sounds:

- **34 of 38 Players have no `style` and no `notes`.** The roster is editorially empty,
  and the only way to fill it is to recreate rows, which changes their slugs and breaks
  every shared link.
- **There is no column for Form at all.** The glossary defines it; the schema has nowhere
  to put it.

## Solution

One form on the Admin page that creates, updates and deletes a Player, with the roster
visible beside it.

The form's mode is derived from the Selection, not picked: no Selection means an empty
Create form, a Selection means a loaded Save-and-Delete form. The header search filters a
roster rail on the left, and clicking a row is how the next Player is picked — so
`?page=admin&player=boxer` is the edit link and `?page=admin` is the create form, and both
are shareable.

Delete is a hard delete, guarded by typing the slug exactly. The schema gains the one
column the form needs (`form`), an `updated_at` to go with it, a trigger that makes the
delete cascade unconditional, and a unique index on the handle. `POST /api/admin/login`
gains a rate limit, in the same build session, so the delete does not arrive behind a
login that throttles nothing.

## User Stories

1. As an Admin, I want to correct a typo in a Player's handle, so that the public roster
   does not carry my mistake forever.
2. As an Admin, I want the Player's slug to stay the same when I fix their handle, so that
   links already shared keep working.
3. As an Admin, I want to write a Player's `style`, `form` and `notes` after creating
   them, so that the 34 empty rows can be filled without recreating anything.
4. As an Admin, I want a Form field on the Player, so that I can record where a Player
   stands competitively without it being confused with a computed score.
5. As an Admin, I want the roster on screen while I edit, so that I can see which Player
   is next and which ones still need editorial text.
6. As an Admin, I want a rating count beside each roster row, so that I can see at a
   glance who has Ratings attached and who does not.
7. As an Admin, I want to type in the header search and have the roster rail filter, so
   that finding a Player among 38 is one action and not two.
8. As an Admin, I want the rail to tell me how many rows match, so that I know the search
   is what is filtering it.
9. As an Admin, I want to click a roster row and have the form load that Player, so that
   working through the roster is one click per Player.
10. As an Admin, I want a *New player* control, so that I can get back to an empty create
    form without clearing a search and guessing.
11. As an Admin, I want the page to say whether I am creating or editing, so that a form
    whose mode comes from state does not read as a bug.
12. As an Admin, I want the slug shown as read-only text while editing, so that I know a
    Player's public address and know I cannot change it.
13. As an Admin, I want the slug reported back to me when a Player is created, so that I
    learn the address the server minted.
14. As an Admin, I want `game` to offer the games already in use while still letting me
    type a new one, so that a second game does not need a code change and a typo does not
    split the roster invisibly.
15. As an Admin, I want a half-filled form to survive me typing in the header search, so
    that picking the next Player does not destroy what I have typed.
16. As an Admin, I want to be told when a handle is already taken, so that I do not
    silently create a second Player with the same name.
17. As an Admin, I want an over-long field rejected with the field named, so that I can
    shorten it and save again instead of discovering later that it was cut off.
18. As an Admin, I want my edit to repaint from what the server stored, so that what I see
    is the row and not my own optimism.
19. As an Admin, I want to delete a Player who should never have existed, so that the
    public roster is correct.
20. As an Admin, I want the delete dialog to name the Player and the exact number of
    Ratings it destroys, so that I know the size of what I am doing.
21. As an Admin, I want the delete dialog to say so explicitly when a Player has no
    Ratings, so that the warning is not a lie for the 31 Players who have none.
22. As an Admin, I want Delete disabled until I type the slug exactly, so that a reflexive
    keypress cannot destroy a Player.
23. As an Admin, I want Enter and Escape in that dialog to cancel rather than confirm, so
    that the safe action is the reflexive one.
24. As an Admin, I want the button to read *Delete BoxeR and 12 ratings* rather than
    *Confirm*, so that the control says what it does.
25. As an Admin, I want deleting a Player to take their Ratings and their cached scores
    with them, so that no dead Player's numbers survive to be inherited by a new row.
26. As an Admin, I want to land somewhere sensible after a delete, so that the page is not
    pointing at a Player who no longer exists.
27. As an Admin, I want a Player I just created to be immediately selectable, so that I
    can write their editorial text in the same sitting.
28. As an Admin, I want a double-click on *Create player* to create one Player, so that
    the button does not produce `BoxeR` and `BoxeR-2`.
29. As an Admin, I want the server's answer to appear beside the control that caused it,
    so that I do not have to hunt for whether the save worked.
30. As an Admin, I want a rejected save to leave my form untouched, so that I can fix one
    field rather than retype seven.
31. As an Admin, I want editing a Player to record when it happened, so that "edited since
    it was made" is a fact the database holds.
32. As an Admin, I want a wrong admin key to stop working after a handful of attempts, so
    that the login is not an unlimited guessing surface.
33. As an Admin, I want my own correct key to keep working while someone else is being
    throttled, so that the limiter does not lock me out of my own site.
34. As a visitor, I want a Player's page to keep working at the same address after an
    Admin edits them, so that a link I was sent still resolves.
35. As a visitor, I want not to see two Players with the same handle, so that the roster
    is readable.
36. As the next build session, I want the migrations staged outside `migrations/` with
    their reasoning in the files, so that I apply them deliberately and do not delete the
    trigger as redundant.

## Implementation Decisions

### Scope note: this spec contains the rate limit, and that is deliberate

The map's rule — **no admin code is written in this map** — holds: this is a spec and the
migrations, not an implementation. What widened is the spec's *scope*. The delete route
would otherwise arrive behind a login that throttles nothing, and the fix turned out to be
ten lines in `src/worker.js` and five in `wrangler.jsonc`. Splitting it into
[moderation/01](../moderation/01-rate-limit-admin-login.md) and sequencing the two made
sense when it was a bigger job in a different place; it is not any more.
`moderation/01` is closed as delivered here. See
[The rate limit](#the-rate-limit) and
[04/rate-limit.md](issues/04-destructive-routes-and-rate-limiting/rate-limit.md).

### First act: move four migrations

Four migration files are written and staged **outside** `migrations/`, because in this
repo a migration that reaches `main` is a migration that has been applied — every push
runs `d1 migrations apply` before `wrangler deploy`, and so does `npm run deploy` from a
laptop. Merging them early would put columns into production weeks before any code writes
them.

**The build session's first act is four `git mv`s:**

```sh
git mv .scratch/admin-player-crud/issues/02-migration-shape/0003_player_form.sql migrations/
git mv .scratch/admin-player-crud/issues/02-migration-shape/0004_player_updated_at.sql migrations/
git mv .scratch/admin-player-crud/issues/03-form-behaviour-contract/0005_player_delete_cascade.sql migrations/
git mv .scratch/admin-player-crud/issues/03-form-behaviour-contract/0006_player_name_unique.sql migrations/
```

Each file carries its own reasoning in comments. Read them; do not rewrite them.

| File | What it does | Why it is shaped that way |
|---|---|---|
| `0003_player_form` | `ALTER TABLE players ADD COLUMN form TEXT NOT NULL DEFAULT ''` | The only column the form's field list lacks. Editorial free text beside `style`, never derived from Ratings |
| `0004_player_updated_at` | `ADD COLUMN updated_at TEXT NOT NULL DEFAULT ''`, then backfill from `created_at` | The default is `''` and **not** `CURRENT_TIMESTAMP`: SQLite refuses a non-constant default in `ADD COLUMN` on a table with rows, so the obvious spelling passes locally against an empty database and fails against the 38 production rows mid-deploy. [`docs/adr/0001`](../../docs/adr/0001-player-updated-at-defaults-to-empty-string.md) |
| `0005_player_delete_cascade` | `AFTER DELETE` trigger on `players` clearing `ratings` and `player_stats` | **Do not delete this as redundant with the `ON DELETE CASCADE` it duplicates.** `PRAGMA foreign_keys` is per connection and nothing in this repo sets it, so the FK cascade holds only on whichever connection happens to have enforcement on. Triggers never consult the pragma. A no-op whenever enforcement is on, because the FK cascade has already run by the time it fires |
| `0006_player_name_unique` | Renames colliding handles to `<name> #<id>`, **then** `CREATE UNIQUE INDEX players_name_unique ON players(name COLLATE NOCASE)` | `CREATE UNIQUE INDEX` dies outright against existing duplicates, inside the same deploy window. The file clears its own way first, the way `0004` pairs its `ADD COLUMN` with its backfill. A no-op against today's roster — verified live 2026-10-11, 38 Players, no duplicate exact, case-insensitive or after slugification |

Two caveats that travel with them:

- **The `d1-migrations` verification checklist has not been run against any of the four.**
  They were applied and tested together from `0001` forward against SQLite 3.45.1,
  including against a roster seeded with deliberate duplicates and including the
  foreign-keys-off counterfactual — which is **not** the same thing. The skill fires on
  any edit under `migrations/`; run it.
- **Two deploy-window effects are known and accepted**, both Admin-only and minutes wide.
  A Player created by the *old* code after `0004` applies lands `updated_at = ''`; readers
  use `coalesce(nullif(updated_at,''), created_at)` rather than a second migration. And
  the old `POST` has no `UNIQUE` catch, so between `0006` applying and the new code
  deploying a duplicate handle returns a bare `500` instead of a `409`.

### The routes

Folded from [03/contract.md](issues/03-form-behaviour-contract/contract.md), which is the
authority if the two ever disagree. All four sit behind the existing admin gate
(`src/worker.js:113`), which answers `403` for a missing or non-admin token and is
unchanged.

#### `POST /api/admin/players` — changed

| | |
|---|---|
| Body | `name`, `game`, `real_name`, `faction`, `style`, `form`, `notes` |
| Required | `name`, `game` — after trimming, so `"   "` is absent |
| Ignored | `slug`, `id`, `active`, `created_at`, `updated_at` |
| Success | `201` + the full profile, exactly as today |

- **The slug is derived server-side from `name` and nothing else**: `uniqueSlug(db, name)`.
  The `b.slug ||` fallback at `src/worker.js:149` is **removed**. No client supplies,
  predicts or displays a slug before the response arrives.
- `uniqueSlug()` keeps suffixing silently. With `name` now unique it can only fire for two
  genuinely *different* names that slugify alike (`Flash!` and `Flash`), which is not the
  duplicate-Player case and needs no error.
- Writes `created_at` and `updated_at` explicitly, both `CURRENT_TIMESTAMP`, in one
  statement — SQLite evaluates it once per statement, so the two values are identical
  rather than a microsecond apart.
- Writes `form`, which the current `INSERT` does not name.

#### `PUT /api/admin/players/:slug` — new

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
- The response is what the form repaints from.

#### `DELETE /api/admin/players/:slug` — new

| | |
|---|---|
| Body | none. No `confirm` echo — the typed-slug guard is a UI mechanic, not an API one |
| Success | `200 {slug, ratings: n}` — `n` is what was actually destroyed |
| Cascade | `ratings` **and** `player_stats`, via `ON DELETE CASCADE` backed by `0005`'s trigger |

- `n` is counted in the same statement batch as the delete, before it, so the number
  reported is the number removed.
- `n` counts **all** rows including Flagged ones, because the cascade takes those too.
- Does **not** filter `active`.

#### `GET /api/players` — gains one column

- **`ratings`** — a flat `count(*)` over that Player's rows via a left join, **including
  Flagged**. One source feeding the roster rail's per-row count, the form's read-only
  Ratings cell and the delete guard's number.
- **Not** added to `profiles()`. A second, differently-computed count beside
  `community.n` / `professional.n` — which exclude Flagged rows (`src/worker.js:214`) — is
  exactly the confusion this column exists to end.

### Rejections

| Case | Status | Body |
|---|---|---|
| `name` or `game` missing | `400` | `name and game are required` |
| Any field over its cap | `400` | `<field> must be <n> characters or fewer` |
| `name` already taken | `409` | `A player called <name> already exists` |
| Slug not found (`PUT`, `DELETE`) | `404` | `Player not found` |
| No/non-admin token | `403` | `Admin authentication required` — unchanged |
| Expired token | `401` | unchanged |

**Over-length is a `400`. Nothing is truncated silently.** `text()`'s `.slice(0, max)`
(`src/worker.js:261`) is replaced at the route boundary by a helper that trims and
rejects, naming the field and its limit. `text()` stays for values no user typed.

| Field | Cap | Source |
|---|---|---|
| `name` | 80 | today's, unchanged |
| `real_name` | 120 | today's, unchanged |
| `game` | 80 | today's, unchanged |
| `faction` | 80 | today's, unchanged |
| `style` | 250 | was 200 |
| `form` | 250 | new |
| `notes` | 250 | was 1000 |

One number for the whole Editorial fieldset: two numbers for three fields of the same kind
is a distinction the form cannot show, and 1000 invites a paragraph into a short editorial
phrase. The narrowing is safe today — the live database has
`max(length(notes)) = max(length(style)) = 0`, checked 2026-10-11.

Every cap is also the input's `maxlength`, so in a browser the `400` never fires. It
exists for the case where the two drift apart, and for anything that is not the form.

**`name` is unique case-insensitively**, enforced by `0006`. `POST` and `PUT` both wrap
their write in the `UNIQUE`-catch already used for invite codes (`src/worker.js:166`) and
answer `409`; without it the route returns a bare `500`. Unique **globally**, not per
`game`: `filterPlayers()` searches the whole roster, so per-game uniqueness would not fix
the confusion it exists to fix.

**`game` is trimmed and never normalised.** The split-roster risk
(`StarCraft: Brood War` vs `Starcraft: Brood war`) is held off by the `/api/games`
datalist and the field's hint and by nothing else. Case-folding would make the display
name wrong, and rewriting the Admin's input silently is the failure mode the `400` above
exists to reject. If the datalist proves insufficient the answer is a merge tool, not a
normaliser.

### The rate limit

Folded from [04/rate-limit.md](issues/04-destructive-routes-and-rate-limiting/rate-limit.md).
Workers Rate Limiting, GA 2025-09-19: no KV, no D1, no Durable Object, no extra read per
request, no provisioning call — `namespace_id` is an integer you pick. Requires Wrangler
≥ 4.36.0; this repo is on 4.149.0. **Nothing here waits on a human.**

`wrangler.jsonc`, alongside `d1_databases`:

```jsonc
"ratelimits": [
  {
    "name": "LOGIN_LIMIT",
    "namespace_id": "1001",
    "simple": { "limit": 5, "period": 60 }
  }
]
```

`period` takes **10 or 60 and nothing else**.

| | |
|---|---|
| Endpoint | `POST /api/admin/login` (`src/worker.js:107`) — **and nothing else** |
| Key | the `CF-Connecting-IP` request header |
| Counted | **failed attempts only** |
| Limit | 5 per 60 seconds |
| Refused with | `429` + `{ error: 'Too many attempts. Please try again shortly.' }` |
| No header | **fail open** — no key, no limiting |

The shape, which encodes four decisions and is not free to rearrange:

```js
if (method === 'POST' && path === '/api/admin/login') {
  const { key } = await readJson(request);
  if (await isAdminKey(env, key)) {
    return json(200, { token: await signToken(env, { role: 'admin', exp: Date.now() + ADMIN_TOKEN_TTL }) });
  }
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip && !(await env.LOGIN_LIMIT.limit({ key: ip })).success) {
    return json(429, { error: 'Too many attempts. Please try again shortly.' });
  }
  return json(401, { error: 'Invalid admin key' });
}
```

- **`.limit()` is called after the key check, and only when it failed.** A correct login
  never spends budget, so an Admin signing in six times in a minute is never refused,
  while an attacker spends budget on every attempt.
- **The branch order is inverted from today's.** The success path returns first; written
  the other way round the `429` would sit between the `401` and its own condition.
- **The key is `CF-Connecting-IP`, not a browser-supplied value.** The edge sets it and a
  client cannot suppress it. A browser-sent key costs an attacker nothing to omit, and
  under fail-open an omitted key means no limit at all.
- **Fail open when the header is absent.** Always present in production, absent under
  `wrangler dev`. A constant fallback key would give every header-less caller one shared
  bucket, which anyone could exhaust to lock the Admin out of their own site.

**The message carries no numbers** — no count, no window, no `Retry-After`. The footer
form renders it exactly as it renders today's `401` (`ApiError` already carries the
status), so nothing new is needed in the UI.

`ADMIN_KEY` is a generated secret, so the limiter is hygiene and a tripwire rather than
the thing holding the door. **Ordering**: if the work is split across pull requests, the
limiter goes in the **first** one. It is fifteen lines and depends on nothing else here.

### The page

Variant A of the prototype, chosen 2026-10-11. Screenshots and the three variants are in
[issues/01-admin-page-layout/](issues/01-admin-page-layout/); the prototype code is on
branch `prototype/admin-page-layout` and **must not be merged or promoted** — `public/` is
served to the live public site. The winning layout is rewritten properly in
`public/app/views.js`.

Two columns: a roster rail on the left, the form on the right, a totals line at the foot.

- **The rail is the result list of the header search, not a picker of its own.** No second
  search box. The rail head carries the match count — `38 of 38`, and
  `4 of 38 matching "fla"` once something is typed — which is what connects the two.
  `state.query` stays global and does not reset on a page change; that is today's
  behaviour and nothing here needs it to change.
- **The rail lists from `/api/players`**, unranked and unfiltered, with the rating count
  per row right-aligned; a Player with none shows `–`. Deliberately not the ranked strip:
  that drops unrated Players, which would make a Player unselectable the moment an Admin
  created one, and would make this effort wait on
  [frontend/01](../frontend/01-unrated-players-in-ranked-views.md).
- **"New player" is a pinned row at the head of the rail**, above the roster it replaces.
  Not a tab — that would make the mode the control and the Selection its consequence. Not
  "clear the search" — invisible, and an empty result already shows an empty rail, so the
  create form would appear by accident. Its only job is clearing the Selection.
- **The three stat cards become one totals line at the foot**:
  `38 players · 39 ratings · 2 flagged`. They are site-wide totals and the page is now
  about one Player. Their colour is a separate problem —
  [01/tickets/01](issues/01-admin-page-layout/tickets/01-stat-cards-use-the-role-tint.md).
- **The global Ratings table stays at the bottom, behind today's *Load ratings* button,
  unchanged.** It is the only way to flag a Rating and nothing else offers that yet. New
  beneath the form is a per-Player disclosure, `▸ 12 ratings about BoxeR`, which ships
  **showing the count and a link into the global table** — the rows behind it have no
  endpoint ([03/tickets/01](issues/03-form-behaviour-contract/tickets/01-per-player-rating-rows-have-no-endpoint.md)).

### The form

Two fieldsets in a two-column grid:

- **Identity**: handle, real name, game (free text with a `/api/games` datalist), faction.
- **Editorial**: style, form, notes.
- `Handle` is the label for `players.name` — the word the privacy page already uses.
- A read-only Ratings cell in the grid, fed by `/api/players`' new `ratings` column.

**Mode is shown three ways at once**, because deriving it from state reads as a bug when
it is not visible: a filled `EDITING` tag or a dashed `NEW PLAYER` tag, the handle set
large beside it, and — in edit mode only — the slug as a read-only monospace chip.

**The slug is never shown before it exists.** No slug field, no live preview, no collision
hint in create mode. It first appears in the success message naming it, and thereafter as
the read-only chip. The browser does not reimplement `slugify()`. *(01 described a live
preview with four lines of copy; 03 withdrew it. Where 01 and 03 disagree, 03 wins —
[03/README.md](issues/03-form-behaviour-contract/README.md) lists all three places.)*

Copy, from the prototype and part of this spec. Buttons say what happens — `Save changes`,
`Create player`, `Delete BoxeR and 12 ratings`, `Keep BoxeR`. No `Submit`, no `Confirm`,
no `Are you sure?`. Hints explain a rule once, where the rule bites:

- Game — *Pick an existing game or type a new one. Spelling it differently splits the
  roster.*
- Form — *Your judgement of where they stand. Never calculated from ratings.*
- Slug — *The slug is this player's public address and is in every link ever shared. It
  cannot change.*
- The guard — *Typing the slug is the only confirmation. A dialog you can dismiss with a
  reflexive Enter is not a guard.*

#### The draft lives in `data.playerForm`, not in the DOM

A plain object in `public/app/main.js`, written by one new branch in the existing `input`
handler (`data-player-field` → store the value, do **not** render) and read by the view as
`value="${esc(...)}"`. The same object carries the pending message and a `saving` flag.

**This is not polish, and the spec says why or it reads as gratuitous.** `render()`
replaces `root.innerHTML` wholesale (`public/app/main.js:66`) with a caret-restore for
`#search` alone, and `#search` calls `go()` on every keystroke
(`public/app/main.js:193`) — and that search is the only way to pick the next Player. So
without the draft in `data`, half-filling a Player and typing three letters to find the
next one destroys everything typed: no error, no token involved, no way to get it back.

#### What each answer does

| Answer | What the form does |
|---|---|
| `201` create | Selection jumps to the returned slug; mode flips `NEW PLAYER` → `EDITING` in place; *Created BoxeR at `/boxer`* |
| `200` save | Stays on the Player; *Saved.*; fields repaint from the response |
| `200` delete | Selection → `null`; roster refetched, since the row is gone |
| `400` | Message beside the action row; **the form is untouched**, so the field can be corrected and saved again |
| `409` | Same; *A player called Flash already exists.* |
| `404` | *That player no longer exists. The roster has been reloaded.* Selection → `null`, roster refetched — the same landing as a successful delete, because the end state is identical |
| `429` | Login only. Rendered by the footer form exactly as today's `401` is |
| `401` | Today's behaviour: session cleared, page thrown back to Players, draft lost |

Messages go beside the controls that caused them, under the action row, scrolled into view
below ~900px.

**The `401` loses the draft and nothing rebuilds it.** 01's requirement — *everything you
typed is still here* — is **withdrawn and not built**. The expired-token case is rare, the
token lives 8 hours, and sign-in moves to Discord
([accounts/01](../accounts/01-discord-oauth-sign-in.md)) where the page is left anyway.

#### Three small guarantees

- **Switching Selection discards the draft silently.** No confirm dialog — clicking
  through the roster is the common case and the ergonomics variant A was chosen for.
  "New player" clears it the same way.
- **The submit control is disabled while a save is in flight**, re-enabled in both
  branches. Otherwise a double-click on *Create player* makes `BoxeR` and `BoxeR-2`.
- **A `401` loses the draft**, as above.

### The delete flow, end to end

1. The Admin selects a Player. The form loads; `Delete` sits in the action row, painted in
   the destruction colour — `#ff7a7a`, already in `styles.css` as `.result.bad`'s left
   border, promoted to a `--danger` token with `--danger-sunk: #1d0f12` behind it. It is
   neither `--role` nor `--lens`: painting destruction amber collapses chrome into data,
   and painting it `--lens` makes it look like a score. Every red pixel on the page is a
   destruction or a failure and nothing else is red.
   ([01/tickets/02](issues/01-admin-page-layout/tickets/02-a-token-for-destructive-actions.md)
   tracks promoting it to a real token.)
2. `Delete` opens a **modal**. The non-modal variants were built and are worse: both can
   be scrolled away from, leaving a half-typed confirmation in the page, which looks like
   progress.
3. The modal names the Player, states the exact Rating count from `/api/players`' new
   `ratings` column, and says there is no undo. **The zero-Rating case gets its own
   sentence** — *They have no ratings yet, so nothing else goes with them* — or the guard
   reads as a lie for 31 of the 38 Players.
4. The confirm field takes the slug. **Delete stays disabled until it matches exactly.**
   `Enter` inside the field is swallowed; the focused control is `Keep BoxeR`, so a
   reflexive Enter cancels, and Escape cancels too, because cancelling is safe.
5. The button reads `Delete BoxeR and 12 ratings`, never `Confirm`.
6. `DELETE /api/admin/players/:slug` fires with no body. The server counts, deletes, and
   returns `{slug, ratings: n}`.
7. The row goes, and with it that Player's Ratings and their `player_stats` aggregates —
   Flagged rows included, through `ON DELETE CASCADE` and `0005`'s trigger both.
8. **The Selection resets to `null`**, which `DEFAULT_STATE` already defines as "whichever
   is top-ranked", and the roster is refetched.

**On recoverability**, because two files on `main` said the opposite until 2026-10-12 and
a build session that believes the roster is unrecoverable will make different calls:
`wrangler rollback` restores code and never rows — but **D1 Time Travel** restores the
database to any minute in the last **7 days** on this account's free plan, automatically,
with no setup:
`npx wrangler d1 time-travel restore esports-player-atlas --timestamp=<unix>`. It is a
floor, not a backup strategy — a destructive whole-database overwrite, so recovering one
Player reverts every Rating since that minute, it needs a human with Wrangler
authenticated, and it expires silently after a week. **Nothing is built on it and no
decision changes**: the typed-slug guard stays the only line of defence.

### Module seams

Two new pure modules, so the rules this spec cares about are reachable by a test without
booting the Worker. Both follow the existing repo idiom — one pure module per concern
beside `ranking.js`, `state.js`, `nav.js`, `scores.js`, with the wiring in `main.js` and
the HTML in `views.js`.

**`src/players.js`** — new, pure, no `env`, no `db`:

```
CAPS = { name: 80, real_name: 120, game: 80, faction: 80,
         style: 250, form: 250, notes: 250 }

validatePlayerInput(body)
  -> { ok: true,  values }                                  // trimmed, seven fields
  -> { ok: false, status: 400, error: '<field> must be <n> characters or fewer' }
  -> { ok: false, status: 400, error: 'name and game are required' }
```

`src/worker.js` calls it at both `POST` and `PUT`, so the two cannot drift. The `409`, the
`404` and the cascade stay route-level and stay out of this module.

**`public/app/playerForm.js`** — new, pure, no DOM, no fetch:

```
formMode(selection)        -> 'create' | 'edit'
formValues(selection, draft) -> the seven field values the view renders
canDelete(typed, slug)     -> boolean, exact match only
resultFor(status, player)  -> { tone, text }   // the answer table above
```

`main.js` owns `data.playerForm` and the event wiring; `views.js` renders. Neither new
module imports the other.

## Testing Decisions

### What a good test is here

Both existing suites are the model: `node --test`, importing a module and asserting on
pure functions, with no DOM, no network and no database. `test/stats.test.js` covers
`src/stats.js`; `test/frontend.test.js` covers six modules out of `public/app/`. They
assert external behaviour — *this input produces that output* — never how a function got
there. Follow that. A test that reaches into `data.playerForm`'s internals, or asserts on
the exact HTML string a view produced beyond the fact it carries a value, is testing the
implementation.

### Say this out loud: nothing in this repository boots the Worker

`npm test` cannot assert a route. It never could, and that is not fixed here —
[04/tickets/01](issues/04-destructive-routes-and-rate-limiting/tickets/01-no-worker-level-test-harness.md)
holds the gap and blocks nothing. **Do not read a green CI run as covering a route-level
guarantee.** The two new seams above exist precisely so that most of the list below can be
a test rather than a `curl`; what is left is explicitly marked manual.

### Automated — `test/players.test.js` (new), against `src/players.js`

1. 250 characters in `style`, `form` and `notes` each survive; **251 is a `400`**, named,
   rather than a truncation. There is no test for any cap today
   ([02/tickets/01](issues/02-migration-shape/tickets/01-cap-change-has-no-test.md)), and
   `notes` is narrowing from 1000.
2. All seven capped fields agree with the table above — one assertion driven off `CAPS`,
   so adding a field without a cap fails.
3. `name` or `game` missing, or present as whitespace only, is `400 name and game are
   required`.
4. `slug`, `id`, `active`, `created_at` and `updated_at` in the body are ignored, not
   written.

### Automated — `test/frontend.test.js` (extended), against `public/app/playerForm.js`

5. **The Selection round-trips through the URL into the form**: `?page=admin&player=boxer`
   → `stateFromSearch` → `resolveSelection` → `formMode` is `edit` with BoxeR's values
   loaded, and `?page=admin` → `formMode` is `create` with empty fields.
6. **Delete is unreachable without an exact slug match.** `canDelete` is false for `''`,
   `'boxer '`, `'BoxeR'`, `'boxe'` and the Player's *name* rather than their slug; true
   only for `'boxer'`.
7. **A Player created now is immediately selectable without
   [frontend/01](../frontend/01-unrated-players-in-ranked-views.md)**: a new Player with
   no Ratings survives `buildRanking` and is findable by `resolveSelection`. This is the
   existing `ranking.js` seam and needs no new module.
8. `resultFor` maps each status to the table above — in particular that `404` and a
   successful delete produce the same landing, and that `400` and `409` do not clear the
   draft.

### Manual, after deploy — the only evidence these will have

9. **The rate limit.** Six `POST`s to `/api/admin/login` with a wrong key, then the real
   key inside the same minute:

   ```sh
   for i in 1 2 3 4 5 6; do
     curl -s -o /dev/null -w "$i %{http_code}\n" \
       -X POST https://www.esports-player-atlas.workers.dev/api/admin/login \
       -H 'content-type: application/json' --data '{"key":"wrong-key-0000000000"}'
   done
   curl -s -o /dev/null -w "admin %{http_code}\n" \
     -X POST https://www.esports-player-atlas.workers.dev/api/admin/login \
     -H 'content-type: application/json' --data "{\"key\":\"$ADMIN_KEY\"}"
   ```

   Expected `401 401 401 401 401 429`, then **`200`**. The final `200` is the half that
   matters: it proves only failures are counted. **Record the result in done-when.**
10. **The `409` fires on create *and* on rename.** Route-level; `0006` plus the `UNIQUE`
    catch, neither reachable from `npm test`.
11. **A `PUT` that changes nothing still moves `updated_at`.** Route-level.
12. **Deleting a Player leaves zero rows in both `ratings` and `player_stats`** for that
    `player_id`, Flagged rows included. The schema guarantees it twice over and both were
    proven against SQLite directly
    ([03/tickets/02](issues/03-form-behaviour-contract/tickets/02-prove-the-cascade-is-enforced.md));
    this checks the route does not undo it.
13. **Whether the `ratelimit` binding works under `wrangler dev` is undocumented.** Verify
    it locally. If it throws or no-ops, that is a local-dev caveat to write down, not a
    reason to change the design.

### Done-when

- Four migrations under `migrations/`, applied, and the `d1-migrations` checklist run.
- `npm test` green, including the two new suites above.
- The six-`curl` result from (9) recorded here or in the pull request.
- (10)–(12) checked by hand against a local database and the result stated.
- `public/prototype/` absent from the branch that merges.

## Out of Scope

Named so a build session does not rediscover them as gaps.

- **Player images.** Moved out during charting. The recommendation for whenever they
  return: **R2, uploaded through the admin form and served by the Worker at
  `/api/players/:slug/image` with immutable cache headers** — the only option that makes
  images creatable from the UI without a third-party request, which the privacy page
  forbids. Note `test/frontend.test.js:344` greps *static* sources for `https://`, so a
  URL column would pass it while breaking exactly what it protects; a runtime same-origin
  assertion has to ship with the feature.
  [player-profiles/01](../player-profiles/01-profile-image-and-form-field.md).
- **Professional self-editing.** A Professional editing their own Player cannot be
  honestly specified against an Account model that does not exist.
  [accounts/04](../accounts/04-promote-account-to-professional.md).
- **Soft delete, and `active` as a visibility toggle.** `players.active` stays, untouched
  and vestigial: every read still filters `active=1` and nothing will ever write it. D1 is
  forward-only, so dropping a column four queries filter on is a flag-day change for no
  gain, and exposing it as a checkbox would reintroduce the soft delete this map rejected
  under another word.
- **Editing or deleting individual Ratings.** This spec's delete destroys Ratings only as
  a cascade. [moderation/03](../moderation/03-ban-accounts-and-moderate-ratings.md).
- **The rows behind the per-player Ratings disclosure.** It ships as a count and a link.
  [03/tickets/01](issues/03-form-behaviour-contract/tickets/01-per-player-rating-rows-have-no-endpoint.md).
- **A second factor on `DELETE`.** The typed-slug guard stays the only one. The binding is
  per-colo and eventually consistent, so a limit there is a speed bump an attacker
  multiplies by the locations they reach — and `ADMIN_KEY` is a generated secret, so the
  threat would be a *leaked* key rather than a guessed one. An `ADMIN_DELETE_KEY` reopens
  the body `confirm` that was rejected. Reopen if the key is ever shared with a second
  person.
- **Rate limiting anything but the admin login.** `POST /api/pro/verify` stays unlimited —
  it is the weaker guessable endpoint (`src/worker.js:157` accepts an admin-supplied code
  at ≥ 8 characters, and `PRO-DEMO-2026` is published in this repo) and is left alone only
  because [accounts/05](../accounts/05-retire-pro-invite-surface.md) deletes the surface.
  `/api/auth/*` does not exist yet and is now a line item on
  [accounts/01](../accounts/01-discord-oauth-sign-in.md).
- **A route-level test harness.**
  [04/tickets/01](issues/04-destructive-routes-and-rate-limiting/tickets/01-no-worker-level-test-harness.md).
- **Exposing `updated_at`.** Written by `PUT` and `POST`, read by nothing. Not in
  `PLAYER_COLUMNS`, not in any response, not in the UI.
- **How Players arrive in bulk.** Today the roster is a seed migration. Whether a working
  CRUD UI replaces that, supplements it, or leaves it alone is unclear until someone tries
  to add the 39th.
- **Concurrent or stale edits.** No optimistic locking; an admin token lives 8 hours. With
  one Admin this is theoretical, and it sharpens when
  [accounts/07](../accounts/07-admin-accounts-replace-the-key.md) replaces the shared key.
- **Audit trail — *who* changed what.** `updated_at` settles *when*. Who is meaningless
  while Admin is a shared key with no identity behind it.
- **Mobile beyond "it stacks".** The rail stacks above the form below 1000px, which is
  adequate and was not designed.

## Further Notes

- **Vocabulary.** *Selection* is the Player currently chosen in the UI — `state.player`,
  `?player=`. It is **not** `players.active`, a column meaning "not retired". The phrase
  "active player" is ambiguous in this repo and is avoided. *Form* is editorial free text
  and is never computed from Ratings; the glossary entry in `CONTEXT.md` already says so
  and needs no edit. Full glossary: [CONTEXT.md](../../CONTEXT.md).
- **Admin stays a shared key** for this whole effort, not an Account.
- **One live defect found on the way, independent of this spec and fixable now**:
  `/api/admin/stats` counts players from the `ratings` table, so the Admin page's
  `players` card reports the number of *rated* Players — 3 against a roster of 38.
  [01/tickets/06](issues/01-admin-page-layout/tickets/06-admin-stats-players-card-counts-rated-players.md).
- **Where the global Ratings table eventually belongs** is still open —
  [01/tickets/04](issues/01-admin-page-layout/tickets/04-where-the-global-ratings-table-goes.md).
  This spec leaves it where it is.
- **Nothing on the site may load from another origin**, and a test half-enforces it. Not
  triggered by anything here, but it is the first thing images will hit.
- **Wrangler builds its asset manifest at startup**, so a new directory under `public/`
  404s until `docker compose restart atlas`.
- **Traps worth re-reading before touching the migrations**: `.scratch/HANDOFF.md`,
  especially the `ADD COLUMN ... DEFAULT CURRENT_TIMESTAMP` window and the
  `PRAGMA foreign_keys` per-connection finding. Both are the reason two of the four
  migration files are shaped the way they are.
