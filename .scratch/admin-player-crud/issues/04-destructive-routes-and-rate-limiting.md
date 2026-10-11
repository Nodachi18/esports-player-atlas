# Decide whether delete ships before the admin login is rate-limited

Type: grilling
Status: open
Blocked by: —
Map: ../map.md

## Question

This map adds an irreversible, cascading delete behind an admin login that throttles
nothing.

`POST /api/admin/login` has no rate limiting — that is
[moderation/01](../../moderation/01-rate-limit-admin-login.md), still open — and the login
form sits in the footer of every page on a live, public, unauthenticated site. Today the
worst an attacker who guesses `ADMIN_KEY` can do is flag ratings, create players and mint
invite codes. After this map, it is destroying the roster and every Rating on it, with no
restore path: decision 2 is a hard delete and D1 migrations are forward-only.

The decision: does `DELETE /api/admin/players/:slug` ship only after `moderation/01` lands,
or does it ship with it and accept the window? Options worth weighing rather than assuming:

- Sequence it — this map's spec declares `moderation/01` a prerequisite for the delete
  route alone, while create and update ship freely.
- Ship together and raise `moderation/01`'s priority in the handoff, which currently sits
  below Discord sign-in.
- Decide the exposure is acceptable for a prototype with disposable data, and say so
  explicitly on the map rather than by omission.

Not a dependency the tracker can express as a blocking edge, because `moderation/01` is not
a ticket on this map. Whatever is decided goes in the spec as a stated precondition.
