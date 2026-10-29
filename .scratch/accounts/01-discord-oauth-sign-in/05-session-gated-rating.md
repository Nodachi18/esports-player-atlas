# Session-gated rating, and /api/auth/me

Status: ready-for-agent
Part of: [../01-discord-oauth-sign-in.md](../01-discord-oauth-sign-in.md)
Blocked by: 02, 04

## Problem

`submitRating` identifies a community rater by a string the browser generated and sends in
the body — a voter id that resets in two clicks. Until that changes, a signed-in visitor and
an anonymous one are the same thing to the database, the published medians stay decoration,
and the privacy page cannot honestly say a rating is attributable.

Decided during planning: **there are no anonymous votes any more.**

## What to build

**`GET /api/auth/me`** — `200` either way. Signed out: `{ account: null }`. Signed in:
`{ account: { username, global_name, role } }` and nothing else — no snowflake, no avatar,
no `exp`. A `401` on every anonymous page load would be a misleading status on what is a
page-load probe, not a protected resource.

**`POST /api/ratings`, community panel** — requires the session cookie. No cookie, or a
cookie that does not verify as kind `'session'`, is `401`. Then:

- `voter_hash` becomes `sha256('account:' + snowflake)`, replacing
  `sha256('community:' + voter)`.
- `account_id` is written alongside it, from the account row.
- The `voter` body field is gone. Reject it being absent rather than falling back. The
  client half — `voterId()` in `public/app/api.js` and the `body.voter` line in `main.js` —
  is [06](06-the-signed-in-shell.md)'s, and the privacy page is already published saying
  that token no longer exists. Until both halves land, the two are out of step.

**The professional panel is untouched.** It keeps its bearer token and
`sha256('pro:' + invite.id)`. Nothing can create a professional account until
[../04-promote-account-to-professional.md](../04-promote-account-to-professional.md), which
is queued behind this whole set — gating the professional path here would leave no route at
all to a professional rating.

## Watch out

- Read the session from the cookie; keep the bearer header working for everything that uses
  it today. This adds a path, it does not replace one.
- `voter_hash` stays the unique key. `UNIQUE (player_id, panel, voter_hash)` is what still
  enforces one rating per player per panel, and the `409` branch in `submitRating` is
  unchanged. `account_id` is for finding an account's ratings later — terms rule 9 requires
  a blocked account's ratings to leave the aggregates, and
  [../../moderation/03-ban-accounts-and-moderate-ratings.md](../../moderation/03-ban-accounts-and-moderate-ratings.md)
  will want an index, not a recomputed hash.
- Two identities, two namespaces: a legacy `community:` hash and a new `account:` hash never
  collide. Not that it matters after [02](02-accounts-schema-and-the-flush.md) empties the
  table, but the prefix is why it would have been safe anyway.
- `SameSite=Lax` is the CSRF defence for this route: it excludes cross-site `fetch()`, so a
  cross-origin `POST /api/ratings` carries no cookie.

## Done when

`/api/auth/me` answers in both states, a community rating without a session is `401`, a
rating with one writes a hash derived from the snowflake and a populated `account_id`, the
professional path behaves exactly as before, and `npm run check` passes.
