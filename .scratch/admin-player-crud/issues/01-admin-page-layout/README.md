# 01 — Lay out the admin page around the player form

Everything that came out of [the ticket](../01-admin-page-layout.md).

| File | What it holds |
|---|---|
| [prototype.md](prototype.md) | What was built, how to run it, what each variant argues |
| [design-plan.md](design-plan.md) | The design pass: the brief, the plan, and what got cut |
| [decisions.md](decisions.md) | Why A won and B and C lost. The decision itself is the ticket's `## Answer` |
| [tickets/](tickets/) | New work the prototype uncovered |
| [shots/](shots/) | Screenshots, 1440×1000, for reading without running anything |

The prototype code itself is **not** in here, and it is **not in the repository at
all**. It had to be served by Wrangler to sit in the real chrome, so it lived at
`public/prototype/` on a working copy and was throwaway — see [prototype.md](prototype.md)
for why it must not reach `main`. It never did, and the admin form shipped without it on
2026-10-12, so [shots/](shots/) is what is left of it.

## Tickets opened from here

- [01 — The stats cards paint data in the role tint](tickets/01-stat-cards-use-the-role-tint.md) — **resolved** by the build: the cards became a totals line in `--ink`, per-player figures take `--lens`
- [02 — Destruction needs a colour that is neither tint](tickets/02-a-token-for-destructive-actions.md) — **resolved** by the build: `--danger` and `--danger-sunk` are tokens in `:root`
- [03 — Per-player rating counts have no endpoint](tickets/03-rating-counts-have-no-endpoint.md) — **resolved** on [03](../03-form-behaviour-contract.md); decision 8 unblocked
- [04 — The global ratings table loses its home](tickets/04-where-the-global-ratings-table-goes.md)
- [05 — The header search does not say it drives the admin roster](tickets/05-search-does-two-jobs.md) — **resolved** by the ticket's answer
- [06 — The admin "players" card counts rated players, not players](tickets/06-admin-stats-players-card-counts-rated-players.md) — a live defect, verified

None of these blocked issue 01, which is resolved. **03 is the one that blocks work**:
decision 8's guard cannot state a rating count that no endpoint returns, and it has been
handed to [issue 03](../03-form-behaviour-contract.md) because it is a route-shape
question. **06 is independent of this map** — a one-line defect on live, fixable now.
01, 02 and 04 were follow-ups with nothing waiting on them; the build answered the first
two, and **04 is the only one still open**.

## Three things here were overridden by 03

[03](../03-form-behaviour-contract.md) is later than this ticket and wins where they
disagree. A reader arriving at this folder for the layout will otherwise carry away three
things that are no longer true:

1. **The live slug preview is withdrawn**, with its four lines of copy — typing `Flash`
   no longer shows `/flash-2` and *flash is taken, so this becomes flash-2*. Slug
   derivation lives in the backend only; the slug first appears in the create success
   message, *Created BoxeR at `/boxer`*.
2. **Duplicate handles are now impossible.** `players.name` is unique, case-insensitively,
   so the second `Flash` is a `409` rather than a suffixed slug. That is what replaced the
   preview as the answer to "the admin thinks they edited Flash".
3. **The `401` requirement is withdrawn.** *Your admin session expired … everything you
   typed is still here* is not built; the expired-token case keeps today's behaviour and
   loses the form. The draft does survive a re-render, which is a different and more
   frequent problem 03 found while looking at this one.

Everything else here — variant A, the rail, the totals line, the delete modal, the mode
tags, `Handle` as the label for `players.name` — stands.

## Notes written back onto open tickets

- [03 — form behaviour contract](../03-form-behaviour-contract.md): where messages go,
  what create does about slug collisions, and the missing rating-count endpoint. Now
  unblocked.
- [04 — where the global ratings table goes](tickets/04-where-the-global-ratings-table-goes.md):
  narrowed, because the ticket's answer settled the immediate half.
- [map.md](../../map.md): one line under Decisions so far.
