# Write the admin player CRUD handoff spec

Type: task
Status: open
Blocked by: 01, 02, 03, 04
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
- The migrations — **three** files, not one and no longer two, staged at
  [02-migration-shape/](02-migration-shape/) (`0003_player_form.sql`,
  `0004_player_updated_at.sql`) and
  [03-form-behaviour-contract/](03-form-behaviour-contract/)
  (`0005_player_name_unique.sql`), deliberately **not** under `migrations/`, because a
  migration that reaches `main` is a migration that has been applied. The spec says where
  they go, that `git mv`-ing all three is the build session's first act, and that the
  `d1-migrations` verification checklist has not been run against any of them (02, 03).
  **`0005` is the one that can fail**: `CREATE UNIQUE INDEX` dies against existing
  duplicate names, mid-deploy. Its pre-flight query must be in the spec, not only in the
  file.
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
- The preconditions, if `04` set any — plus the one 03 set:
  **[03/tickets/02](03-form-behaviour-contract/tickets/02-prove-the-cascade-is-enforced.md)
  blocks the delete route.** Nothing in the repo sets `PRAGMA foreign_keys` and decision 2
  rests entirely on the cascade being real.
- That the cascade reaches **`player_stats` as well as `ratings`** (03). Decision 2 only
  ever named `ratings`.
- What a test has to assert. At minimum: that the Selection round-trips through the URL
  into the form, that delete is unreachable without an exact slug match, and that create
  then immediately selecting the new Player works without `frontend/01` (decision 10),
  and that the 250-character editorial cap holds for `style`, `form` and `notes` alike —
  there is no test for any cap today
  ([02-migration-shape/tickets/01](02-migration-shape/tickets/01-cap-change-has-no-test.md)).
  **03 adds four more**: that 251 characters is a `400` rather than a truncation and that
  all seven capped fields agree; that a duplicate `name` is a `409` on create *and* on
  rename; that a `PUT` changing nothing still moves `updated_at`; and that deleting a
  Player leaves zero rows in **both** `ratings` and `player_stats`, flagged rows included.

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

1. **A third migration.** `name` is now unique case-insensitively, so
   [`0005_player_name_unique.sql`](03-form-behaviour-contract/0005_player_name_unique.sql)
   joins 02's two. It is the only one of the three that can fail on apply.
2. **The slug preview is gone**, with 01's four lines of copy for it. Slug derivation is
   backend-only and the slug is first shown in the create success message.
3. **01's `401` requirement is withdrawn.** The expired-token case keeps today's behaviour
   and loses the form; the spec should not carry *everything you typed is still here*.

**What is still missing before this can be written**:
[04](04-destructive-routes-and-rate-limiting.md), the last open decision on the map. 03
touched it without deciding it — the rejected body-`confirm` means the delete route has no
second factor at all, so 04's exposure arrives undiluted.
