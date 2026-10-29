# Provision the Discord application

Status: ready-for-human
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

## Watch out

- `.dev.vars` must be gitignored. Check before writing anything into it.
- The client secret is shown once. Regenerating it is free, but it invalidates the old one.
- Putting the deployed secrets in place does not break anything today — no code reads them
  until [04](04-the-three-auth-routes.md) lands.

## Done when

The portal lists exactly those two redirect URIs, the Terms of Service URL is filled, three
secrets exist locally in `.dev.vars` and three exist on the deployed Worker
(`npx wrangler secret list` shows the names, never the values).
