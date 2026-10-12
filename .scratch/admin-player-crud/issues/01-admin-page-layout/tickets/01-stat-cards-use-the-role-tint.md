# The stats cards paint data in the role tint

Type: task
Status: resolved
Blocked by: —
Map: ../../../map.md
Found by: ../prototype.md

## Problem

`public/app/styles.css` sets `.stat b { color: var(--admin) }`. The three figures on the
admin page — players, ratings, flagged — are therefore amber, which is the role tint.

That is the collapse `.scratch/HANDOFF.md` warns about, already shipped:

> **Two tints, two meanings.** `--role` colours the chrome and says who you are; `--lens`
> colours the data and says which panel you are reading. Collapsing them makes an admin
> see amber scores, which reads as a fourth panel that does not exist.

Nothing noticed because those three numbers are the only data on the admin page today. The
moment the form lands beside them, and a rating count appears next to a player name, the
page carries both conventions at once and neither reads as a rule.

## What to decide

Either:

- **`--lens`**, for consistency with every other figure on the site (`.card .score`,
  `.lbrow .score`, `.radar .val`, `.slider output`). Totals are data; they get the data
  tint. The prototype assumes this.
- **`--ink`**, on the argument that a site-wide total belongs to no panel at all, so
  neither tint is honest.

Not `--admin`. Whichever is chosen, say so in a comment next to the rule, because the next
person to add a number to this page will copy whatever is already there.

## Scope

One CSS declaration, plus the same question for any new figure the admin form introduces
(the rail's rating counts, the guard's destruction count — the guard's is neither tint, see
[02](02-a-token-for-destructive-actions.md)).

## Answer

**Resolved 2026-10-12 by the build (`9ee0da8`): `--ink` for the totals, `--lens` for
per-player figures, and the amber rule is gone.**

The three stat cards no longer exist — the form took the top of the page and the figures
became a totals line at its foot, `public/app/views.js:totalsLine`. `.stat b` went with
them, so `color: var(--admin)` is not in the stylesheet any more.

- **Site-wide totals take `--ink`** (`.totals b`), on the argument this ticket recorded:
  a total belongs to no panel, so neither tint is honest. The comment above the rule says
  the page is about one player now, which is the same reason stated the other way round.
- **Per-player figures take `--lens`** — the rail's rating counts (`.raillist .r`) and the
  form's read-only cells (`.f.read b`). Those are data about the player on screen, so the
  data tint is right, and this is the convention anyone adding a number to the form should
  copy.

The delete guard's destruction count is neither: it sits inside the `--danger` block, per
[02](02-a-token-for-destructive-actions.md).
