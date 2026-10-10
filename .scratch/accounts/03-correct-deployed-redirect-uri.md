# Correct the deployed Discord redirect URI

Status: ready-for-human
Source: navigation-overhaul issue 05, verified in the portal 2026-10-10

## Problem

The Discord application currently registers
`https://esports-player-atlas.workers.dev/api/auth/discord/callback`, which is **missing the
account subdomain**. Workers deploy to `<worker-name>.<account-subdomain>.workers.dev`, as
`README.md` records.

Redirect URIs match exactly — no wildcards, no host or path prefixes — so the URI as
registered will never match the real deployed origin. Sign-in fails with
`invalid_redirect_uri` the first time it is tried on a deploy.

The site is now deployed, so this is only still harmless because sign-in does not exist yet
— there is no flow for the wrong URI to break. It must be fixed before
[01](01-discord-oauth-sign-in.md) ships, not after.

## What to do

The host is now known — the Worker is deployed and the hostname is settled, so this is
actionable immediately. The correct value is:

```
https://www.esports-player-atlas.workers.dev/api/auth/discord/callback
```

What is registered today is wrong twice over: missing the Worker name *and* the account
subdomain.

1. Replace the registered URI in the Discord developer portal with exactly that string.
2. Set `DISCORD_REDIRECT_URI` to the same value, so nothing derives it from the request
   origin — deriving it forces every origin to be registered separately.
3. Keep the `http://localhost:8787/...` entry; multiple redirect URIs are permitted and
   local development needs it.

Already confirmed in the portal: plain `http://localhost` is accepted, and multiple redirect
URIs may be registered, so local and deployed can coexist.

## Done when

Sign-in completes on the deployed origin, not just locally.
