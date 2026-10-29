# Provision the Discord application

Status: resolved
Part of: [../01-discord-oauth-sign-in.md](../01-discord-oauth-sign-in.md)
Blocked by: —

## Problem

Nobody but the account holder can do this, and nothing downstream can be verified against a
real Discord without it. There is an unfinalized application in the developer portal, created
to answer the research questions in
[../../navigation-overhaul/research/01-discord-oauth.md](../../navigation-overhaul/research/01-discord-oauth.md);
its registered redirect URIs are exploratory leftovers and wrong for the deployed host.

## What to do

**Redirect URIs** — they match exactly, with no wildcards and no host or path prefixes, so
every origin the app is opened at must be registered in its own right. Register exactly
these two and remove whatever else is there:

```
https://www.esports-player-atlas.workers.dev/api/auth/discord/callback
http://localhost:8787/api/auth/discord/callback
```

The `www.` prefix is not decoration: the deployed host is
`<worker-name>.<account-subdomain>.workers.dev` and the Worker is named `www` in
`wrangler.jsonc`. The exploratory entry was missing it. Plain `http://localhost` is accepted
by the portal, and several URIs may coexist on one application — both confirmed in the
portal on 2026-10-10.

**Terms of Service URL**, on General Information:

```
https://www.esports-player-atlas.workers.dev/terms
```

That page already ships. Nothing in the flow is known to be gated on the field; it is filled
because the page exists and the field is free.

**Secrets** — never in this repository, and `DISCORD_REDIRECT_URI` is configured rather than
derived from the request origin. Deriving it means every origin the app is ever reachable at
has to be registered separately, and a mismatch fails with `invalid_redirect_uri` at the
worst possible moment.

| Secret | Local | Deployed |
|---|---|---|
| `DISCORD_CLIENT_ID` | `.dev.vars` | `npx wrangler secret put` |
| `DISCORD_CLIENT_SECRET` | `.dev.vars` | `npx wrangler secret put` |
| `DISCORD_REDIRECT_URI` | `.dev.vars` | `npx wrangler secret put` |

The two values differ by environment: `http://localhost:8787/...` locally, the `www.` host
deployed.

## Check the credentials before opening a browser

Found on 2026-10-30, after a wrong secret cost a full round trip through a consent screen to
diagnose. **The id/secret pair can be validated against Discord with no user, no consent
screen and no browser**, using the client-credentials grant, which an application's owner may
always request for itself:

```bash
set -a && . ./.dev.vars && set +a
curl -s -o /dev/null -w '%{http_code}\n' -X POST https://discord.com/api/oauth2/token \
  -H 'content-type: application/x-www-form-urlencoded' \
  -u "$DISCORD_CLIENT_ID:$DISCORD_CLIENT_SECRET" \
  -d 'grant_type=client_credentials&scope=identify'
```

`200` means the pair is good. `401 {"error":"invalid_client"}` means it is not, and says so in
a second rather than as a generic sign-in failure five minutes later.

**A shape check catches the specific mistake even faster.** The two values that get confused
sit on different pages and look nothing alike once you know:

| | Length | Characters | Where |
|---|---|---|---|
| Client secret | **32** | mixed case | OAuth2 |
| Public key | **64** | lowercase hex | General Information |

A 64-character lowercase-hex value in `DISCORD_CLIENT_SECRET` is the ed25519 public key for
interaction webhooks, which this project does not use. That is the paste that actually
happened. The failure it produces is `401 invalid_client` on the token exchange, which the
callback turns into the same `auth=failed` redirect as every other failure — indistinguishable
from a cancelled sign-in without the probe above.

The secret is shown once, so recovering from this means **Reset Secret**, not finding the old
one.

## Watch out

- **`wrangler dev` reads `.dev.vars` once, at startup.** A corrected secret stays broken until
  the dev server is restarted, which makes a fixed value look unfixed and sends you looking in
  the wrong place. Restart after any edit.
- `.dev.vars` must be gitignored. Check before writing anything into it.
- The client secret is shown once. Regenerating it is free, but it invalidates the old one.
- Putting the deployed secrets in place does not break anything today — no code reads them
  until [04](04-the-three-auth-routes.md) lands.

## Done when

The portal lists exactly those two redirect URIs, the Terms of Service URL is filled, three
secrets exist locally in `.dev.vars` and three exist on the deployed Worker
(`npx wrangler secret list` shows the names, never the values).

## Comments

**2026-10-29 — done.** Verified from here, without reading a value: `.dev.vars` carries
`DISCORD_CLIENT_ID`, `DISCORD_CLIENT_SECRET` and `DISCORD_REDIRECT_URI` alongside the two
that were already there, and the local redirect URI is
`http://localhost:8787/api/auth/discord/callback`. `wrangler secret list` shows all three
names on the deployed Worker.

**The one thing nobody can verify from the repository is the deployed
`DISCORD_REDIRECT_URI` value**, because a Worker secret is write-only — `secret list` prints
names, never values. If it was stored with the localhost URI, or without the `www.`, the
first sign-in on the deployed origin fails with `invalid_redirect_uri` and nothing earlier
than that will say so. That is the failure to suspect first if
[07](07-make-the-published-promises-true.md)'s deployed hand-check does not work.
