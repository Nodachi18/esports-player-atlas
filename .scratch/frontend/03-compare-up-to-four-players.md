# Build the compare view, or drop the endpoint

Status: needs-triage
Source: navigation-overhaul spec §7, decision 18

## Problem

`GET /api/compare?players=a,b,c,d` works, returns whole profiles, and caps at four slugs. No
UI has ever called it.

v3 looked like it had one — a "Compare selected" heading, a `#compareBox` div and a `sel`
Set — but `#compareBox` was never written to and `sel` was declared and never read. The
whole thing was scaffolding. The new frontend renders Compare as a `planned` block on the
Leaderboard instead of carrying the dead markup forward.

So this is not re-hosting a feature. It is building one that has only ever existed as an
endpoint.

## If building it

- Four radars overlaid, or side by side? Overlaid compares shapes directly but gets muddy
  past two, especially since two of the three panel tints are already spoken for.
- How are players chosen — multi-select on the Leaderboard, or added one at a time from a
  player's detail?
- Does the lens apply across all compared players at once? It should: comparing one player's
  professional scores against another's community scores would be meaningless.

## If dropping it

Delete the route and the `planned` block, and say in the spec that comparison was considered
and rejected. Dead surface that nothing reaches is worse than no surface.

## Done when

Either a compare view exists, or `/api/compare` does not.
