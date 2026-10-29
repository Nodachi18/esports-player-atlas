# The auth seams, and the tests that cover them

Status: resolved
Part of: [../01-discord-oauth-sign-in.md](../01-discord-oauth-sign-in.md)
Blocked by: —

## Problem

Nothing in this repository tests a route. `npm test` is `node --test` over three suites that
import modules and assert on pure functions; nothing boots `src/worker.js`, makes a request
or has an `env`. A route-level guarantee ships hand-checked or not at all, and
[../../admin-player-crud/issues/04-destructive-routes-and-rate-limiting/tickets/01-no-worker-level-test-harness.md](../../admin-player-crud/issues/04-destructive-routes-and-rate-limiting/tickets/01-no-worker-level-test-harness.md)
is still open.

Building that harness is not this ticket. admin-player-crud's answer was to pull the
decidable parts out into a pure module and test those — `src/players.js`, imported by both
`POST` and `PUT` so they cannot drift. This is the same move for OAuth: everything in the
flow that is a decision rather than a network call comes out into `src/auth.js` and gets a
test, so what is left hand-checked is only the round trip to Discord itself.

## What to build

`src/auth.js`, pure — no `fetch`, no `env`, no D1, no Workers globals beyond what a plain
`node --test` process has.

| Export | Does |
|---|---|
| `SESSION_COOKIE` | the name, `epa_session` |
| `sessionCookie(token, maxAgeSeconds)` | the full `Set-Cookie` value |
| `expiredSessionCookie()` | the same, `Max-Age=0`, empty value |
| `readCookie(header, name)` | one cookie value out of a `Cookie` header, or `null` |
| `statePayload(page, now, ttlMs)` | `{ kind: 'state', page, exp }`, ready for `signToken` |
| `returnPage(value, allowed)` | a validated page key, falling back to `'rate'` |
| `authorizeUrl({ base, clientId, redirectUri, scope, state })` | the authorize URL |
| `tokenRequestBody({ clientId, clientSecret, code, redirectUri })` | a `URLSearchParams` |
| `accountAgeMs(snowflake, now)` | snowflake → age, via BigInt |

Cookie attributes, settled during planning: `HttpOnly; Secure; SameSite=Lax; Path=/`, no
`Domain`, `Max-Age` 30 days. **No `__Host-` prefix** — its job is stopping a sibling
subdomain writing the cookie, and `workers.dev` is on the Public Suffix List, so a browser
already refuses `Domain=workers.dev` from any other Worker. One name in both environments,
and no uncertainty about the prefix under `wrangler dev` over plain HTTP.

`statePayload` carries `kind: 'state'` because
[../02-token-kind-discriminator.md](../02-token-kind-discriminator.md) lands first and
`verifyToken` will reject a payload offered as the wrong kind. It carries `page` so the
visitor returns to where they started.

`accountAgeMs` uses BigInt: `Number((BigInt(id) >> 22n) + 1420070400000n)`. Nineteen digits
do not survive a JavaScript number. **Nothing gates on it** — it is here because it costs
nothing and [../../moderation/03-ban-accounts-and-moderate-ratings.md](../../moderation/03-ban-accounts-and-moderate-ratings.md)
will want it.

## Watch out

- **Keep `discord.com` out of this file.** `authorizeUrl` takes its `base` as an argument
  and `tokenRequestBody` builds no URL at all. Two tests in `test/frontend.test.js` fail on
  the first `auth/discord` or `discord.com/api/oauth2` literal anywhere in `src/` — they are
  tripwires on the terms page's published promises, and they are
  [07](07-make-the-published-promises-true.md)'s to resolve, not this ticket's. **If a test
  you did not touch starts failing, do not delete it** — stop and report.
- Passing the endpoint in is also the better seam: a test can assert the exact URL without
  a constant to keep in step.
- `scope` is `identify`, nothing else. A separate test greps every line containing `scope`
  in `src/` for the word `email` and fails if it finds one, because the terms page states in
  the present tense that no email address is stored. Do not widen the scope string.

## Tests

`test/auth.test.js`, in the style of `test/players.test.js`:

- `readCookie` — absent header, one cookie, several, surrounding whitespace, and a name that
  is a suffix of another (`other_epa_session=x` must not match `epa_session`).
- `sessionCookie` / `expiredSessionCookie` — every attribute present, `HttpOnly` and
  `Secure` on both, `Max-Age=0` on the expired one.
- `returnPage` — a known page passes; an unknown one, an empty one, `'../evil'` and
  `'https://evil.example'` all fall back to `'rate'`. This is what stops the return value
  being an open redirect.
- A test that the allowed list is a subset of `PAGES` in `public/app/state.js`, imported
  directly, so the two cannot drift.
- `authorizeUrl` — exact query string, `response_type=code`, scope `identify`, the state
  passed through, everything encoded.
- `tokenRequestBody` — `grant_type=authorization_code`, form-encoded; Discord does not
  accept JSON on this endpoint.
- `accountAgeMs` — the snowflake from Discord's own reference, `175928847299117063`, whose
  timestamp is `1462015105796`. Assert the derived timestamp, not a duration.

## Done when

`src/auth.js` exists with no impure import, `test/auth.test.js` covers every export above,
`npm test` is green, and `npm run check` passes.
