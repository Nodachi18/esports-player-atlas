# Nothing in this repository tests a route

Type: task
Status: open
Blocked by: —
Map: ../../../map.md
Found by: ../decisions.md

## Problem

`npm test` is `node --test`, and both suites assert on pure functions:

- `test/stats.test.js` imports `src/stats.js` — `median`, `summarize`, `outlierIds`.
- `test/frontend.test.js` imports six modules out of `public/app/` and, in one case, greps
  source files as text (`test/frontend.test.js:344`, the same-origin check).

Nothing boots `src/worker.js`. Nothing makes a request. Nothing has an `env`, a `DB`
binding or a token. A route's behaviour is, today, unassertable.

That was tolerable while the API was GET plus two POSTs. It stops being tolerable with
this map, which adds a full-replace `PUT`, an irreversible `DELETE` and a rate limit —
and it is the reason several things on this map ship with a manual check instead of a
test.

## What is currently unwritable

Five assertions already required by other tickets, all blocked on this one alone:

- **The rate limit.** Six failed logins return `401 ×5` then `429`, and the correct key
  still returns `200` within the same minute. Replaced by six `curl`s in the spec's
  done-when ([04](../../04-destructive-routes-and-rate-limiting.md),
  [rate-limit.md](../rate-limit.md)).
- **The `409` on a duplicate name**, on create *and* on rename
  ([03](../../03-form-behaviour-contract.md)).
- **The `400` at 251 characters**, and that all seven capped fields agree — no test
  asserts any cap today
  ([02/tickets/01](../../02-migration-shape/tickets/01-cap-change-has-no-test.md)).
- **A `PUT` that changes nothing still moves `updated_at`** (decision 14).
- **Delete leaves zero rows in `ratings` *and* `player_stats`**, flagged rows included.
  The schema guarantees this twice over — `ON DELETE CASCADE` plus the trigger in
  [`0005`](../../03-form-behaviour-contract/0005_player_delete_cascade.sql) — and both
  were proven against SQLite directly. What is missing is proof the *route* does not undo
  it.

## What to build

Either; pick one and say why.

- **`wrangler unstable_dev`** — starts a local Worker from `node:test`, no new test
  runner, no new assertion library. Keeps `npm test` as `node --test`. The API is marked
  unstable and has moved before.
- **`@cloudflare/vitest-pool-workers`** — runs tests inside `workerd` with real bindings
  and an isolated D1 per test. The supported path, and the one Cloudflare documents. Costs
  a second test runner alongside `node --test`, or a migration of both existing suites
  onto Vitest.

Either needs a D1 fixture: migrations `0001`–`0006` applied to a scratch database, which
`wrangler d1 migrations apply --local` already does.

Check while you are there whether the rate limiting binding is even available under local
dev — Cloudflare does not document it either way
([decisions.md](../decisions.md#what-the-build-session-must-prove)). If it is not, the
limiter's test stays manual regardless of which harness is chosen, and that is worth
knowing before the work starts rather than after.

## Done when

One route test runs in CI, and the five assertions above have somewhere to live.

## Not urgent, and deliberately not blocking

This blocks nothing on the admin-player-crud map. The map ships with its gaps stated — the
six `curl`s, and the SQLite-level proofs already recorded in
[03/README.md](../../03-form-behaviour-contract/README.md) — rather than waiting for a test
framework it did not set out to introduce.
