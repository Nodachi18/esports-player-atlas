# Turn accounts on

Status: ready-for-human — the flip is committed, the deployed walk is not done
Part of: [../01-discord-oauth-sign-in.md](../01-discord-oauth-sign-in.md)
Blocked by: 06, 07

## What to do

Flip `ACCOUNTS_ENABLED` to `true` in `public/app/main.js`. One line. It turns on the spec's
target-state navigation matrix: Rate starts prompting, Account appears as `planned`.

It is a ticket of its own, and it lands last, because it is the moment every other ticket in
this set becomes visible to a visitor at once. Everything before it can be built, committed
and reviewed with the site behaving exactly as it does today.

## Then verify on the deployed origin

The parent's "Done when" is explicit that local is not enough, and the reason is
[01](01-provision-the-discord-application.md): the deployed `DISCORD_REDIRECT_URI` is a
write-only Worker secret that nothing in the repository can read back. If it was stored with
the localhost URI, or without the `www.` prefix, **every check up to this point passes and
sign-in still fails on the deployed site** with `invalid_redirect_uri`. That is the first
thing to suspect.

After the merge deploys, on `https://www.esports-player-atlas.workers.dev`:

1. Sign in with Discord from a signed-out browser.
2. Confirm you land back where you started, signed in, with the username shown.
3. Rate a player.
4. Reload, and confirm you are still recognised.
5. Sign out, and confirm the Rate page returns to its prompting state.
6. Confirm an `accounts` row exists keyed on the snowflake, and the new `ratings` row
   carries its `account_id`.

Steps 1-5 need a human with a Discord account and a browser. Step 6 is
`wrangler d1 execute DB --remote`.

## Before merging

1. **Probe the credentials** with the client-credentials grant in
   [01](01-provision-the-discord-application.md). It validates whatever pair you hold locally.
   It cannot reach the deployed values — a Worker secret is write-only, so nothing can read
   them back — but if the same value went in with `wrangler secret put`, a local `200` is the
   best evidence available short of signing in on the live site.
2. **Re-count the live ratings.** The flush is irreversible on deploy.
3. Confirm `npm test` is green and `ACCOUNTS_ENABLED` is `true`.

## Watch out

**The flush in [02](02-accounts-schema-and-the-flush.md) runs when this deploys**, because
migrations apply before `wrangler deploy`. Count the live ratings one more time before the
merge — it was 3 on 2026-10-13 and 5 on 2026-10-29 — and stop if the number has grown into
something nobody would choose to discard.

**The local walk passed on 2026-10-30** — signed in as a real Discord account, landed back on
the page the state carried, one `accounts` row, two ratings carrying its `account_id`, both
with the same account-derived `voter_hash` on different players. So the flow itself is proven;
what the deployed walk still tests is the deployed *configuration*, which is a different
thing and the only thing no check here can reach.

## Done when

`ACCOUNTS_ENABLED` is `true`, the six steps above have been walked on the deployed origin,
and the result is written into the parent ticket rather than only into a commit message —
nothing in CI covers a route, so this hand-check is the only record that the flow works.
