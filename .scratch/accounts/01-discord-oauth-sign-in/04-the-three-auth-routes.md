# The three auth routes

Status: ready-for-agent
Part of: [../01-discord-oauth-sign-in.md](../01-discord-oauth-sign-in.md)
Blocked by: 01, 03

## What to build

Authorization-code grant with the Worker as a confidential client, so no PKCE. Three routes
in `src/worker.js`, using the seams from [03](03-auth-seams-and-their-tests.md).

**`GET /api/auth/discord/start`** — 302 to Discord's authorize endpoint, with a signed
`state` carrying `kind: 'state'`, the page to return to, and a short `exp` (5 minutes).
Scope `identify`, and nothing else, ever.

**`GET /api/auth/discord/callback`** — in this order:

1. `?error=access_denied` (the visitor declined) → 302 to `/?page=rate&auth=failed`.
2. Verify `state` as kind `'state'`. Invalid or expired → same 302. No D1, no outbound call.
3. Exchange the code at `POST https://discord.com/api/oauth2/token`, **form-encoded** —
   JSON is not accepted on this endpoint.
4. `GET https://discord.com/api/users/@me` with the access token.
5. Upsert an account keyed on the snowflake, refreshing `username`, `global_name`, `avatar`
   and `last_login_at`. **Discard the Discord token.** The app wants an identity, not API
   access; storing it would mean holding a credential with no use for it.
6. 302 to `/?page=<the page from the state>`, with the session cookie set.

**`POST /api/auth/logout`** — replies with the expired cookie. JavaScript cannot clear an
`HttpOnly` cookie, so this needs a route even though it writes nothing.

The session cookie carries exactly what `signToken()` produces, with `kind: 'session'`,
the snowflake as `sub`, and a 30-day `exp`.

## Rate limiting

A second `ratelimits` entry in `wrangler.jsonc` named `AUTH_LIMIT`, its own `namespace_id`
(`LOGIN_LIMIT` is `1001`; pick `1002`), and one `if` **immediately before the token
exchange** — after the state and the code have been checked, so a garbage state still costs
nothing. Keyed on `CF-Connecting-IP`, failing open when the header is absent, in the shape of
[../../admin-player-crud/issues/04-destructive-routes-and-rate-limiting/rate-limit.md](../../admin-player-crud/issues/04-destructive-routes-and-rate-limiting/rate-limit.md).

**The reason is not what it is for `/api/admin/login`, and the difference matters if anyone
later decides to move it.** There is no guessable secret anywhere in this flow: `state` is
HMAC-SHA256 over `APP_SECRET`, so forging one means having the secret. What the limiter
actually prevents is amplification — an attacker fetches a legitimate `state` from `/start`
for free, then calls `/callback` with it and a garbage `code` repeatedly, and every one of
those makes the Worker POST to `discord.com`. Discord rate-limits per application, so a few
minutes of that gets our client 429'd and **sign-in stops working for everyone**. It is an
availability control, not a credential control.

This also closes the one instruction
[../../moderation/01-rate-limit-admin-login.md](../../moderation/01-rate-limit-admin-login.md)
could not deliver: *apply it to `/api/auth/*` once sign-in exists.*

A separate binding rather than reusing `LOGIN_LIMIT`, because one shared bucket per IP means
hammering `/auth/*` locks the administrator out of their own site.

**Corrected 2026-10-30, after this ticket was built as written.** The first version of this
section put the `if` in the exchange-failure branch, copying the admin login's rule that a
success must never spend budget. That rule does not transfer. It protects a guessable
secret, and there the call being counted is local — here the outbound call *is* the thing
being protected, so `.limit()` after the `fetch` caps the response the attacker sees while
the amplification continues one-for-one. The control has to sit in front of the exchange,
which means a successful sign-in spends budget too. That is the trade, taken deliberately:
a person signs in once, so the only caller that feels it is a whole shared address at once,
and the budget is 10/60s rather than 5 for exactly that reason. A refusal here redirects to
`/?page=rate&auth=busy` rather than returning JSON, because unlike the admin login this
branch is now reachable by somebody doing nothing wrong.

**There is no WAF alternative here and there never will be without buying a domain.**
WAF and rate-limiting rules attach to a zone; `www.esports-player-atlas.workers.dev` is not
a zone on this account. The `ratelimit` binding is the in-Worker equivalent.

## Watch out

- **`secrets(env)` guards the whole Worker.** Adding the Discord values to it 503s the
  public site the moment one is missing. Guard them inside the auth routes instead, so a
  misconfigured sign-in breaks sign-in and nothing else.
- `json()` builds its headers inline and has no way to add a `Set-Cookie`. These routes
  return redirects, not `json()` — give them their own small response helper rather than
  widening `json()`.
- `Authorization: Bearer` must keep working for `/api/admin/*` and the professional rating
  path. This adds a cookie; it replaces nothing.
- Every failure mode returns the same `auth=failed`. No error detail in a URL the visitor
  can see or share.
- **Two tripwire tests in `test/frontend.test.js` fail as soon as `auth/discord` appears in
  `src/`.** One instructs you to confirm four claims on the terms page and then delete it;
  the other must survive. Resolving both is [07](07-make-the-published-promises-true.md),
  which lands in the same PR — leave them failing and say so, or move 07 forward, but do
  not delete a test as a side effect of this one.

## Done when

The three routes exist, `AUTH_LIMIT` is bound and called only on exchange failure, no
Discord token is persisted anywhere, `npm run check` passes, and the flow has been walked
once under `wrangler dev` against the real Discord application from
[01](01-provision-the-discord-application.md).
