# Write the admin player CRUD handoff spec

Type: task
Status: resolved
Blocked by: — (was 01, 02, 03, 04; all resolved 2026-10-12)
Map: ../map.md

## Question

Fold the map's standing decisions and every resolved ticket into
`.scratch/admin-player-crud/spec.md`, complete enough that a build session implements it
without reopening any of these questions.

It has to carry:

- The two new routes, their request and response shapes, and their failure modes (03).
  **Written already**, as
  [03-form-behaviour-contract/contract.md](03-form-behaviour-contract/contract.md) — fold
  it in rather than re-deriving it.
- The migrations — **four** files, not one and no longer two, staged at
  [02-migration-shape/](02-migration-shape/) (`0003_player_form.sql`,
  `0004_player_updated_at.sql`) and
  [03-form-behaviour-contract/](03-form-behaviour-contract/)
  (`0005_player_delete_cascade.sql`, `0006_player_name_unique.sql`), deliberately **not**
  under `migrations/`, because a migration that reaches `main` is a migration that has been
  applied. The spec says where they go, that `git mv`-ing all four is the build session's
  first act, and that the `d1-migrations` verification checklist has not been run against
  any of them (02, 03). All four have been applied and tested together against SQLite
  3.45.1, which is not the same thing as that checklist.
- The form: fields, modes, the read-only slug, the datalist on `game`, and the layout the
  prototype settled (01) — **as amended by 03**, which withdrew the live slug preview and
  the `401` draft-preservation requirement. Where 01 and 03 disagree, 03 is later and wins;
  [03-form-behaviour-contract/README.md](03-form-behaviour-contract/README.md) lists the
  three places that happens.
- That the form's draft lives in `data.playerForm` and not in the DOM (03). The spec has to
  say why, or it reads as gratuitous: `render()` replaces `root.innerHTML` wholesale and
  the header search re-renders on every keystroke, so a DOM-held draft dies the moment the
  admin searches for the next Player.
- The delete flow end to end, including the typed-slug guard and where the Selection lands
  afterwards (decisions 8 and 9).
- The preconditions, if `04` set any. **03 set none**: the cascade question it raised was
  resolved in the schema rather than left as a gate
  ([03/tickets/02](03-form-behaviour-contract/tickets/02-prove-the-cascade-is-enforced.md)).
  **04 set none either, and instead handed over a section.**
  [04-destructive-routes-and-rate-limiting/rate-limit.md](04-destructive-routes-and-rate-limiting/rate-limit.md)
  is a new part of `spec.md` — the rate limit on `POST /api/admin/login`, which this map now
  carries rather than waiting on
  [moderation/01](../../moderation/01-rate-limit-admin-login.md) for. Fold it in the way
  [contract.md](03-form-behaviour-contract/contract.md) is folded in, and carry its
  "Ordering" line: if the build session splits this across pull requests, the limiter goes
  in the first one.
- That the cascade reaches **`player_stats` as well as `ratings`** (03) — decision 2 only
  ever named `ratings` — and that it holds **regardless of foreign key enforcement**,
  because `0005` backs it with a trigger. The spec should say why that trigger exists, or a
  future reader will delete it as redundant with the FK clause it deliberately duplicates.
- What a test has to assert. At minimum: that the Selection round-trips through the URL
  into the form, that delete is unreachable without an exact slug match, and that create
  then immediately selecting the new Player works without `frontend/01` (decision 10),
  and that the 250-character editorial cap holds for `style`, `form` and `notes` alike —
  there is no test for any cap today
  ([02-migration-shape/tickets/01](02-migration-shape/tickets/01-cap-change-has-no-test.md)).
  **03 adds four more**: that 251 characters is a `400` rather than a truncation and that
  all seven capped fields agree; that a duplicate `name` is a `409` on create *and* on
  rename; that a `PUT` changing nothing still moves `updated_at`; and that deleting a
  Player leaves zero rows in **both** `ratings` and `player_stats`, flagged rows included
  — the schema guarantees that twice over, so this asserts the route does not undo it.

Write down what the spec deliberately leaves out, with pointers — images, professional
self-editing, soft delete, rating moderation — so the build session does not rediscover
them as gaps. The map's Out of scope section is the source for that list.

Then close the map.

## Comments

**2026-10-11** — [03](03-form-behaviour-contract.md) resolved. Its output is written as
spec input rather than as an argument to be re-read:

- **[03-form-behaviour-contract/contract.md](03-form-behaviour-contract/contract.md)** is
  the routes section of `spec.md`, near enough verbatim — request and response shapes, the
  rejection table, the caps table, what the form does with each status, and what the build
  session must prove. Fold it in; do not re-derive it.
- [decisions.md](03-form-behaviour-contract/decisions.md) is the reasoning and belongs in
  the spec only where the spec would otherwise read as arbitrary.
- [README.md](03-form-behaviour-contract/README.md) names the three places 03 overrode 01.

**Three things changed under this ticket's feet** and the bullets above are updated for
them:

1. **Two more migrations, making four.**
   [`0005_player_delete_cascade.sql`](03-form-behaviour-contract/0005_player_delete_cascade.sql)
   makes the delete cascade independent of foreign key enforcement, and
   [`0006_player_name_unique.sql`](03-form-behaviour-contract/0006_player_name_unique.sql)
   dedupes colliding handles before creating the unique index on `name`, so neither can
   realistically fail on apply.
2. **The slug preview is gone**, with 01's four lines of copy for it. Slug derivation is
   backend-only and the slug is first shown in the create success message.
3. **01's `401` requirement is withdrawn.** The expired-token case keeps today's behaviour
   and loses the form; the spec should not carry *everything you typed is still here*.

**What is still missing before this can be written**:
[04](04-destructive-routes-and-rate-limiting.md), the last open decision on the map. 03
touched it without deciding it — the rejected body-`confirm` means the delete route has no
second factor at all, so 04's exposure arrives undiluted.

**2026-10-12** — [04](04-destructive-routes-and-rate-limiting.md) resolved. **It was the
last open dependency; this ticket is unblocked and the map's frontier is empty.**

- **The spec grows a section it did not expect to have.**
  [04/rate-limit.md](04-destructive-routes-and-rate-limiting/rate-limit.md) is written as
  spec input, not as an argument — binding, `wrangler.jsonc` config, the ten-line code
  shape, and the three endpoints deliberately left unlimited. `POST /api/admin/login` only,
  keyed on `CF-Connecting-IP`, failing open, counting failed attempts alone, 5 per 60s,
  `429`. **No precondition, no sequencing**: it ships in the same build session as the
  delete.
- **The map's "no admin code is written in this map" rule is intact but its scope widened.**
  Say so in the spec's scope note, or the rate-limit section reads as a stray.
- **Decision 2's "irreversibly" is amended on the map** and the correction belongs in the
  spec too: `wrangler rollback` restores code and never rows, but **D1 Time Travel** gives
  seven days on this account's free plan. Nothing is built on it and no decision changes —
  but a build session that believes the roster is unrecoverable will make different calls
  than one that knows it has a week, and two files on `main` currently say the former.
- **The test list grows one manual item, not a test.** Six `curl`s against production after
  deploy: five wrong keys return `401`, the sixth `429`, and then the **right** key still
  returns `200` inside the same minute — the half that proves only failures are counted.
  Record the result in done-when; it is the only evidence the limiter will have.
- **And it grows a gap worth stating.** Four of the assertions this ticket already requires
  — the `409` on a duplicate name, the `400` at 251 characters, the `PUT` that moves
  `updated_at`, and the cascade leaving zero rows — are route-level, and **nothing in this
  repository boots the Worker**. The spec should say that out loud rather than list them as
  if `npm test` could hold them.
  [04/tickets/01](04-destructive-routes-and-rate-limiting/tickets/01-no-worker-level-test-harness.md),
  blocking nothing.
- **Out of scope gains two lines**: a second factor on `DELETE` (the typed-slug guard
  stays the only one), and rate limiting anything but the admin login —
  `POST /api/pro/verify` stays unlimited because
  [accounts/05](../../accounts/05-retire-pro-invite-surface.md) deletes the surface, and
  `/api/auth/*` moved to [accounts/01](../../accounts/01-discord-oauth-sign-in.md).

## Answer

**Written 2026-10-12 as [`spec.md`](../spec.md), labelled `ready-for-agent`.** The map's
frontier was empty and all four decisions resolved, so this folded them in rather than
deciding anything new. Two things in it were not inherited from a ticket, and both are
named below.

### What it folds, and from where

- **Routes, rejections, caps and form behaviour** —
  [03/contract.md](03-form-behaviour-contract/contract.md), near enough verbatim, and
  named in the spec as the authority if the two ever disagree.
- **The rate limit** — [04/rate-limit.md](04-destructive-routes-and-rate-limiting/rate-limit.md),
  including the `wrangler.jsonc` block, the ten-line code shape with its four deliberate
  properties, the three endpoints left unlimited, and the "limiter goes in the first pull
  request" ordering line. The scope note the ticket asked for is the spec's first section,
  so the section does not read as a stray.
- **The page and the form** — [01](01-admin-page-layout.md)'s answer and
  [design-plan.md](01-admin-page-layout/design-plan.md)'s copy, **as amended by 03**: no
  slug preview, no `401` draft preservation, duplicate handles impossible.
- **The migrations** — all four, as a table of what each does and why it is shaped that
  way, with the four `git mv`s as the build session's first act, the unrun `d1-migrations`
  checklist stated, and both deploy-window residuals written down.
- **Recoverability** — decision 2's amended "irreversibly": `wrangler rollback` restores
  code and never rows, D1 Time Travel gives seven days on this account's free plan,
  nothing is built on it, no decision changes.
- **Out of scope** — the map's list, plus `updated_at` being exposed nowhere and the three
  fog items, each with a pointer.

### Two decisions this ticket made rather than inherited

The spec needed somewhere for its tests to attach, and the ticket's test list was written
against a repository where nothing boots the Worker. Rather than list eight assertions as
if `npm test` could hold them, the spec puts **two new pure modules** in — the repo's
existing idiom, one module per concern beside `ranking.js` and `state.js`:

1. **`src/players.js`** — `validatePlayerInput(body)` and a `CAPS` table, pure, called by
   both `POST` and `PUT` so the two cannot drift. This turns the 250/251 assertion, the
   seven-fields-agree assertion and the required-field assertion into real tests in a new
   `test/players.test.js`.
2. **`public/app/playerForm.js`** — `formMode`, `formValues`, `canDelete`, `resultFor`.
   Pure, no DOM. The Selection round-trip and the exact-slug guard become tests in the
   existing `test/frontend.test.js` by adding one import line.

**Four assertions stay manual and the spec says so out loud**: the `409` on create and
rename, the `PUT` that moves `updated_at`, the cascade leaving zero rows in both child
tables, and the six-`curl` rate-limit check whose final `200` is the half that matters.
That is [04/tickets/01](04-destructive-routes-and-rate-limiting/tickets/01-no-worker-level-test-harness.md),
still blocking nothing — but it is now the gap for four items rather than eight.

### The map is closed

Every decision resolved, the spec written, the four migration files staged and pointed at.
Nothing on this map is open.
