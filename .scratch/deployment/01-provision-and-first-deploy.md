# Provision Cloudflare and make the first deploy

Status: resolved
Source: deployment spec, Phase 1

## Outcome — 2026-10-10

Live at **https://www.esports-player-atlas.workers.dev**, serving 38 players.

**It is not gated.** Cloudflare Access needed a payment method on the account even for the
free Zero Trust tier, so steps 4, 8 and 9 below were abandoned and the deployment went
public instead. The reversal is recorded in [spec.md](spec.md); the risks it accepts are
listed there too.

Done:

- D1 `esports-player-atlas`, `a5d65c76-5b23-49d1-bf45-49383957a680`
- Migrations `0001_init` and `0002_players` applied remotely
- `ADMIN_KEY` and `APP_SECRET` set — verified by `/api/admin/stats` returning `403` rather
  than the `503` an unconfigured Worker gives
- Worker renamed `esports-player-atlas` → `app` → `www` in the dashboard, with
  `wrangler.jsonc` following each time
- `preview_urls: false`, set explicitly: it defaults to following `workers_dev`, which
  would publish a second public hostname per version
- `robots.txt` disallowing everything, since ratings cast without accounts should not be
  indexed as fact

Verified live: `www` serves the app, the API and our own `robots.txt`; the retired `app`
hostname returns `404` for `/` and only Cloudflare's platform-level `robots.txt`.

Follow-on: the real host is now known, so the redirect URI that sign-in will need is
settled — `https://www.esports-player-atlas.workers.dev/api/auth/discord/callback`. The
exploratory entry in the Discord portal is wrong on both counts, missing the worker name and
the account subdomain. Registering it correctly is step 0 of
[accounts/01](../accounts/01-discord-oauth-sign-in.md), not work of its own: there is no
integration yet for a wrong URI to break.

---

*Original plan below, kept for the record. Steps 4, 8 and 9 did not happen.*

## Why it needs a human

`wrangler login`, creating the D1 database, generating secrets and enabling Zero Trust all
need the account holder. None of it can be scripted from here.

## The ordering trap

A Worker must exist before Cloudflare Access can be attached to it. Deploy first and click
through Access afterwards, and the app is publicly reachable for however long that takes.

Avoid it by deploying with no public route: set `"workers_dev": false`, deploy, attach
Access, then set it back to `true` and deploy again. The app is never once reachable without
the gate.

## Steps

1. `npx wrangler login`
2. `npx wrangler d1 create esports-player-atlas`; note the `database_id`
3. Replace the `00000000-…` placeholder in `wrangler.jsonc` with it, and commit
4. Set `"workers_dev": false` in `wrangler.jsonc`
5. `npm run db:migrate:remote`
6. `npm run deploy`
7. `npx wrangler secret put ADMIN_KEY` (≥16 chars, random) and `APP_SECRET` (≥32, random,
   different). Keep both in a password manager. No redeploy needed afterwards
8. Enable Zero Trust on the account. Then **Workers & Pages → the Worker → Access → Protect
   this Worker behind Access**: All traffic, policy *Cloudflare account membership*
9. Set `"workers_dev": true`, `npm run deploy`, and commit

## Verify

Work through the checklist in [spec.md](spec.md). The one that matters most is requesting a
static asset directly — `/app/styles.css` — while signed out of Cloudflare. It must show the
Access login. If the asset loads, the gate is not covering what you think it is.

Then note the real `workers.dev` host and carry it into
[accounts/01](../accounts/01-discord-oauth-sign-in.md), whose step 0 registers the redirect
URI; the exploratory entry lacks the account subdomain and would fail on first sign-in.

## Do not

Run `seed/demo.sql` against the remote database. It carries the public `PRO-DEMO-2026`
invite, which anyone reading this repo could exchange for a 30-day professional token.

## Done when

The gate holds for both the page and its assets, admin sign-in works from the footer
(proving both secrets landed), and `wrangler d1 migrations list --remote` shows nothing
pending.
