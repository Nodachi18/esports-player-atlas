# Research: Discord OAuth and free session auth on Workers + D1

Ticket: [`../issues/01-discord-oauth-session-auth.md`](../issues/01-discord-oauth-session-auth.md)
Map: [`../map.md`](../map.md)
Date: 2026-10-10
Status: findings only — no auth code written, nothing in `src/`, `public/` or `migrations/` touched.

---

## TL;DR (what the header spec can rely on)

1. **Login is a full-page navigation, not a `fetch()`.** The Discord authorize step is a
   top-level browser redirect to `discord.com`. An XHR cannot do it. The Login control is an
   `<a href="/api/auth/discord/start">` or a `location.assign(...)`, nothing more.
2. **Both OAuth routes live under `/api/`.** Put them at `/api/auth/discord/start` and
   `/api/auth/discord/callback`. Nothing in the `assets` config changes, `public/` keeps
   bypassing the Worker, and no `run_worker_first` is needed.
3. **The session is an `HttpOnly` cookie carrying exactly the string `signToken()` already
   produces.** The WebCrypto helpers cover the crypto completely. What is missing is cookie
   plumbing and a `kind` discriminator in the payload — not new cryptography.
4. **Logout needs one Worker route, but no server-side state.** Because the cookie is
   `HttpOnly`, JavaScript cannot clear it; `POST /api/auth/logout` replies with an expiring
   `Set-Cookie`. Zero D1 reads, zero D1 writes.
5. **Register is not a separate control.** Discord OAuth is first-login-is-registration. The
   header needs Login and Logout; a distinct "Register" item would be a second button that
   starts the identical redirect.
6. **Cost is zero on the free tier** for any plausible volume of this project.
7. **A Discord identity does not give one-human-one-account** and nothing in the flow can make
   it do so. It gives a permanent, globally unique, non-trivially-resettable handle, which is
   exactly decision 8's bar — no more.

---

## 1. The flow, end to end

### 1.1 Registration in the Discord Developer Portal (one-time, manual, free)

An application is created in the Discord Developer Portal; it yields a **Client ID** and a
**Client Secret**, and takes a list of **Redirects**. The token exchange will only succeed for a
`redirect_uri` that was registered: "redirect_uri is whatever URL you registered when creating
your application, url-encoded."
Source: <https://docs.discord.com/developers/topics/oauth2>

> **Could not establish from a primary source:** how many redirect URIs an application may
> register, and whether plain-`http://localhost` / `http://127.0.0.1` redirects are accepted
> for local `wrangler dev`. Discord's own tutorials show `http://127.0.0.1/callback` as a
> desktop example, but I could not fetch a page that states the rule normatively. **Verify in
> the portal before the build ticket** — it decides whether local dev can use the real flow or
> needs a stub.

### 1.2 Step A — `GET /api/auth/discord/start`

The Worker responds `302` to:

```
https://discord.com/oauth2/authorize
  ?client_id=<DISCORD_CLIENT_ID>
  &response_type=code
  &scope=identify            (optionally: identify%20email)
  &redirect_uri=<url-encoded, exactly as registered>
  &state=<CSRF value, see 1.5>
```

Parameters and the authorize URL: <https://docs.discord.com/developers/topics/oauth2>.
Scopes are space-separated and URL-encoded as `%20`. `prompt=consent|none` is optional.

### 1.3 Step B — Discord redirects back to `GET /api/auth/discord/callback?code=...&state=...`

This arrives as a **cross-site, top-level, GET navigation** from `discord.com`. That single fact
dictates the `SameSite` value of the CSRF cookie (section 1.5).

### 1.4 Step C — the Worker exchanges the code (server-side only)

```
POST https://discord.com/api/oauth2/token
Content-Type: application/x-www-form-urlencoded
  grant_type=authorization_code
  code=<code>
  redirect_uri=<same value as in step A>
```

- Content-type **must** be `application/x-www-form-urlencoded`; "JSON is not permitted."
- Client authentication: "All calls to the OAuth2 endpoints require either HTTP Basic
  authentication or `client_id` and `client_secret` supplied in the form data body." Either is
  fine from a Worker; the form-body form is one less `btoa()`.
- The response carries `access_token`, `token_type`, `expires_in` (the documented example is
  `604800`, i.e. 7 days), `refresh_token`, `scope`.

Source: <https://docs.discord.com/developers/topics/oauth2>

> "Do not do this from the browser — your client secret must stay on the server."
> Source: <https://docs.discord.com/developers/discord-social-sdk/development-guides/account-linking-on-web>

Then one more subrequest:

```
GET https://discord.com/api/v10/users/@me
Authorization: Bearer <access_token>
```

`GET /users/@me` "returns the user object of the requester's account" and requires the
`identify` scope; the `email` scope adds the `email` field.
Source: <https://docs.discord.com/developers/resources/user>

**Then throw the Discord access token away.** The project has no use for it after this call: it
needs an identity, not ongoing Discord API access. Do not store it, do not request or use the
refresh token. That removes a whole class of secret-at-rest and token-refresh problems. (If
belt-and-braces is wanted, `POST https://discord.com/api/oauth2/token/revoke` with
`token=<access_token>` kills it immediately — "When you revoke a token, any active access or
refresh tokens associated with that authorization will be revoked."
Source: <https://docs.discord.com/developers/topics/oauth2>.)

### 1.5 CSRF: the `state` parameter

Discord: `state` is "a value that binds the user's request to their authenticated state", it
"should be stored client-side and validated upon redirect return", and while not required by
Discord its use is "highly recommend[ed]".
Source: <https://docs.discord.com/developers/topics/oauth2>

Zero-state recipe (no D1 row, no KV):

- In step A, generate a nonce with `crypto.getRandomValues()` (available in Workers:
  <https://developers.cloudflare.com/workers/runtime-apis/web-crypto/>).
- Send it **twice**: once as the `state` query parameter, once as a short-lived cookie
  (`Max-Age=600`, `HttpOnly`, `Secure`, `Path=/`).
- In step C, compare the two and then expire the cookie.

**The CSRF cookie must be `SameSite=Lax`, never `Strict`.** `Lax` sends the cookie "for
same-site requests AND cross-site top-level navigations with safe methods (GET, HEAD, OPTIONS)";
`Strict` sends it "only for same-site requests". The callback in 1.3 *is* a cross-site top-level
GET, so a `Strict` cookie would simply not arrive and every login would fail CSRF validation.
Source: <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie>

Optionally, instead of a raw nonce, the state value can be `signToken(env, {kind:'oauth_state',
nonce, exp: Date.now() + 600_000})` — see the discriminator warning in section 2.3.

### 1.6 PKCE

Not needed here. Discord's own guidance: "Public clients that can't keep a secret (native and
mobile apps) should use PKCE instead of a client secret", and their web (confidential-client)
example passes no `code_challenge`.
Source: <https://docs.discord.com/developers/discord-social-sdk/development-guides/account-linking-on-web>

A Worker is a confidential client — it holds the secret. PKCE adds nothing.

> **Could not establish:** whether the standard `/oauth2/authorize` endpoint accepts
> `code_challenge` for a confidential web client. The main OAuth2 reference does not mention
> PKCE at all; PKCE only appears in the Social SDK / mobile guides. Immaterial for this build.

### 1.7 Secrets, and where they live

Current state (`wrangler.jsonc` comment, `.dev.vars.example`): `ADMIN_KEY` and `APP_SECRET` are
Workers secrets, set with `npx wrangler secret put <NAME>`, mirrored into an untracked
`.dev.vars` for `wrangler dev`. `.dev.vars` is already in `.gitignore`.

Two new values join them, by exactly the same mechanism:

| Name | Kind | Why |
|---|---|---|
| `DISCORD_CLIENT_ID` | could be a plain `vars` entry; simplest to keep it a secret beside the others | public value, identifies the app |
| `DISCORD_CLIENT_SECRET` | **secret** | must never reach the browser |
| `DISCORD_REDIRECT_URI` | plain `vars` entry in `wrangler.jsonc`, or derived from `new URL(request.url).origin` | must byte-match a registered Redirect |

On `DISCORD_REDIRECT_URI`: deriving it from the request origin is tempting but the Worker is
reachable on *both* `<name>.workers.dev` and any custom domain, so deriving means registering
every origin in the portal. An explicit value is the fewer-surprises choice.

Mechanics and limits: `wrangler secret put <KEY>` "immediately creates a new version and deploys
it"; secrets are read off the `env` parameter of the fetch handler; local values go in
`.dev.vars` (or `.env`, not both) and "should never be committed to git".
Source: <https://developers.cloudflare.com/workers/configuration/secrets/>
Free plan allows 64 environment variables/secrets per Worker at up to 5 KB each — four more is
nothing. Source: <https://developers.cloudflare.com/workers/platform/limits/>

**Build-ticket gotcha, not a change for now:** `src/worker.js:268-271` has a `secrets(env)` guard
that 503s unless `ADMIN_KEY` ≥ 16 chars and `APP_SECRET` ≥ 32 chars. It does not know about the
Discord values, so a missing `DISCORD_CLIENT_SECRET` would fail late and opaquely inside the
token exchange rather than early and clearly. Extending that guard belongs in the build ticket.

---

## 2. Carrying the session afterwards

### 2.1 What `signToken` / `verifyToken` actually are

Read at `src/worker.js:305-320`:

```js
async function signToken(env, payload) {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  return body + '.' + base64url(await hmac(env, body));
}
```

`hmac()` is HMAC-SHA-256 keyed on `APP_SECRET`; `verifyToken` compares with
`crypto.subtle.timingSafeEqual` and then enforces `payload.exp > Date.now()`.

This is a two-part, header-less JWS-alike: `base64url(JSON) "." base64url(HMAC-SHA256)`. Every
primitive it uses is supported in Workers — HMAC sign, SHA-256 digest, `importKey`, and
`timingSafeEqual`, which the docs call out as "a non-standard extension to the Web Crypto API".
Source: <https://developers.cloudflare.com/workers/runtime-apis/web-crypto/>

### 2.2 What it already covers

- **Cryptographic integrity of a session token: fully covered.** A session is just
  `signToken(env, { role, sub, exp })`. No new crypto, no library, no dependency.
- **Cookie-safe output.** The alphabet is `A–Z a–z 0–9 - _ .` — all legal in a cookie value, so
  the token needs no extra encoding.
- **Size.** A payload like `{"kind":"session","role":"community","sub":"<19-digit snowflake>",
  "exp":<13 digits>}` is roughly 90 bytes of JSON → ~120 base64url chars, plus `.` plus a
  43-char signature ≈ **165 bytes**. Nowhere near the ~4 KB per-cookie limit, and nowhere near
  the Worker's 128 KB total request-header budget
  (<https://developers.cloudflare.com/workers/platform/limits/>).
- **Expiry.** `exp` is milliseconds since epoch. Note the implicit contract: a payload *without*
  `exp` evaluates `undefined > Date.now()` → `false` → `verifyToken` returns `null`. Tokens
  without an expiry are rejected, which is the safe default.

### 2.3 What it does **not** cover (the real gaps)

1. **No type discriminator.** `verifyToken` returns whatever JSON was signed. Today the only
   separation between an admin token, a pro token and (soon) a session token or an OAuth `state`
   token is the `role` field that each call site happens to check. The moment a signed `state`
   value exists, a signed blob is being handed to the *browser* that is later fed back to the
   same verifier. Add a `kind` field (`'session' | 'pro' | 'admin' | 'oauth_state'`) and check it
   at every call site, or a state token becomes a candidate session token. This is the one
   genuine security note in this document.
2. **No cookie plumbing.** `src/worker.js` never reads a `Cookie` header and never emits
   `Set-Cookie` — every current token travels in an `Authorization: Bearer` header
   (`src/worker.js:106`) or a JSON body field (`src/worker.js:176`). Two small helpers are
   needed. Workers read cookies with `request.headers.get("Cookie")`
   (<https://developers.cloudflare.com/workers/examples/extract-cookie-value/>) and set them by
   adding a `Set-Cookie` response header; note that the existing `json()` helper builds its
   headers inline and has no way to add one.
3. **No revocation.** An HMAC token is valid until `exp`, full stop. See section 5.
4. **No key rotation.** A single `APP_SECRET` signs everything, so rotating it logs out every
   session *and* invalidates every outstanding 30-day pro token and admin token at once.

### 2.4 Cookie vs bearer — recommendation

**Cookie**, for this app, with the token value unchanged.

| | Cookie (`HttpOnly`) | Bearer in `localStorage` |
|---|---|---|
| Readable by XSS | no | yes |
| Survives reload / new tab | yes, automatically | only if persisted |
| Sent on same-origin `fetch` | automatically (`credentials` defaults to `same-origin`) | needs explicit header on every call |
| Works for the OAuth redirect | yes — the callback can set it directly in its `302` | no — a top-level navigation cannot carry a header or return a body to JS |
| CSRF exposure | yes, mitigated by `SameSite=Lax` | none |
| Logout | needs a Worker route (see §5) | pure client `removeItem` |

The decisive row is the fourth. The OAuth callback is a navigation; it has no JSON response the
page can read. A cookie is the only thing it can hand back without an extra "now fetch your
token" round trip that would briefly expose the token to the page anyway.

Recommended attributes:

```
Set-Cookie: __Host-epa_session=<signToken value>; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=<ttl>
```

- `HttpOnly` — "forbids JavaScript from accessing the cookie"; the single biggest win over
  `localStorage`.
- `Secure` + `SameSite=Lax` + `Path=/` + no `Domain` are exactly the `__Host-` prefix
  requirements, which pin the cookie to the one origin.
- `SameSite=Lax` is also the CSRF defence for the API: `Lax` "excludes subresource requests,
  `fetch()`, and iframe navigations", so a cross-site `POST /api/ratings` carries no cookie.
  `Lax` is the modern browser default anyway, but state it explicitly.
All attribute semantics: <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie>

> **Dev caveat to check:** `__Host-` requires the cookie be set from a secure origin. Browsers
> generally treat `http://localhost` as a secure context and MDN notes `Secure` applies "except
> localhost", but I did not find a normative statement covering the `__Host-` prefix on
> `http://localhost`. If `wrangler dev` chokes, drop the prefix locally.

**Do not break what exists.** `Authorization: Bearer` must keep working for `/api/admin/*` and
the pro-rating path. The cheapest shape is: read the session from the cookie, fall back to the
bearer header, and keep `role` doing the authorisation it does today.

---

## 3. What a Discord identity does and does not guarantee

### 3.1 What it guarantees

- **A permanent, globally unique account handle.** The user object's `id` is a snowflake —
  Discord's unique identifier format, permanent and globally unique across the platform.
  Source: <https://docs.discord.com/developers/resources/user>
  **Key this account on `id` and nothing else.**
- **A free derived signal: account age.** "The top 42 bits" of a snowflake are "Milliseconds
  since Discord Epoch, the first second of 2015 or 1420070400000", recoverable as
  `(snowflake >> 22) + 1420070400000`.
  Source: <https://docs.discord.com/developers/reference>
  This gives a zero-cost, zero-API-call anti-throwaway lever: reject or quarantine Discord
  accounts created in the last *N* days. Worth recording as available even if unused at launch.
- **Optionally, email-verification state.** With the `email` scope the user object carries
  `verified`, "indicating email verification status".
  Source: <https://docs.discord.com/developers/resources/user>

### 3.2 What it explicitly does **not** guarantee

- **Not one human, one account.** Discord accounts are free — "We won't charge you a fee to use
  the basic functionality of our services" — and the Terms do not prohibit holding several.
  Source: <https://discord.com/terms>
  Discord itself ships an Account Switcher for multiple accounts. Creating a second identity
  costs a second email address and a few minutes.
- **No stable human-readable name.** `username` is "not unique across the platform" and is
  changeable, and changing it "may cause the user's discriminator to be randomized".
  Source: <https://docs.discord.com/developers/resources/user>
  So `username`/`global_name`/`avatar` are **display cache only** — re-read them on every login,
  never join on them, never treat a stored copy as current.
- **No phone-verification signal.** No OAuth scope exposes whether the account is
  phone-verified. Discord may demand phone verification through its own anti-spam systems, but
  that is invisible to us.

### 3.3 Against decision 8's bar

Decision 8 asks for "not trivially resettable", not "one human, one account". Discord clears
that bar: clearing a browser's storage does not reset the identity (unlike today's
`voter` token in `submitRating`, which is a client-held string the user can regenerate at will),
and re-offending requires standing up a whole new Discord account with a fresh email. The upper
bound is **cheap but not free, and traceable**, which is the right shape for the moderation
story decision 7 anticipates: `ratings.voter_hash` can become a hash of the snowflake, so bans
and rating-blocks have something durable to attach to.

### 3.4 Scope choice, and a GDPR note

`identify` alone is the minimal-data option: snowflake, username, avatar — no email ever
touches D1, which is materially simpler given the project already owes an Impressum under German
law (map, "Not yet specified"). Adding `email` buys exactly two things: the `verified` flag, and
the ability to detect that two Discord accounts share an email address — but it makes the
project a controller of a directly identifying personal datum.

**Recommendation: request `identify` only.** Use snowflake account age (3.1) as the
throwaway-account lever instead. If the `verified` flag later proves necessary, `email` can be
added to the scope string without any schema change, and the email discarded after the check.

---

## 4. Routing, Workers Assets, and cost

### 4.1 The current setup

`wrangler.jsonc`: `"assets": { "directory": "./public", "binding": "ASSETS" }` — `directory`
and `binding` only. `html_handling`, `not_found_handling` and `run_worker_first` are therefore
at their defaults: `"auto-trailing-slash"`, `"none"`, and `false`.
Source: <https://developers.cloudflare.com/workers/wrangler/configuration/>

Default routing: "Cloudflare prioritizes static assets: it attempts to serve matching assets
first, then invokes the Worker script only if no asset matches the request."
Source: <https://developers.cloudflare.com/workers/static-assets/routing/worker-script/>

`src/worker.js:183` then does:

```js
if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
```

So a path with no matching asset **does** reach the Worker, but the Worker immediately hands it
back to the assets binding, which — with `not_found_handling: "none"` — 404s. Requests made
through the binding have `html_handling` and `not_found_handling` applied to them.
Source: <https://developers.cloudflare.com/workers/static-assets/binding/>

### 4.2 The answer

**No change to the assets config is required, and `public/` keeps bypassing the Worker
entirely — provided both OAuth routes are placed under `/api/`:**

- `GET  /api/auth/discord/start`
- `GET  /api/auth/discord/callback`
- `POST /api/auth/logout`
- `GET  /api/auth/me` (optional — lets the SPA render the header's logged-in state)

These fall through the existing `startsWith('/api/')` check and land in `route()` with no
structural change at all.

If someone insists on prettier URLs like `/auth/discord/callback`, the options are (a) a second
prefix branch in the Worker's dispatch, or (b) `run_worker_first: ["/auth/*"]` — the array form
exists precisely for this ("Specify route patterns (e.g. `["/oauth/callback"]`) to run the
Worker first only for those paths"). Neither is necessary. The `/api/` prefix is free.

**Do not set `run_worker_first: true`.** It would route every static-asset request through the
Worker, converting free unlimited asset hits into billable Worker invocations.

### 4.3 Cost on the free tier — nil

| Resource | Free limit | What one sign-in consumes |
|---|---|---|
| Worker requests | 100,000/day | **2** (start + callback) |
| Static asset requests | "free and unlimited", not counted as Worker requests | unchanged |
| Subrequests per Worker invocation | 50/request | **2** in the callback (token exchange, `/users/@me`) |
| CPU time per invocation | 10 ms | two HMACs and a JSON parse; see below |
| D1 rows written | 100,000/day | **1** (upsert the account) |
| D1 rows read | 5,000,000/day | ~1 |
| D1 storage | 5 GB account / 500 MB per database | ~100 bytes per account |
| D1 queries per invocation | 50 | 1–2 |

Sources: <https://developers.cloudflare.com/workers/platform/pricing/>,
<https://developers.cloudflare.com/workers/platform/limits/>,
<https://developers.cloudflare.com/d1/platform/pricing/>,
<https://developers.cloudflare.com/d1/platform/limits/>

The 10 ms CPU limit is the one that looks threatening and isn't: "Waiting on network requests
(such as `fetch()` calls, KV reads, or database queries) does **not** count toward CPU time."
Source: <https://developers.cloudflare.com/workers/platform/limits/>
The callback's two round trips to Discord are wall-clock, not CPU. The actual CPU work is two
HMAC-SHA-256 operations over ~200 bytes.

Verifying the session on each subsequent API call costs **one HMAC and zero D1 queries** —
strictly cheaper than any database-backed session.

The binding limit that would bite first is D1's 100,000 rows written/day, i.e. 100,000
first-time sign-ins in a day. Not a concern. Discord's side is also free; its global API ceiling
is "up to 50 requests per second"
(<https://docs.discord.com/developers/topics/rate-limits>), which at two subrequests per login
means ~25 logins/second before throttling.

> **Could not establish:** whether `env.ASSETS.fetch()` from inside the Worker is itself counted
> as a billable subrequest. The binding docs are silent. Immaterial — the free plan does not bill
> subrequests, and this flow adds no asset fetches.

---

## 5. Logout

### 5.1 The short answer

**No server-side state, but it is not purely a client concern either.** It needs exactly one
Worker route and zero database rows.

The reason is `HttpOnly`: that attribute "forbids JavaScript from accessing the cookie via
`Document.cookie`" (<https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie>),
so the page physically cannot delete its own session cookie. The server must overwrite it:

```
POST /api/auth/logout
→ 204, Set-Cookie: __Host-epa_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0
```

`Max-Age` of "zero or negative values expire immediately" (same source). The route needs no D1
access and does not even need to verify the incoming token — it is idempotent and safe to call
when already logged out.

Nothing needs to be sent to Discord: the Discord access token was discarded at login (§1.4), and
revoking it would in any case not end *our* session.

### 5.2 The caveat worth recording in the spec

Because the token is stateless, **logout ends the session on that browser but does not revoke the
token**. A copy captured before logout stays valid until its `exp`. Mitigations, in increasing
cost:

- A short session TTL (hours, not the 30 days the pro token uses) bounds the window at zero cost.
- A `token_version` integer on the account row, embedded in the token and compared on each
  request, enables real revocation — at the price of **one D1 row read per authenticated
  request**, which is the moment free-tier arithmetic starts to matter.
- A full `sessions` table costs the same read plus a write per login.

This connects directly to the map's deferred moderation work: decision 7 wants Accounts to be
"blockable", and a ban that cannot take effect until a token expires is a weak ban. **A
stateless token is right for logout and insufficient for banning.** Recommendation: ship
stateless with a short TTL now, and record that the first real moderation ticket must add
`token_version` (or equivalent) — it is a schema change, not a redesign.

---

## 6. Consequences for the header spec

Concrete answers to "what do the controls do":

- **Login** — `<a href="/api/auth/discord/start">`, a full-page navigation. Not a modal, not a
  form, not a `fetch`. Label it as Discord sign-in: the user is about to leave the site and land
  on a Discord consent screen, and an unlabelled "Login" that jumps to `discord.com` reads as a
  phish. Per map decision 12, the logged-out Voting entry's sign-in prompt points at this same
  URL.
- **Register** — **there is no separate control.** First sign-in creates the Account. If a
  "Registrieren" affordance is wanted for clarity, it must point at the identical URL and should
  be framed as "Mit Discord anmelden / registrieren" rather than implying a second flow. A
  distinct Register control that behaves identically to Login is a spec smell.
- **Logout** — `POST /api/auth/logout`, then re-render (or reload). It cannot be a pure
  client-side `localStorage.clear()`. It may be a `fetch` rather than a navigation, since it
  returns no redirect that matters.
- **Session state the header renders from** — either `GET /api/auth/me` on page load, or a
  non-`HttpOnly` *companion* cookie holding only non-sensitive display data (role, display name,
  avatar hash) alongside the `HttpOnly` session cookie. The companion-cookie trick saves a
  round trip and must never be trusted for authorisation — only for deciding which header
  controls to paint. Either is viable; `/api/auth/me` is simpler and costs one Worker request.
- **Role** — comes from the account row keyed on the Discord snowflake, not from Discord.
  Discord says *who*; this app says *what they may do*. A Professional's link to their one
  Player (decisions 3 and 11) is a column on the account row, set by the flow that ticket 02
  covers.
- **Display name/avatar** — refresh from `/users/@me` on every login and store as a cache only;
  Discord usernames change (§3.2).

---

## 7. Open questions for the build ticket

1. Does the Discord Developer Portal accept an `http://localhost:8787/...` redirect for
   `wrangler dev`, and how many redirects may one application register? (§1.1)
2. Session TTL. The existing precedents are 30 days (pro) and 8 hours (admin). Short favours the
   revocation gap in §5.2; long favours convenience.
3. `__Host-` cookie prefix under `wrangler dev` over plain HTTP. (§2.4)
4. Whether the `secrets(env)` guard at `src/worker.js:268` should cover the Discord values and
   fail fast. (§1.7)
5. Where the `kind` discriminator (§2.3) is introduced, and whether existing pro/admin tokens get
   it at the same time — adding it to the verifier is a flag-day change for tokens already issued.

---

## Sources

All claims above cite one of the following. Where a page is first-party documentation for the
system in question it is treated as authoritative; where I could not reach a primary source the
claim is explicitly marked as unestablished.

**Discord (first-party developer and legal documentation)**
- OAuth2 reference — <https://docs.discord.com/developers/topics/oauth2>
- User resource / user object — <https://docs.discord.com/developers/resources/user>
- API reference, snowflake format — <https://docs.discord.com/developers/reference>
- Rate limits — <https://docs.discord.com/developers/topics/rate-limits>
- Account Linking on Web (confidential-client guidance, PKCE scope) — <https://docs.discord.com/developers/discord-social-sdk/development-guides/account-linking-on-web>
- Terms of Service — <https://discord.com/terms>

**Cloudflare (first-party platform documentation)**
- Workers pricing — <https://developers.cloudflare.com/workers/platform/pricing/>
- Workers limits — <https://developers.cloudflare.com/workers/platform/limits/>
- Static assets: routing with a Worker script — <https://developers.cloudflare.com/workers/static-assets/routing/worker-script/>
- Static assets: ASSETS binding — <https://developers.cloudflare.com/workers/static-assets/binding/>
- Wrangler configuration (`assets` keys and defaults) — <https://developers.cloudflare.com/workers/wrangler/configuration/>
- Secrets — <https://developers.cloudflare.com/workers/configuration/secrets/>
- Web Crypto runtime API — <https://developers.cloudflare.com/workers/runtime-apis/web-crypto/>
- Reading cookies in a Worker — <https://developers.cloudflare.com/workers/examples/extract-cookie-value/>
- D1 pricing — <https://developers.cloudflare.com/d1/platform/pricing/>
- D1 limits — <https://developers.cloudflare.com/d1/platform/limits/>

**Web platform**
- `Set-Cookie` attributes, `SameSite`, `HttpOnly`, cookie prefixes — <https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie>

**This repository (read, not modified)**
- `src/worker.js` — `signToken`/`verifyToken` at 305-320, `hmac`/`safeEqual` at 290-298,
  `secrets()` guard at 268-271, asset fall-through at 183, bearer parsing at 106,
  body-token parsing at 176
- `wrangler.jsonc`, `.dev.vars.example`, `.gitignore`, `migrations/0001_init.sql`, `CONTEXT.md`

**Could not be reached:** `support.discord.com` returns HTTP 403 to automated fetches, so
consumer-facing claims about Discord registration (one account per email address, when email or
phone verification is enforced) are **not** asserted here on primary authority. They do not
change the conclusion in §3.3, which rests on the Terms of Service and the user-object
documentation.
