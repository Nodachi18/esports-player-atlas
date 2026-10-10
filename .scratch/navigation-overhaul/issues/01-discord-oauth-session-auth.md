# Discord OAuth and free session auth on Workers

Type: research
Status: resolved
Map: ../map.md

## Question

What does Discord OAuth sign-in look like on Cloudflare Workers with D1, at zero cost?

The header spec cannot say what the Login control *does* until this is known. Specifically:

- The flow end to end: redirect URI, code exchange, which secrets are needed and where they
  live alongside the existing `ADMIN_KEY` / `APP_SECRET`.
- How the session is carried afterwards — cookie or bearer token — and whether the
  WebCrypto `signToken` / `verifyToken` helpers already in `src/worker.js` cover it or
  whether something else is needed.
- What a Discord identity does and does not guarantee about uniqueness, given decision 8's
  bar of "not trivially resettable".
- Whether any part of the flow needs the Worker to serve routes that `public/` currently
  bypasses via Workers Assets, and what that costs on the free tier.
- Whether logout needs server-side state or is purely a client concern.

Output: enough fact for the spec to describe the Login, Logout and Register controls
precisely. This is research, not a build — no auth code is written here.

## Answer

Full findings, every claim cited: [research/01-discord-oauth.md](../research/01-discord-oauth.md).

**The flow.** Standard OAuth2 authorization-code grant, Worker as a confidential client, so
no PKCE. Two routes under `/api/`: `/api/auth/discord/start` 302s to Discord's authorize
endpoint; `/api/auth/discord/callback` exchanges the code (form-encoded — JSON is not
accepted), calls `GET /users/@me`, upserts an Account keyed on the Discord snowflake, then
**throws the Discord token away** — the project wants an identity, not API access. Scope is
`identify` only, no `email`, which keeps personal data out of D1.

**The session** is an `HttpOnly; Secure; SameSite=Lax` cookie carrying exactly what the
existing `signToken()` already produces. Nothing new is needed to sign or verify it.

**What this fixes about the header spec:**

- **Login is a full-page navigation, not a `fetch`.** It must be an anchor or
  `location.assign`, and it must be labelled as *Discord* sign-in — an unlabelled "Login"
  that jumps to `discord.com` reads as a phish.
- **There is no separate Register control.** First sign-in *is* registration; a Registrieren
  button would point at the identical URL. Combine them: "Mit Discord anmelden".
- **Logout needs one Worker route and zero server state.** JS cannot clear an `HttpOnly`
  cookie, so `POST /api/auth/logout` replies with `Max-Age=0`. No DB write, no Discord call.
- **`wrangler.jsonc` needs no change** while both routes sit under `/api/`. Asset-first
  routing already forwards everything else to `env.ASSETS.fetch`. Do **not** set
  `run_worker_first` — it converts free asset hits into billable Worker invocations.
- **Cost is nil**: a sign-in is 2 Worker requests and 1 D1 write, against daily free limits
  of 100k each.

**Uniqueness** (decision 8): a Discord snowflake is permanent and unique, but accounts are
free and multiple ones are allowed. That clears "not trivially resettable" and no more.
`username` is mutable and must never be a join key. Snowflakes encode creation time, giving
a free account-age signal against throwaways.

New secrets: `DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET`, and an explicit
`DISCORD_REDIRECT_URI`.

**Two things escalated out of this ticket** — see the map's Out of scope and
[Verify Discord redirect URIs in the developer portal](05-discord-portal-redirects.md).
