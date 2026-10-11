# The rate limit

What [04](../04-destructive-routes-and-rate-limiting.md) settled, written as the thing
[05](../05-handoff-spec.md) folds into `spec.md`. The *reasoning* — including the two
premises 04 found to be false — is in [decisions.md](decisions.md); this file is the what,
not the why.

Line references are to the code as it stands on `main` at 2026-10-12.

## Why this is in a player-CRUD spec at all

The map says **no admin code is written in this map**, and that still holds: this is a
spec, not an implementation. What changed is the *scope* of the spec. The map's delete
route arrives behind a login that throttles nothing, and the fix turned out to be ten lines
in `src/worker.js` and five in `wrangler.jsonc` — smaller than any single item in 05's test
list. Splitting it into [moderation/01](../../../moderation/01-rate-limit-admin-login.md)
and sequencing the two made sense when the limit was a different-sized job in a different
place. It isn't any more.

So the delete does **not** wait for a prerequisite, and it does **not** ship exposed. The
prerequisite ships inside the spec, in the same build session.

## The binding

Workers Rate Limiting, [GA 2025-09-19](https://developers.cloudflare.com/changelog/post/2025-09-19-ratelimit-workers-ga/).
No KV namespace, no D1 table, no Durable Object, no extra read per request, and
`namespace_id` is a number you pick rather than a resource you provision. **Nothing here is
waiting on a human.** Requires Wrangler ≥ 4.36.0; this repo is on 4.149.0.

`wrangler.jsonc`, alongside `d1_databases`:

```jsonc
"ratelimits": [
  {
    "name": "LOGIN_LIMIT",
    "namespace_id": "1001",
    "simple": { "limit": 5, "period": 60 }
  }
]
```

`period` takes **10 or 60 and nothing else**. `namespace_id` is a string holding a positive
integer, unique per Cloudflare account; `1001` is free.

## The rule

**`POST /api/admin/login` only.** Not `DELETE`, not `/api/pro/verify`, not anything else —
see [What this deliberately does not limit](#what-this-deliberately-does-not-limit).

| | |
|---|---|
| Endpoint | `POST /api/admin/login` (`src/worker.js:107`) |
| Key | the `CF-Connecting-IP` request header |
| Counted | **failed attempts only** |
| Limit | 5 per 60 seconds |
| Refused with | `429` + `{ error: 'Too many attempts. Please try again shortly.' }` |
| No header | **fail open** — no key, no limiting |

Shape, at `src/worker.js:107`:

```js
if (method === 'POST' && path === '/api/admin/login') {
  const { key } = await readJson(request);
  if (await isAdminKey(env, key)) {
    return json(200, { token: await signToken(env, { role: 'admin', exp: Date.now() + ADMIN_TOKEN_TTL }) });
  }
  const ip = request.headers.get('CF-Connecting-IP');
  if (ip && !(await env.LOGIN_LIMIT.limit({ key: ip })).success) {
    return json(429, { error: 'Too many attempts. Please try again shortly.' });
  }
  return json(401, { error: 'Invalid admin key' });
}
```

Four properties of that shape, each deliberate:

- **`.limit()` is called after the key check, and only when it failed.** A correct login
  never spends budget, so an admin signing in six times in a minute is never refused, and
  an attacker spends budget on every single attempt. Calling it before the check would
  limit the admin and the attacker equally.
- **The branch order is inverted from today's.** The success path returns first. Written
  the other way round, the `429` would sit between the `401` and its own condition.
- **The key is `CF-Connecting-IP` and not a browser-supplied value.** The edge sets it and
  a client cannot suppress it; evading it costs an IP rotation. A token or header the
  browser sends costs an attacker *nothing* to omit, and with fail-open an omitted key
  means no limit at all — it would stop precisely the attacker it was built for and
  inconvenience only the admin.
- **Fail open when the header is absent.** It is always present in production, and absent
  under `wrangler dev` locally. The alternative — a constant fallback key — gives every
  header-less caller one shared bucket, which anyone who can reach the endpoint can
  exhaust to lock the admin out of their own site.

### The message carries no numbers

*Too many attempts. Please try again shortly.* No count, no window, no `Retry-After`
header. The footer form renders it exactly as it renders today's `401`
(`public/app/api.js` `ApiError` already carries the status), and nothing new is needed in
the UI. Adding `Retry-After: 60` later is one line and changes no decision.

## What this deliberately does not limit

- **`DELETE /api/admin/players/:slug`.** The binding is per-colo and eventually consistent,
  so a limit on the destructive route is a speed bump an attacker multiplies by the number
  of Cloudflare locations they can reach — and `ADMIN_KEY` is a generated secret, so the
  threat it would address is a *leaked* key rather than a guessed one. Not worth a second
  binding on this map. Reopen it if the key is ever shared with a second person.
- **`POST /api/pro/verify`.** The other unlimited guessing endpoint, and the weaker one:
  invite codes default to 96 random bits but `src/worker.js:157` accepts an admin-supplied
  `code` at ≥ 8 characters. The professional invite surface is on its way out —
  [accounts/05](../../../accounts/05-retire-pro-invite-surface.md) retires it once Discord
  sign-in lands — so hardening it buys a few months of a route that is being deleted.
- **`/api/auth/*`.** The routes do not exist. The same binding applies to them when they
  do, and that is now a line item on
  [accounts/01](../../../accounts/01-discord-oauth-sign-in.md) rather than a ticket of its
  own.

## What the build session must prove

**There is no Worker-level test harness in this repository**, so none of this can be
asserted by `npm test` today. `test/stats.test.js` and `test/frontend.test.js` both import
modules and assert on pure functions; nothing boots `src/worker.js` or makes a request
against it. That gap is stated rather than quietly carried, and it is
[tickets/01](tickets/01-no-worker-level-test-harness.md).

In its place, **once after the deploy**, against production:

```sh
# six attempts with a wrong key; the sixth is the first 429
for i in 1 2 3 4 5 6; do
  curl -s -o /dev/null -w "$i %{http_code}\n" \
    -X POST https://www.esports-player-atlas.workers.dev/api/admin/login \
    -H 'content-type: application/json' --data '{"key":"wrong-key-0000000000"}'
done
# then, within the same minute, the real key still works
curl -s -o /dev/null -w "admin %{http_code}\n" \
  -X POST https://www.esports-player-atlas.workers.dev/api/admin/login \
  -H 'content-type: application/json' --data "{\"key\":\"$ADMIN_KEY\"}"
```

Expected: `401 401 401 401 401 429`, then `200`. The final `200` is the half that matters —
it proves failures alone are counted. Record the result in the spec's done-when; it is the
only evidence this feature will have.

**Whether the binding works under `wrangler dev` is undocumented.** The Cloudflare page
says nothing either way. Verify it locally before relying on it, and if it throws or
no-ops, that is a local-dev caveat to write down, not a reason to change the design.

## Ordering

There is no precondition left to sequence: the limit and the delete are in the same spec.
If the build session splits the work across pull requests — plausible, given four
migrations and a form — **the limiter goes in the first one**. It is fifteen lines and it
has no dependency on anything else on this map.
