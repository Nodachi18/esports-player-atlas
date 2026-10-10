# Make sessions revocable

Status: needs-triage
Source: navigation-overhaul spec §15, Discord OAuth research
Blocked by: ../accounts/01-discord-oauth-sign-in.md

## Problem

Sessions are stateless HMAC tokens. They are valid until they expire and cannot be called
back.

That is fine for signing out, which only has to clear the holder's own cookie. It is not
fine for banning: **a banned account keeps full access until its cookie lapses.** Ban was
one of the three things the admin role was defined to do, so "ban" currently means "ban,
eventually".

## What to build

A `token_version` integer on the Account row, included in the signed payload and compared on
every authenticated request. Banning, or any forced sign-out, increments it and every
outstanding token for that account stops verifying immediately.

## The cost, stated plainly

One D1 read per authenticated request, where there are currently none — the whole point of a
stateless token is that it verifies with no lookup. Public reads are unaffected; this only
touches requests that carry a session.

## Recommendation

Ship sign-in stateless with a short TTL, and do this as part of the first ticket that
actually implements banning rather than speculatively. Recorded here so that ticket inherits
it instead of discovering it.

## Done when

Incrementing an account's `token_version` locks that account out on its next request.
