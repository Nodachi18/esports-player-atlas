# Provision Cloudflare and make the first gated deploy

Status: ready-for-human
Source: deployment spec, Phase 1

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

Then note the real `workers.dev` host and fix
[accounts/03](../accounts/03-correct-deployed-redirect-uri.md), which is currently registered
without the account subdomain and would fail on first sign-in.

## Do not

Run `seed/demo.sql` against the remote database. It carries the public `PRO-DEMO-2026`
invite, which anyone reading this repo could exchange for a 30-day professional token.

## Done when

The gate holds for both the page and its assets, admin sign-in works from the footer
(proving both secrets landed), and `wrangler d1 migrations list --remote` shows nothing
pending.
