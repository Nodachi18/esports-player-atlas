# Ban accounts and moderate ratings

Status: needs-triage
Source: the original roles list ("admin kann user bannen"), navigation-overhaul map fog
Blocked by: ../accounts/01-discord-oauth-sign-in.md, 02

## Problem

Banning was in the roles list from the first sketch and has never had anything to ban: there
are no accounts. Rating moderation is half-built — `POST /api/admin/ratings/flag` exists and
`refreshStats` excludes flagged rows from the aggregates — but there is no surface for it
beyond a raw table, and no way to act on the person behind a bad rating rather than the
rating itself.

Gating rating behind an account (spec decision 7) was justified on exactly this: ratings
become attributable, blockable and moderatable. That promise is unredeemed until this ships.

## What to build

- A ban on an Account: blocks sign-in, and takes effect immediately via 02 rather than when
  the cookie lapses.
- An admin surface for flagging and unflagging a rating, rather than reading the table and
  calling the endpoint by hand.
- A ban **excludes** the ratings already cast, rather than deleting them. Decided
  2026-10-16 — see the comment below.

## Questions for triage

- Is a ban permanent, timed, or appealable? The README's pre-production list mentions appeal
  policies.
- Does banning an Account that owns a Player hide the Player too, or only stop the person?
- Auto-flagging already exists via z-score outlier detection, and the statistical caveats in
  `README.md` warn it can misclassify legitimate ratings. Should a human always confirm
  before a ban, given a flag is a review signal rather than proof?

## Done when

An admin can ban an account from the UI, the ban bites on the next request, and flagged
ratings can be reviewed without touching the API by hand.

## Comments

**2026-10-16 — "what a ban does to ratings already cast" is answered: exclusion, not
deletion.** Settled while writing
[../content-pages/05](../content-pages/05-terms-of-service.md), which had to state the rule
on a public page and so could not leave it open.

Flagged rows already drop out of the aggregates via `refreshStats`; a blocked account's
ratings take the same route. Deleting them would be irreversible, would leave an unban
unable to restore anything, and would throw away the evidence the block was based on.

The published wording is **"ratings cast by a blocked account are removed from the site"**,
which is true to a reader — they stop being published — without promising deletion.

**The reason exclusion specifically: it leaves room for a strike rule**, a count of flagged
ratings per account leading to a block, which is impossible once the rows are gone. The rule
is not decided and is deliberately absent from the terms page.

**Which makes this ticket's third triage question sharper, not softer.** Flagging is partly
automatic via z-score outlier detection and `README.md` warns it misclassifies legitimate
ratings. Under a strike rule an automatic flag feeds an automatic block, and a review signal
becomes a punishment with nobody in the loop. Whether a human confirms is still open here,
and it is now the question that decides whether a strike rule is safe to build at all.

**Prerequisite note:** the terms page ships before sign-in and before this ticket, so the
rules a block enforces are published before there is anything to block. Building a ban that
contradicts them is the failure mode to watch for.
