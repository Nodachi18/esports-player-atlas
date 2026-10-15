# Discord OAuth sign-in and sessions

Status: ready-for-human
Source: navigation-overhaul spec §10, research at ../navigation-overhaul/research/01-discord-oauth.md
Blocked by: 02, ../content-pages/05-terms-of-service.md

## Problem

The app has no accounts. Roles are shared secrets: one `ADMIN_KEY`, one pro invite code
where every holder counts as a single rater, and a resettable `localStorage` voter id. The
frontend already renders the signed-out shell and marks sign-in as planned.

There is no Discord integration in the codebase at all — no routes, no secrets, no client.
What exists is an unfinalized application in the developer portal, created to answer the
research questions in
[navigation-overhaul/05](../navigation-overhaul/issues/05-discord-portal-redirects.md). Its
registered redirect URIs are exploratory leftovers and wrong for the deployed host; that is
not a separate defect to fix, it is step 0 of this ticket. Nothing can break until there is
a flow to break.

## Step 0 — provision the application (human-only)

Nobody but the account holder can do this part, and none of the code below can be tested
without it.

Redirect URIs match **exactly** — no wildcards, no host or path prefixes — so every origin
the app is opened at must be registered in its own right. Register exactly these two, and
remove whatever else is there:

```
https://www.esports-player-atlas.workers.dev/api/auth/discord/callback
http://localhost:8787/api/auth/discord/callback
```

The deployed host is `<worker-name>.<account-subdomain>.workers.dev`; the Worker is named
`www` (see `wrangler.jsonc`), hence the `www.` prefix that the exploratory entry was missing.
Plain `http://localhost` is accepted by the portal and multiple URIs may coexist on one
application — both confirmed in the portal on 2026-10-10.

While you are in there, fill the **Terms of Service URL** field on General Information:

```
https://www.esports-player-atlas.workers.dev/terms
```

That page is [content-pages/05](../content-pages/05-terms-of-service.md), and it ships
before this ticket rather than with it. Nothing in this flow is known to be gated on the
field — it is filled because the page exists and the field is free.

Then store the credentials. Never in this repo:

| Secret | Local | Deployed |
|---|---|---|
| `DISCORD_CLIENT_ID` | `.dev.vars` | `npx wrangler secret put` |
| `DISCORD_CLIENT_SECRET` | `.dev.vars` | `npx wrangler secret put` |
| `DISCORD_REDIRECT_URI` | `.dev.vars` | `npx wrangler secret put` |

`DISCORD_REDIRECT_URI` is configured, not derived from the request origin: deriving it means
every origin the app is ever reachable at has to be registered separately, and a mismatch
fails with `invalid_redirect_uri` at the worst moment.

## What to build

Authorization-code grant with the Worker as a confidential client, so no PKCE.

- `GET /api/auth/discord/start` — 302 to Discord's authorize endpoint with a signed `state`.
- `GET /api/auth/discord/callback` — exchange the code (form-encoded; JSON is not accepted),
  call `GET /users/@me`, upsert an Account keyed on the Discord snowflake, discard the
  Discord token. The app wants an identity, not API access.
- `POST /api/auth/logout` — reply with an expired cookie. JavaScript cannot clear an
  `HttpOnly` cookie, so this needs a route even though it writes nothing.

Session is an `HttpOnly; Secure; SameSite=Lax; Path=/` cookie carrying exactly what
`signToken()` already produces. Scope is `identify` only — no `email` — which keeps personal
data out of D1.

Flip `ACCOUNTS_ENABLED` in `public/app/main.js` when this lands: it turns on the spec's
target-state visibility, so Rate starts prompting and Account appears.

## Why it is ready-for-human

Step 0 can only be done by the account holder. The code is straightforward once the
application and its secrets exist, and can be handed to an agent at that point.

## Watch out

`username` is mutable and not unique — display cache only, never a join key. The snowflake
is the identity. Snowflakes encode creation time (`(id >> 22) + 1420070400000`), which is a
free account-age signal against throwaways.

A Discord account is free and several are allowed, so this clears "not trivially resettable"
and no more. That was the agreed bar.

## Done when

A visitor signs in with Discord **on the deployed origin, not just locally**, is recognised
on return, and signs out again; an Account row exists keyed on the snowflake;
`ACCOUNTS_ENABLED` is true and the navigation matrix behaves as spec §3 describes.

## Comments

**2026-10-10 — this ticket has a published promise attached to it.** The privacy page
([content-pages/03](../content-pages/03-privacy-statement.md)) carries a section marked
`planned` that states, live on the site today, what signing in with Discord will mean: the
site receives a Discord account id, username and avatar, and a rating stops being a
resettable browser token and becomes attributable to one identifiable person, linkable
across every player they have rated.

**Rewriting that section is part of shipping this ticket, before it goes live rather than
after.** The moment sign-in works, a block saying "none of this happens yet" is false on a
page whose whole value is that it is not.

It also reframes [accounts/06](06-legacy-ratings-after-accounts.md): the privacy page says
what becomes of pre-account ratings "is not yet decided", so 06 is now a question the site
has publicly admitted to having.

**2026-10-12 — rate-limit the auth routes as you write them.** Inherited from
[moderation/01](../moderation/01-rate-limit-admin-login.md), which closed when
[admin-player-crud/04](../admin-player-crud/issues/04-destructive-routes-and-rate-limiting.md)
delivered its headline — a limit on `POST /api/admin/login` — and could not deliver its
other instruction, *"apply it to `/api/auth/*` too once sign-in exists"*, because these
routes do not exist yet.

By the time you get here the mechanism is already in the repository: the Workers
`ratelimit` binding, configured in `wrangler.jsonc` and called as
`await env.LOGIN_LIMIT.limit({ key: ip })`. Adding a route to it is one `if`. The shape to
copy, and the reasoning behind keying on `CF-Connecting-IP`, failing open when the header
is absent and counting **failed** attempts only, is
[04/rate-limit.md](../admin-player-crud/issues/04-destructive-routes-and-rate-limiting/rate-limit.md).

The OAuth `state` round-trip is the part that wants it most: it is the one unauthenticated
endpoint in this flow that an attacker can call repeatedly with values of their choosing,
and [02](02-token-kind-discriminator.md) exists because that value is what creates the
token-confusion risk in the first place.

**2026-10-16 — a terms of service page now blocks this ticket.**
[content-pages/05](../content-pages/05-terms-of-service.md) is `ready-for-agent` and ships
standalone, before sign-in.

The reason it blocks rather than follows: this ticket is what turns a rating from a browser
token that resets in two clicks into something attributable to one identifiable person, and
the site has nowhere that states the rules that then apply — what gets an account blocked,
what happens to its ratings, that one account per person is expected. The legal notice is
about the operator and the privacy statement is about data; neither is about what the reader
may do. Shipping sign-in first means the rules arrive after the conduct they govern.

It is the second published promise attached to this ticket, alongside the privacy page's
`planned` Discord section. The terms page states rules 7-9 — sign-in with Discord, blocking,
and a blocked account's ratings leaving the published scores — in the present tense while
none of it is reachable. **That is not a block to rewrite when this lands; it is the rule set
this ticket has to make true.** In particular, rule 9 is specified as *exclusion from the
aggregates*, not deletion, which is a constraint on how blocking gets built in
[../moderation/03](../moderation/03-ban-accounts-and-moderate-ratings.md).

Also: rule 7 says no email address is stored. A test on the terms page fails if the scope
string here ever gains `email`.
