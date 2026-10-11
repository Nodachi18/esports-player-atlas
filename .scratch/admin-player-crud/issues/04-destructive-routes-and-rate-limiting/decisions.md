# Why it has this shape

The reasoning behind [rate-limit.md](rate-limit.md). Decided 2026-10-12 by grilling, three
rounds. Read this to argue with; read [rate-limit.md](rate-limit.md) to build from.

The ticket asked a sequencing question — does the delete wait for
[moderation/01](../../../moderation/01-rate-limit-admin-login.md), or ship with it and
accept the window — and offered three options. **The answer is none of the three**, because
two of the facts the question rests on turned out to be wrong.

## Two false premises, found before the first question

### 1. "No restore path" is not true. D1 Time Travel restores rows.

The map's decision 2 says the delete is irreversible "with no restore path", and
`HANDOFF.md` says "nothing restores them". Both reason from `wrangler rollback`, which is
correct as far as it goes — it restores code, never rows.

But [D1 Time Travel](https://developers.cloudflare.com/d1/reference/time-travel/) restores
the database to **any minute in the last 30 days on a paid plan, 7 days on free**. It is
automatic, needs no setup, costs nothing and has been on by default for every D1 database
including this one. This account is free, so: **7 days.**

```sh
npx wrangler d1 time-travel restore esports-player-atlas --timestamp=<unix>
```

What it is not: a backup *strategy*. The restore is a destructive, in-place, whole-database
overwrite, so recovering one deleted Player also reverts every Rating submitted since the
chosen minute. With 3 ratings on the entire site that cost is currently zero, and it will
not stay zero. It also requires a human with Wrangler authenticated against the account,
and it expires silently after a week.

**Decided: it counts as a floor and gets written down, and nothing is built on it.** The
worst case stops being "the roster is gone forever" and becomes "someone has to notice
within seven days". The user's position, and the right one for a hobby project: *good that
D1 provides the option, but we don't need a sophisticated backup strategy.* No monitoring,
no scheduled export, no runbook beyond the one command.

The reason it still matters is documentary. Two files currently assert the opposite, in
exactly the voice a build session trusts, and a build session that believes the roster is
unrecoverable will make different calls than one that knows it has a week. Both are
corrected.

### 2. moderation/01's "no code, no state" option does not exist for this deployment.

That ticket offers a **Cloudflare WAF rate-limiting rule** on the path as the cheap option
— "No code, no state, counts against the free plan's rule allowance."

Rate limiting rules are **zone**-scoped; the documentation is titled
[Create a rate limiting rule in the dashboard **for a zone**](https://developers.cloudflare.com/waf/rate-limiting-rules/create-zone-dashboard/).
`www.esports-player-atlas.workers.dev` is not a zone on this account — `workers.dev` is
Cloudflare's own zone, and the account has no custom domain attached. There is no WAF
surface in the dashboard to attach a rule to. Reaching option A means buying a domain,
onboarding it, and pointing it at the Worker.

So moderation/01 as written offers a free option that cannot be taken and an expensive one
that is the only option. Anyone picking it up today is misled by their own tracker.

### And one fact that made the whole question smaller

moderation/01 describes the in-Worker route as *"More code, more reads per request, backed
by D1 or a KV namespace."* That was true when it was written. It is not true now.

The [Workers Rate Limiting binding](https://developers.cloudflare.com/workers/runtime-apis/bindings/rate-limit/)
went **GA on 2025-09-19**. It needs no KV, no D1, no Durable Object and no provisioning
call — `namespace_id` is an integer you choose in `wrangler.jsonc`. It adds no storage read
to the request. It is five lines of config and ten of code.

That is what collapses the ticket. The three options it lists are all answers to "how do we
live with a gap between the delete shipping and the limit landing", and the honest answer
is that at this size there is no gap worth managing: **the limit goes in this map's spec
and ships in the same build session.** The map's "no admin code is written in this map"
rule survives intact — this is still a spec — but its *scope* widens beyond player
management, deliberately and in writing.

The alternative, keeping the split for tidiness, means shipping an irreversible cascading
delete naked in order to preserve a map boundary. That is a boundary worth breaking once.

## What the limit is actually for

**`ADMIN_KEY` was generated with a password generator.** That was the one fact that could
not be looked up — it is a Wrangler secret — and it changes what the limiter is.

Against a generated secret of 16+ characters, compared as a SHA-256 digest in constant
time, the free plan's 100,000 requests/day is not a brute-force budget. It is not even a
rounding error on one. So the limiter is **not** the thing holding the door. The key is.

What the limiter is: hygiene, a tripwire, and the removal of an embarrassment — a login
form sitting in the footer of every page of a public site with nothing between it and an
infinite loop. It costs fifteen lines, so it does not have to earn its place with a threat
model.

This is why the numbers are what they are. **5 per 60 seconds** is roughly "a human who
cannot remember which password manager entry it was" and nothing more ambitious. Tuning it
downward would buy nothing against an attacker who was never going to succeed, and would
start costing the admin.

It is also why the scope is one endpoint.

## Three things not limited, and why

**`DELETE` itself.** Argued for and rejected. The case for: a login limit does nothing
against the threat that survives a strong key — a *leaked* key, a token lifted from a tab,
a laptop left open — and 3 deletes/60s turns wiping 38 Players from ~10 seconds into ~13
minutes, which is the difference between noticing and not. The case against, which won: the
binding is per-colo and eventually consistent, documented as "permissive … intentionally
designed to not be used as an accurate accounting system", so a distributed attacker
multiplies the limit by the number of Cloudflare locations they reach. It is a speed bump
with a tripwire's value, and the user's call was to keep this simple. The genuine second
factor — a separate `ADMIN_DELETE_KEY` secret on the destructive route — would reopen the
body-`confirm` that [03](../03-form-behaviour-contract.md) rejected to keep the API slim,
and is a bigger change than this map should make.

**`POST /api/pro/verify`.** The weaker of the two guessable endpoints: invite codes default
to 96 random bits, but `src/worker.js:157` takes an admin-supplied `code` at ≥ 8
characters, and `PRO-DEMO-2026` is published in this repository (in `seed/demo.sql`, which
must never touch production). A guessed code mints a 30-day token weighted 2:1 on the
published medians. Left alone anyway, because the surface is being retired —
[accounts/05](../../../accounts/05-retire-pro-invite-surface.md) deletes it once Discord
sign-in lands — and hardening a route on its way out is work that gets thrown away. It is
named here rather than left silent, because "we rate-limited the admin login" reads like
the guessing problem is solved, and it isn't.

**`/api/auth/*`.** moderation/01 asked for it; the routes do not exist yet. Moved onto
[accounts/01](../../../accounts/01-discord-oauth-sign-in.md), where they get written.

## The key, and what "either one works" misses

The user's instinct on keying was that it hardly matters — *people that can work around
that also can rotate their IPs, it is a temporary solution until the Discord login is
available anyway.* Right about the ceiling, and the temporariness: once `accounts/07`
replaces the shared key with per-Account admin roles, this limiter is limiting a route that
no longer exists.

But the floors are not equal, and that is the part worth recording. `CF-Connecting-IP` is
set by the edge and a client cannot suppress it, so evasion costs an IP rotation. A
browser-supplied value — a token in the body, a header the app sets — costs an attacker
nothing to omit, and under fail-open an omitted key is *no limit at all*. A script never had
a browser. Browser pinning would therefore stop exactly the attacker it was built for and
inconvenience only the admin, who is the one caller certain to send the field.

Hence `CF-Connecting-IP`, fail open when absent.

Fail open is itself a choice with a loud alternative. Falling back to a constant key when
the header is missing gives every header-less caller one shared bucket — and anyone who can
reach the endpoint can empty that bucket and lock the admin out of their own site. A
self-inflicted denial of service, built as a security control. The header is always present
in production; it is absent under `wrangler dev`, where there is no attacker.

## Counting failures only

`.limit()` is called **after** the key check, in the failure branch. This is the detail most
likely to be lost in implementation, because the natural place to put a rate limit is the
top of the handler.

At the top, it limits the admin and the attacker identically: six logins in a minute from
the office — a reasonable thing to do while debugging — and the admin is locked out by
their own correct password. In the failure branch, a correct key never spends budget, so
the limit is invisible to everyone who knows it and absolute for everyone who doesn't.

It also means the manual verification has a second half that matters more than the first:
after six wrong keys return `429`, the *right* key must still return `200` inside the same
minute.

## The privacy page does not change

`public/app/views.js:442` carries a doc comment making the privacy page part of any change
to what is stored. The limiter stores nothing: the counter lives inside Cloudflare's
infrastructure, keyed on a string the Worker passes, with no row, no column and no
retention in D1.

The page's *"No name, no email address, no IP address"* at `views.js:468` scopes to what a
**rating row** holds, and the limiter adds nothing to one. The site's handling of IPs is
already disclosed one section down, at `views.js:485`: *"Cloudflare therefore handles
connection data — your IP address and your browser's user agent."* That sentence already
covers this.

Decided: no change. Written down because the question is a reasonable one to ask twice, and
the second asker should not have to re-derive the answer.

## No test, said out loud

There is no harness in this repository that boots the Worker and makes a request.
`test/stats.test.js` imports `src/stats.js`; `test/frontend.test.js` imports six modules out
of `public/app/`. Both assert on pure functions. `npm test` is `node --test` with no
runtime, no fetch, no `env`.

So "the sixth attempt returns 429" has nowhere to live, and the choice was between stating
that, building the harness, or pretending.

Building it — `wrangler unstable_dev`, or `@cloudflare/vitest-pool-workers` — is where this
repository's testing has to go eventually, and the limiter is the least of the reasons.
**Four of [05](../05-handoff-spec.md)'s required assertions are route-level and
currently unwritable for the same reason**: the `409` on a duplicate name, the `400` at 251
characters, the `PUT` that moves `updated_at`, and the cascade leaving zero rows in
`ratings` and `player_stats`. That is the real argument, and it is far too big to smuggle
into a player-CRUD map as a side effect of fifteen lines of rate limiting.

So: the gap is stated in the spec, six `curl`s go in the done-when, and the harness becomes
[tickets/01](tickets/01-no-worker-level-test-harness.md), blocking nothing.

## Two calls made without asking

Both trivially reversible, both recorded so they are not mistaken for oversights.

1. **No `Retry-After` header.** Proposed in round 2 and dropped when the user trimmed the
   numbers out of the message. It is a header rather than copy, so "keep it simple" is a
   reading rather than an instruction. One line to add back.
2. **No ordering constraint, with one residual.** Since the limiter lives in the same spec
   there is nothing to sequence. But a build session may well split four migrations, a
   form and two routes across several pull requests, and in that case the limiter goes in
   the first one — fifteen lines, no dependencies. Stated in
   [rate-limit.md](rate-limit.md#ordering) rather than left to chance.

## What this closes

[moderation/01](../../../moderation/01-rate-limit-admin-login.md) closes as **delivered
here**. Rewriting its body was unavoidable in every option — its cheap route does not
exist for this deployment and its expensive route is mis-costed by a factor of ten — so
leaving it open in any form means leaving a document that misleads. Its one surviving
instruction, *"apply it to `/api/auth/* ` too once sign-in exists"*, moves to
[accounts/01](../../../accounts/01-discord-oauth-sign-in.md), where those routes are
written.

That also takes it off the handoff's "Then, by value" list, where it sat second behind
Discord sign-in, and where its stated justification — *"its stakes are about to rise"* —
was this map's delete.
