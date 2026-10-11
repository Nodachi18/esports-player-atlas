# The stats cards paint data in the role tint

Type: task
Status: open
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
