# The global ratings table loses its home

Type: grilling
Status: open
Blocked by: —
Map: ../../../map.md
Found by: ../decisions.md

## Problem

The admin page is 17 lines today and the ratings table is most of it: every rating on the
site, newest first, up to 1000, behind a `Load ratings` button
(`public/app/views.js:281`, `GET /api/admin/ratings`).

All three layout variants demote it, and they disagree about where to:

- **A** replaces it with a per-player disclosure under the form and leaves an `All
  ratings` link pointing nowhere.
- **B** keeps it on the page, below the form, under a `Site overview` heading.
- **C** moves it to an `Overview` tab.

## Already decided, so this ticket is narrower than it was

[Issue 01](../../01-admin-page-layout.md) settled the immediate question: **the global
table stays on `?page=admin`, at the bottom, behind today's `Load ratings` button,
unchanged**, and a per-player disclosure appears under the form. Nothing moves in this
map. The flagged column is why — it is the only route to
`POST /api/admin/ratings/flag`, and hiding the table would hide flagging with it.

## What is still open

- **Where it belongs long term.** Rating moderation
  ([moderation/03](../../../../moderation/03-ban-accounts-and-moderate-ratings.md)) is the
  natural owner of a list of ratings with a flag control. If that lands, the admin page
  should probably not carry a second one.
- **Does `Load ratings` stay a button?** It exists because the endpoint returns up to 1000
  rows. With 3 rows live the button is ceremony; at 1000 it is a page that should paginate
  rather than a click.
- **How deep the per-player view goes.** Issue 01 gives it one disclosure and one
  read-only count. The map's fog item asks whether it stays counts-only or becomes a link
  into moderation.

Not a blocker for anything on this map.
