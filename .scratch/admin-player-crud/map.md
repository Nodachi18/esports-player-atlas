# Admin Player CRUD

Label: `wayfinder:map`

## Destination

A handoff-ready spec for the admin area's player management: one form that creates,
updates and deletes a Player, filled from the Selection and the header search, plus the
`form` column decided and written as a migration that a build session applies.

**No admin code is written in this map**, and no migration is applied from it. The spec
and the migration file are the deliverable.

## Notes

Single-page frontend at `public/index.html` served by Workers Assets; API at `/api/*` in
`src/worker.js` over D1. Glossary: `CONTEXT.md` at the repo root. Admin is a shared key,
not an Account, and stays that way for this effort.

Every decision ticket calls the `grilling` and `domain-modeling` skills. The layout ticket
also calls `frontend-design` and `prototype`. There are **no research tickets**: nothing
on this map depends on a fact from outside this working directory.

### Vocabulary this map fixes

**Selection** — the Player currently chosen in the UI, carried as `state.player` in
`public/app/state.js` and as `?player=` in the URL. *Not* to be confused with
`players.active`, a column meaning "not retired" which this map leaves vestigial
(decision 5). The phrase "active player" is ambiguous in this repo and is avoided.

### Standing decisions from charting (2026-10-11)

1. The destination is a spec to hand off, plus one decided migration. Plan, don't build.
2. **Delete is a hard delete.** The row goes, and `ratings.player_id ON DELETE CASCADE`
   takes that Player's Ratings with it, irreversibly, on a live public site.
   `wrangler rollback` restores code, never rows. Recommended against during charting and
   chosen anyway; recorded here so the build session does not relitigate it.
3. **One global Selection**, shared with the public Players page. `?page=admin&player=boxer`
   is the edit link; `?page=admin` is the create form. The admin page reuses the existing
   header search rather than carrying a picker of its own.
4. **One form, mode derived from the Selection.** No Selection: empty fields, Create. A
   Selection: loaded fields, Save and Delete. A "New player" control exists and its only
   job is to clear the Selection.
5. **`players.active` stays, untouched and vestigial.** Every read still filters `active=1`
   and nothing will ever write it. D1 is forward-only, so dropping a column four queries
   filter on is a flag-day change for no gain. Exposing it as a visibility checkbox is
   out of scope: it would reintroduce the soft delete decision 2 rejected, under another
   word.
6. **The API grows real verbs**: `PUT /api/admin/players/:slug` and
   `DELETE /api/admin/players/:slug`. The current GET/POST-only API is what create-and-rate
   happened to need, not a convention worth preserving.
7. **The slug is immutable after create.** It is the Player's public identity and sits in
   every shared URL. The form shows it as read-only text. `uniqueSlug()` keeps deriving it
   from the name at create time.
8. **Delete is guarded by typing the slug.** A dialog naming the Player and the exact count
   of Ratings that will be destroyed, with a Delete control that stays disabled until the
   slug is typed exactly. A dialog dismissable with a reflexive Enter is not a guard, and
   decision 2 leaves no second line of defence.
9. **The Selection resets to `null` after a delete**, which `DEFAULT_STATE` already defines
   as "whichever is top-ranked".
10. **The admin picker lists from `/api/players`**, unranked and unfiltered, so this effort
    does not wait on `frontend/01` — the ranked strip drops unrated Players, which would
    make a Player unselectable the moment an admin created it.
11. **`game` is a free-text input backed by a `/api/games` datalist.** A hard select makes
    a second game impossible without a code change; raw text makes
    `Starcraft: Brood war` split the roster invisibly.
12. **Admin only.** A Professional editing their own Player is out of scope: it cannot be
    honestly specified against an Account model that does not exist yet.
13. **The `form` column is carried by this map**, absorbed from `player-profiles/01`. One
    `TEXT NOT NULL DEFAULT ''` alongside `style`. Form is editorial free text and is never
    computed from Ratings; the glossary entry in `CONTEXT.md` says so.

## Decisions so far

<!-- one line per closed ticket, then follow the link for the detail it holds -->

- **The admin page is a roster rail beside the form.** The header search filters the rail,
  "New player" is a pinned row at its head, the stat cards shrink to a totals line and the
  global ratings table stays at the bottom unchanged, joined by a per-player disclosure
  under the form. Mode is shown three ways because decision 4 derives it from state. The
  delete guard is a modal; the create form shows the slug, and its collision suffix, before
  the click. Three layouts were built and two rejected —
  [01](issues/01-admin-page-layout.md), prototype and six follow-up tickets in
  [issues/01-admin-page-layout/](issues/01-admin-page-layout/).

## Not yet specified

- **How Players arrive in bulk.** Today the roster is a seed migration (`0002_players.sql`,
  38 Liquipedia rows). Whether a working CRUD UI replaces that path, supplements it, or
  leaves it alone is unclear until the form exists and someone tries to add the 39th.
- **Concurrent or stale edits.** An admin token lives 8 hours and there is no optimistic
  locking. With one admin this is theoretical; it sharpens the moment `accounts/07`
  replaces the shared key with per-Account admin Roles.
- **What the form shows about a Player's Ratings.** The delete dialog needs a rating count
  (decision 8), which puts rating data inside the edit surface for the first time. How far
  that goes — counts only, or a link into moderation — is not yet sharp.
- **Audit trail.** Who changed what, and when. Largely meaningless while admin is a shared
  key with no identity behind it.

## Out of scope

- **Player images.** Moved out during charting. The recommendation, for whenever they
  return: **R2, uploaded through the admin form and served by the Worker at
  `/api/players/:slug/image` with immutable cache headers.** It is the only option that
  makes images creatable from the UI without a third-party request, which the privacy page
  forbids and `test/frontend.test.js:344` half-enforces. Note that test greps *static*
  sources for `https://`, so a URL column would pass it while breaking what it protects —
  a runtime same-origin assertion has to come with the feature. Stays open as
  [Add a profile image and a Form field to players](../player-profiles/01-profile-image-and-form-field.md),
  now narrowed to the image question and the rights question underneath it: whose photo is
  that, and under what licence.
- **Professional self-editing** (decision 12). Blocked behind Discord sign-in; see
  [accounts/04](../accounts/04-promote-account-to-professional.md).
- **Soft delete, and `active` as a visibility toggle** (decisions 2 and 5).
- **Editing or deleting individual Ratings.** This map's delete destroys Ratings only as a
  cascade; Rating moderation is
  [moderation/03](../moderation/03-ban-accounts-and-moderate-ratings.md).
