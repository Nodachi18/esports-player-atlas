# Give players a profile image

Status: needs-triage
Source: navigation-overhaul spec §15, the broadcast-overlay reference that shaped the layout

> **Narrowed 2026-10-11.** This ticket used to cover a photo *and* a Form field *and* the
> admin editing UI for both. The Form column and all admin editing moved to
> [Admin Player CRUD](../admin-player-crud/map.md) (decision 13), which also ruled images
> out of its own scope — so what is left here is the image, and the rights question under
> it. The filename still says `and-form-field`; the content no longer does.

## Problem

The player detail was designed from a broadcast overlay carrying a photo. There is no
column for one, so the portrait renders as `planned`: a hatched frame with the player's
initial and a "Photo planned" caption. Honest, but the layout has a visible hole where a
face belongs.

## The decision this ticket holds

**Where does an image live, and how does it arrive?** The Admin Player CRUD map weighed
this during charting and recorded a recommendation rather than a ruling:

> **R2, uploaded through the admin form and served by the Worker at
> `/api/players/:slug/image` with immutable cache headers.**

The reasoning, so it does not have to be rediscovered:

| | Upload → R2 | Commit → `public/players/<slug>.webp` | URL column |
|---|---|---|---|
| An admin can do it alone | ✓ | ✗ (needs a git push and a redeploy) | ✓ |
| Request cost | Worker-served, **counts** against 100k/day | free, uncounted assets | free |
| Third-party request | none | none | **breaks the privacy page** |
| New infrastructure | R2 bucket, binding, upload route | none | none |

The URL column is the one to rule out properly. `test/frontend.test.js:344` greps *static*
sources for an `http(s)` `src`, `href` or `url()`, so `<img src="${player.image_url}">`
would **pass that test while breaking exactly what it protects** — the privacy page's claim
that nothing on this site loads from another origin. Whichever option wins, a runtime
same-origin assertion has to ship with it, because the current test cannot see a value that
only exists in the database.

## The question underneath it

**Whose photo is that, and under what licence?** The 38 seeded players come from
Liquipedia, whose text is CC BY-SA 3.0 — the roster migration attributes it. Player
photographs are not automatically covered by that, and hotlinking Liquipedia is forbidden
here anyway. Hosting someone's photograph is a different act from reproducing their name
and race, and these are real people. Answer this before building the column, not after:
an upload path with no answer to it is a moderation problem waiting to arrive.

## Done when

A player can carry a photo, an admin can set it, no placeholder is left in the detail
layout, a test asserts the rendered image is same-origin, and the licensing question above
has a written answer.
