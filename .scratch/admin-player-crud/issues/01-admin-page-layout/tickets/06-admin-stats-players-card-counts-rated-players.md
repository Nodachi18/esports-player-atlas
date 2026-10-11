# The admin "players" card counts rated players, not players

Type: task
Status: open
Blocked by: —
Map: ../../../map.md
Found by: ../prototype.md

## Problem

`GET /api/admin/stats` builds every total from the `ratings` table
(`src/worker.js:125`):

```sql
select count(*) ratings,
       sum(panel='community') community,
       sum(panel='professional') professional,
       sum(flagged) flagged,
       count(distinct player_id) players
from ratings
```

`count(distinct player_id)` is **the number of players that have at least one rating**,
and `views.adminPage()` renders it under the label `players`.

Verified against the local Worker on 2026-10-11: `/api/players` returns 39 rows and
`/api/admin/stats` returns `"players": 0`. The admin page shows **0 players**.

On the live site the same query reports 3, because 3 of the 38 players have a rating. An
admin looking at that card is told the roster holds three people.

It also means the card an admin would check after creating a player never moves, which is
exactly the moment the number is being read.

## Fix

Count players from `players`, not from `ratings` — `select count(*) from players where
active=1`, matching what every read filter already does (decision 5 keeps `active`
vestigial but still filtered).

Keep the rated-player count if it is wanted, under a label that says what it is: `rated`.
With 3 of 38 rated that is the more interesting of the two numbers, and it is the same
gap [frontend/01](../../../../frontend/01-unrated-players-in-ranked-views.md) is about.

## Test

`test/` has no coverage of `/api/admin/stats`. A test asserting the players total matches
the roster size is what stops this coming back.
