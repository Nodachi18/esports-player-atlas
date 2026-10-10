# Rating history reports means while everything else reports medians

Status: needs-triage
Source: noticed 2026-10-10 while reviewing where the history table comes from

## Problem

`GET /api/history` averages, where the rest of the application takes the median.

`src/worker.js:84` builds `round(avg(<category>),1)` per day and panel. The radar, the
leaderboard and `player_stats` all use `median` via `summarize()` in `src/stats.js`, and
`CONTEXT.md` defines a Player's panel score as the median.

The two disagree on the same data. Sharp, right now, four community ratings on one day:

| | strategy | tactics | micro | macro | decisions |
|---|---|---|---|---|---|
| History (mean) | 92.3 | **85** | 88 | 88.5 | 87.8 |
| Radar (median) | 92.5 | **81.5** | 88 | 89 | 87.5 |

3.5 points apart on tactics, from identical rows. Since the navigation overhaul moved the
history table into the player detail, the two now sit on the same screen — a reader comparing
them will reasonably conclude one is broken.

## Options

1. **Switch history to medians.** Consistent with the glossary and with every other surface.
   SQLite has no `median()` aggregate, so this means either a window-function query or
   computing it in the Worker from the day's rows.
2. **Keep means and label them.** Cheapest, and defensible: a trend line over time is a
   different question from a headline score, and means move more smoothly. The table would
   have to say "daily average" somewhere a reader will see it.

Option 2 is not a cop-out, but it is a product decision rather than a technical one, which
is why this is triage rather than a straight fix.

## Watch out

History is also the only public read that scans `ratings` instead of `player_stats`, so its
D1 rows-read grows with a player's rating count — the opposite of the pattern the rest of the
API follows deliberately. Worth folding into whichever option is chosen.

## Done when

The two agree, or the table says plainly that it is showing something different.
