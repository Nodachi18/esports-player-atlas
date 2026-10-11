# Decide whether delete ships before the admin login is rate-limited

Type: grilling
Status: resolved
Blocked by: —
Map: ../map.md

## Question

This map adds an irreversible, cascading delete behind an admin login that throttles
nothing.

`POST /api/admin/login` has no rate limiting — that is
[moderation/01](../../moderation/01-rate-limit-admin-login.md), still open — and the login
form sits in the footer of every page on a live, public, unauthenticated site. Today the
worst an attacker who guesses `ADMIN_KEY` can do is flag ratings, create players and mint
invite codes. After this map, it is destroying the roster and every Rating on it, with no
restore path: decision 2 is a hard delete and D1 migrations are forward-only.

The decision: does `DELETE /api/admin/players/:slug` ship only after `moderation/01` lands,
or does it ship with it and accept the window? Options worth weighing rather than assuming:

- Sequence it — this map's spec declares `moderation/01` a prerequisite for the delete
  route alone, while create and update ship freely.
- Ship together and raise `moderation/01`'s priority in the handoff, which currently sits
  below Discord sign-in.
- Decide the exposure is acceptable for a prototype with disposable data, and say so
  explicitly on the map rather than by omission.

Not a dependency the tracker can express as a blocking edge, because `moderation/01` is not
a ticket on this map. Whatever is decided goes in the spec as a stated precondition.

## Answer

**Decided 2026-10-12 by grilling, three rounds.** The rule is
[04-destructive-routes-and-rate-limiting/rate-limit.md](04-destructive-routes-and-rate-limiting/rate-limit.md),
written as [05](05-handoff-spec.md)'s input. The reasoning, including the two premises this
ticket was built on that turned out to be false, is in
[decisions.md](04-destructive-routes-and-rate-limiting/decisions.md).

### None of the three options

The ticket asked whether the delete waits for
[moderation/01](../../moderation/01-rate-limit-admin-login.md), ships beside it, or ships
with the exposure declared acceptable. All three are ways of managing a *gap* between the
delete landing and the limit landing. **There is no gap worth managing**: the limit is
fifteen lines, so it goes in this map's own spec and ships in the same build session.
`moderation/01` closes as delivered here.

The map's **no admin code is written in this map** rule survives — this is still a spec.
What widens is the spec's *scope*, deliberately and in writing. The alternative was
shipping an irreversible cascading delete naked to preserve a map boundary.

### What made it fifteen lines

The [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
went **GA 2025-09-19**: no KV, no D1, no Durable Object, no provisioning call, no extra read
per request. Five lines in `wrangler.jsonc`, ten in `src/worker.js`. Needs Wrangler ≥ 4.36.0;
this repo is on 4.149.0. **Nothing here waits on a human** — `namespace_id` is an integer
you pick.

`moderation/01` describes the in-Worker option as *"More code, more reads per request,
backed by D1 or a KV namespace."* That was true when it was written and is not true now.

### Two premises that were wrong

**1. "No restore path" is false.** Decision 2 and `HANDOFF.md` both reason from
`wrangler rollback`, which restores code and never rows — correct, and not the whole story.
**D1 Time Travel** restores the database to any minute in the last **7 days** on this
account's free plan, automatically, with no setup. The worst case stops being "the roster
is gone forever" and becomes "someone has to notice within a week".

It is a floor, not a backup strategy — a destructive whole-database overwrite, so
recovering one Player reverts every Rating since. **Nothing is built on it**: no
monitoring, no scheduled export, no runbook beyond the one command. It matters
documentarily, because two files currently assert the opposite and a build session would
believe them. Both corrected. Decision 2, the typed-slug guard and everything downstream
stand unchanged.

**2. `moderation/01`'s cheap option does not exist here.** Its "Cloudflare WAF
rate-limiting rule — no code, no state" is zone-scoped, and
`www.esports-player-atlas.workers.dev` is not a zone on this account; `workers.dev` is
Cloudflare's. There is no WAF surface to attach a rule to without buying and onboarding a
custom domain. That ticket could not be left open in any form without misleading whoever
picked it up.

### The rule

`POST /api/admin/login` **only**. Keyed on `CF-Connecting-IP`, **fail open** when the header
is absent (production always has it; `wrangler dev` does not). **Counting failed attempts
only** — `.limit()` sits in the failure branch, after the key check, so a correct login
never spends budget and an attacker spends it every time. **5 per 60 seconds** (`period`
takes 10 or 60 and nothing else). Refused with
`429 { error: 'Too many attempts. Please try again shortly.' }` — no numbers in the copy, no
`Retry-After`, rendered by the footer form exactly as today's `401` is.

`ADMIN_KEY` was generated with a password generator. So the limiter is **not** what is
holding the door; the key is. It is hygiene and a tripwire, and at fifteen lines it does
not need a threat model to justify it — which is why the numbers are loose and the scope is
one endpoint.

A browser-supplied key was considered and rejected: a script costs nothing to omit the
field, and under fail-open an omitted key is no limit at all, so browser pinning would stop
exactly the attacker it was built for and inconvenience only the admin. A constant fallback
key was rejected for the opposite reason — one shared bucket anyone can empty to lock the
admin out of their own site.

### Three things left unlimited, on purpose

- **`DELETE` itself.** Argued for: a login limit does nothing against a *leaked* key, and
  3/60s turns wiping 38 Players from ten seconds into thirteen minutes. Rejected: the
  binding is per-colo and eventually consistent, so a distributed attacker multiplies the
  limit by the locations they reach. The honest second factor is a separate
  `ADMIN_DELETE_KEY`, which reopens the body `confirm` [03](03-form-behaviour-contract.md)
  rejected to keep the API slim. **So the exposure 03 handed here undiluted stays
  undiluted** — a holder of a valid admin token can still walk `/api/players` and delete the
  roster. What changed is that getting that token by guessing is now throttled, and the
  result is recoverable for seven days.
- **`POST /api/pro/verify`.** The weaker of the two guessable endpoints — invite codes
  default to 96 random bits but `src/worker.js:157` accepts an admin-supplied code at ≥ 8
  characters, and `PRO-DEMO-2026` is published in this repo. Left alone because
  [accounts/05](../../accounts/05-retire-pro-invite-surface.md) deletes the surface once
  Discord sign-in lands. Named rather than left silent.
- **`/api/auth/*`.** `moderation/01` asked for it; the routes do not exist. Now a line item
  on [accounts/01](../../accounts/01-discord-oauth-sign-in.md).

### It ships without a test, and the spec says so

Nothing in this repository boots the Worker or makes a request — `test/stats.test.js` and
`test/frontend.test.js` both import modules and assert on pure functions. Six `curl`s go in
the spec's done-when instead, and the second half is the half that matters: after six wrong
keys return `429`, the **right** key must still return `200` inside the same minute.

Whether the binding works under `wrangler dev` is undocumented either way; the build
session verifies it rather than assuming.

### Opened from here

One ticket,
[tickets/01](04-destructive-routes-and-rate-limiting/tickets/01-no-worker-level-test-harness.md),
**blocking nothing**. Its real argument is not the limiter: **four of 05's required route
assertions are unwritable for the same reason** — the `409` on a duplicate name, the `400`
at 251 characters, the `PUT` that moves `updated_at`, and the cascade leaving zero rows.

### 05 is unblocked

04 was its last open dependency, and the map's frontier is now empty.
