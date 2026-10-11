# The per-player ratings disclosure has no endpoint behind its rows

Type: task
Status: open
Blocked by: —
Map: ../../../map.md
Found by: ../contract.md

## Problem

[01](../../01-admin-page-layout.md) puts a disclosure under the form — `▸ 12 ratings about
BoxeR` — so an editor can see the Ratings attached to the Player they are editing.

[03](../../03-form-behaviour-contract.md) serves the **count**: `/api/players` grows a flat
`ratings` column, which the rail row, the form's read-only Ratings cell and the delete
guard all read. Nothing serves the **rows**.

The only thing that could is `GET /api/admin/ratings`, which returns up to 1000 rows across
every Player (`src/worker.js:138`) and would have to be filtered in the browser. That is
the wrong shape: it grows without bound, it ships every Player's data to render one
Player's, and it is the kind of thing that works at 39 rows and is never revisited.

So the disclosure ships showing the count and a link into the global ratings table at the
bottom of the page, and the rows wait for this.

## What to decide

- Whether this is a new route (`GET /api/admin/players/:slug/ratings`) or a filter on the
  existing one (`GET /api/admin/ratings?player=<slug>`). The second is smaller; the first
  matches the verb-shaped API decision 6 established.
- Whether it is admin-only. The global table is, but per-player ratings are already public
  in aggregate, and `/api/history` publishes daily per-panel averages for one Player
  without a token.
- Whether flagged rows are included. The delete count includes them deliberately
  ([03](../../03-form-behaviour-contract.md)); a disclosure an editor reads is a different
  question, and the flag is the interesting part for anyone moderating.
- Whether it carries the flag control, which would make it a moderation surface and pull
  [01/tickets/04](../../01-admin-page-layout/tickets/04-where-the-global-ratings-table-goes.md)
  forward with it.

The map lists "what the form shows about a Player's Ratings" as fog, and this is that fog
narrowed to one endpoint. It blocks nothing: the disclosure is useful with a count alone.
