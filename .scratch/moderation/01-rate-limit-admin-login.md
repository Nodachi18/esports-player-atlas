# Rate-limit the admin login endpoint

Status: resolved
Resolved by: ../admin-player-crud/issues/04-destructive-routes-and-rate-limiting.md (2026-10-12)
Source: navigation-overhaul spec §11, README pre-production list

> **Delivered by the admin-player-crud map, not by this ticket.** The rule is specified in
> [admin-player-crud/04/rate-limit.md](../admin-player-crud/issues/04-destructive-routes-and-rate-limiting/rate-limit.md)
> and ships in that map's `spec.md`. **The body below has been rewritten**, because the
> original recommended an option that does not exist for this deployment and mis-costed the
> one that does. Read
> [04/decisions.md](../admin-player-crud/issues/04-destructive-routes-and-rate-limiting/decisions.md)
> for why it moved rather than waited.

## Problem

`POST /api/admin/login` accepted unlimited attempts. Nothing throttled, delayed or locked
out, and since the navigation overhaul the admin key field sits in the footer of every page
of a live public site, which advertises the endpoint rather than hiding it.

What already protected it, and still does: the key is at least 16 characters, is a
generated secret, and is compared as a SHA-256 digest in constant time. The limiter is
hygiene on top of that, not the thing holding the door.

## Why this closed here instead of being built here

**The two options this ticket offered were both wrong.**

- **The Cloudflare WAF rate-limiting rule does not exist for this deployment.** Rate
  limiting rules are *zone*-scoped, and `www.esports-player-atlas.workers.dev` is not a
  zone on this account — `workers.dev` is Cloudflare's. There is no WAF surface to attach a
  rule to without buying and onboarding a custom domain. "No code, no state" was not
  available at any price under one.
- **The in-Worker option is not "more code, more reads per request, backed by D1 or a KV
  namespace".** The [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
  went GA on 2025-09-19: no KV, no D1, no Durable Object, no provisioning call and no extra
  read per request. Five lines of config and ten of code.

At that size there was nothing left to sequence against the admin-player-crud map's
irreversible delete, so the limit went into that map's spec and ships in the same build
session.

## What was specified

`POST /api/admin/login` only. Keyed on `CF-Connecting-IP`, fail open when the header is
absent. **Counting failed attempts only**, so a correct login never spends budget. 5 per 60
seconds. Refused with `429 { error: 'Too many attempts. Please try again shortly.' }`.

Full rule, including the code shape and the manual verification that replaces a test:
[rate-limit.md](../admin-player-crud/issues/04-destructive-routes-and-rate-limiting/rate-limit.md).

## What did not come with it

- **`POST /api/pro/verify`** stays unlimited, and is the weaker of the two guessable
  endpoints — `src/worker.js:157` accepts an admin-supplied invite code at ≥ 8 characters.
  Left alone because [accounts/05](../accounts/05-retire-pro-invite-surface.md) deletes the
  surface once Discord sign-in lands.
- **`/api/auth/*`** — this ticket's *"apply it to `/api/auth/*` too once sign-in exists"*
  is now a line item on [accounts/01](../accounts/01-discord-oauth-sign-in.md), where those
  routes get written. The same binding covers them; it is one more `.limit()` call.
- **A test.** Nothing in this repository boots the Worker, so the limiter ships verified by
  six `curl`s against production and nothing else.
  [04/tickets/01](../admin-player-crud/issues/04-destructive-routes-and-rate-limiting/tickets/01-no-worker-level-test-harness.md).
