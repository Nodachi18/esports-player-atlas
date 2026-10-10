# Verify Discord redirect URIs in the developer portal

Type: task
Status: resolved
Map: ../map.md

## Question

Human-only task: nobody but the account holder can log into the Discord developer portal.

[Discord OAuth and free session auth on Workers](01-discord-oauth-session-auth.md) could not
establish two things from the documentation, because Discord does not state them normatively:

1. Does the portal accept a plain `http://localhost:8787/api/auth/discord/callback` redirect
   URI, or does it insist on `https`?
2. How many redirect URIs may one application register? The deployment needs at least the
   `workers.dev` origin and, later, a custom domain.

Why this blocks the spec rather than the build: if localhost is refused, local development
cannot use the real sign-in flow, and the spec has to say what the header's Login control
does under `npm run dev` / Docker instead. That is a spec statement, not an implementation
detail.

Checklist for whoever runs it:

- Create an application at <https://discord.com/developers/applications>.
- Under OAuth2, try adding `http://localhost:8787/api/auth/discord/callback` and record
  whether it is accepted.
- Add a second redirect URI and record whether multiple are permitted.
- Record where the Client ID and Client Secret are to be stored (`.dev.vars` locally,
  `wrangler secret put` for deployment) — not the values themselves, and never in this file.

## Answer

Resolved — 2026-10-10. An application exists (not finalized).

1. **Plain `http://localhost` is accepted.** The portal does not insist on `https` for a
   localhost callback, so local development uses the real Discord sign-in flow. The spec
   needs no stub or bypass for `npm run dev` / Docker.
2. **Multiple redirect URIs are permitted.** A second, `https://` one was added alongside
   the first without complaint, so local and deployed origins coexist on one application.

Redirect URIs match **exactly** — no wildcards, no host or path prefixes — so every origin
the app is opened at must be registered in its own right.

**Superseded** — the host is now known and registering the redirect URIs is step 0 of
[accounts/01](../../accounts/01-discord-oauth-sign-in.md). The correct value is
`https://www.esports-player-atlas.workers.dev/api/auth/discord/callback`. Original note
follows.

**Open correction, not a blocker for this map:** the deployed URI registered was
`https://esports-player-atlas.workers.dev/api/auth/discord/callback`, which is missing the
account subdomain. Workers deploy to `<worker-name>.<account-subdomain>.workers.dev`, as
`README.md` records. Under exact matching, the URI as registered will never match the real
deployed origin. It needs replacing with the actual host once a deploy has printed it.

Credentials location when the app is finalized: `.dev.vars` locally (untracked),
`wrangler secret put` for deployment. Never in this repo.
