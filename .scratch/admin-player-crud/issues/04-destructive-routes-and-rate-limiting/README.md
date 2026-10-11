# 04 — Destructive routes and rate limiting

Everything that came out of [the ticket](../04-destructive-routes-and-rate-limiting.md).

| File | What it holds |
|---|---|
| [rate-limit.md](rate-limit.md) | The rule itself: binding, config, code shape, what is *not* limited, how to verify it. **This is what [05](../05-handoff-spec.md) folds into `spec.md`** |
| [decisions.md](decisions.md) | Why it has this shape, including the two premises the ticket was built on that turned out to be false |
| [tickets/](tickets/) | New work this ticket uncovered |

The ticket's `## Answer` is the short form. Read [rate-limit.md](rate-limit.md) to build
from, [decisions.md](decisions.md) to argue with.

## The answer, in one line

**None of the ticket's three options.** The delete does not wait for a prerequisite and
does not ship exposed: the rate limit is fifteen lines, so it goes in **this map's spec**
and ships in the same build session.
[moderation/01](../../../moderation/01-rate-limit-admin-login.md) closes as delivered here.

## Two premises a reader is likely to arrive carrying the old version of

Both are written down in files still on `main`, in the voice a build session trusts. They
are named here rather than left to be rediscovered.

1. **The delete is not unrecoverable.** `map.md` decision 2 says "irreversibly … with no
   restore path" and `HANDOFF.md` says "nothing restores them". Both reason from
   `wrangler rollback`, which restores code and never rows — true, and not the whole story.
   **D1 Time Travel** restores the database to any minute in the last **7 days** on this
   account's free plan, automatically, with no setup:
   `npx wrangler d1 time-travel restore esports-player-atlas --timestamp=<unix>`.

   It is a floor, not a backup strategy: a destructive whole-database overwrite, so
   recovering one Player reverts every Rating since that minute. Cheap today at 3 ratings
   site-wide; not cheap forever. **Nothing is built on it** — no monitoring, no scheduled
   export. Both files are corrected; the typed-slug guard and every other decision stand
   exactly as they were.

2. **moderation/01's cheap option does not exist for this deployment.** It offers a
   Cloudflare WAF rate-limiting rule — "No code, no state". Rate limiting rules are
   **zone**-scoped, and `www.esports-player-atlas.workers.dev` is not a zone on this
   account. There is no WAF surface to attach a rule to without buying and onboarding a
   custom domain. Its other option, the in-Worker throttle, is described as "backed by D1
   or a KV namespace" — also stale.

## The fact that collapsed the question

The [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
went **GA 2025-09-19**: no KV, no D1, no Durable Object, no provisioning, no extra read per
request. Five lines in `wrangler.jsonc`, ten in `src/worker.js`. Wrangler ≥ 4.36.0 required;
this repo is on 4.149.0.

All three of the ticket's options were answers to "how do we manage the gap between the
delete shipping and the limit landing". At fifteen lines there is no gap worth managing.

## The rule, in full

| | |
|---|---|
| Limited | `POST /api/admin/login` **only** |
| Key | `CF-Connecting-IP`, **fail open** when absent (local dev) |
| Counted | **failed attempts only** — `.limit()` after the key check, so a correct login never spends budget |
| Limit | 5 per 60 seconds (`period` takes 10 or 60 and nothing else) |
| Refused with | `429 { error: 'Too many attempts. Please try again shortly.' }` — no numbers in the copy, no `Retry-After` |
| Not limited | `DELETE`, `/api/pro/verify`, `/api/auth/*` |
| Privacy page | unchanged — the limiter writes nothing to D1 |
| Waiting on a human | **nothing**; `namespace_id` is an integer you pick |

`ADMIN_KEY` was generated with a password generator, confirmed during this session. So the
limiter is **not** what is holding the door — the key is. It is hygiene and a tripwire, and
at this price it does not have to earn its place with a threat model. That is why the
numbers are loose and the scope is one endpoint.

## Three things deliberately left unlimited

- **`DELETE` itself** — argued and rejected. The binding is per-colo and eventually
  consistent, so it is a speed bump an attacker multiplies by the number of Cloudflare
  locations they reach, against a threat (a *leaked* key) a strong key does not cover. The
  real second factor would be a separate `ADMIN_DELETE_KEY`, which reopens the body
  `confirm` [03](../03-form-behaviour-contract.md) rejected.
- **`POST /api/pro/verify`** — the weaker of the two guessable endpoints
  (`src/worker.js:157` takes an admin-supplied code at ≥ 8 characters), left alone because
  [accounts/05](../../../accounts/05-retire-pro-invite-surface.md) deletes the surface once
  Discord sign-in lands. Named rather than left silent: "we rate-limited the admin login"
  should not read as "guessing is solved".
- **`/api/auth/*`** — the routes do not exist. moderation/01's one surviving instruction,
  now a line item on
  [accounts/01](../../../accounts/01-discord-oauth-sign-in.md).

## It ships without a test, and the spec says so

Nothing in this repository boots the Worker or makes a request — both suites import modules
and assert on pure functions. Six `curl`s go in the spec's done-when instead
([rate-limit.md](rate-limit.md#what-the-build-session-must-prove)), and the second half
matters more than the first: after six wrong keys return `429`, the **right** key must
still return `200` inside the same minute, which is what proves only failures are counted.

The harness is [tickets/01](tickets/01-no-worker-level-test-harness.md), and it **blocks
nothing**. Worth reading anyway: four of 05's required route assertions are unwritable for
the same reason, which is a far better argument for it than this.

## Tickets opened from here

- [01 — Nothing in this repository tests a route](tickets/01-no-worker-level-test-harness.md)
  — blocks nothing. Collects the five assertions this map needs and cannot write.

## Notes written back onto other files

- [05 — handoff spec](../05-handoff-spec.md): unblocked — **04 was its last open
  dependency**. [rate-limit.md](rate-limit.md) is a new section of `spec.md`; the test list
  grows one manual item and the scope note grows one line.
- [map.md](../../map.md): decision 2 amended (Time Travel), one line under Decisions so
  far, one line under Out of scope for the endpoints left unlimited.
- [moderation/01](../../../moderation/01-rate-limit-admin-login.md): **resolved**,
  delivered here, body rewritten so it stops advertising an option that does not exist.
- [accounts/01](../../../accounts/01-discord-oauth-sign-in.md): one line — the same binding
  covers `/api/auth/*` when those routes are written.
- [HANDOFF.md](../../../HANDOFF.md): "nothing restores them" corrected, moderation/01 off
  the by-value list, two new traps (WAF is zone-scoped; Time Travel exists).
