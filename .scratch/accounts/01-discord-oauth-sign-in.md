# Discord OAuth sign-in and sessions

Status: ready-for-human
Source: navigation-overhaul spec §10, research at ../navigation-overhaul/research/01-discord-oauth.md
Blocked by: 02

## Problem

The app has no accounts. Roles are shared secrets: one `ADMIN_KEY`, one pro invite code
where every holder counts as a single rater, and a resettable `localStorage` voter id. The
frontend already renders the signed-out shell and marks sign-in as planned.

## What to build

Authorization-code grant with the Worker as a confidential client, so no PKCE.

- `GET /api/auth/discord/start` — 302 to Discord's authorize endpoint with a signed `state`.
- `GET /api/auth/discord/callback` — exchange the code (form-encoded; JSON is not accepted),
  call `GET /users/@me`, upsert an Account keyed on the Discord snowflake, discard the
  Discord token. The app wants an identity, not API access.
- `POST /api/auth/logout` — reply with an expired cookie. JavaScript cannot clear an
  `HttpOnly` cookie, so this needs a route even though it writes nothing.

Session is an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie carrying exactly what
`signToken()` already produces. Scope is `identify` only — no `email` — which keeps personal
data out of D1.

New secrets: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, `DISCORD_REDIRECT_URI`.

Flip `ACCOUNTS_ENABLED` in `public/app/main.js` when this lands: it turns on the spec's
target-state visibility, so Rate starts prompting and Account appears.

## Why it is ready-for-human

The Discord application and its secrets can only be provisioned by the account holder. The
code is straightforward once they exist.

## Watch out

`username` is mutable and not unique — display cache only, never a join key. The snowflake
is the identity. Snowflakes encode creation time (`(id >> 22) + 1420070400000`), which is a
free account-age signal against throwaways.

A Discord account is free and several are allowed, so this clears "not trivially resettable"
and no more. That was the agreed bar.

## Done when

A visitor signs in with Discord, is recognised on return, and signs out again; an Account row
exists keyed on the snowflake; `ACCOUNTS_ENABLED` is true and the navigation matrix behaves
as spec §3 describes.
