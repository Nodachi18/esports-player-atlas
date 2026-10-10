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
- A decision on what a ban does to ratings already cast: excluded like flagged ones, or kept.

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
