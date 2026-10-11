# 01 — Lay out the admin page around the player form

Everything that came out of [the ticket](../01-admin-page-layout.md).

| File | What it holds |
|---|---|
| [prototype.md](prototype.md) | What was built, how to run it, what each variant argues |
| [design-plan.md](design-plan.md) | The design pass: the brief, the plan, and what got cut |
| [decisions.md](decisions.md) | Why A won and B and C lost. The decision itself is the ticket's `## Answer` |
| [tickets/](tickets/) | New work the prototype uncovered |
| [shots/](shots/) | Screenshots, 1440×1000, for reading without running anything |

The prototype code itself is **not** in here. It has to be served by Wrangler to sit in
the real chrome, so it lives at [`public/prototype/`](../../../../public/prototype/) and
is throwaway: see [prototype.md](prototype.md) for why it must not reach `main`.

## Tickets opened from here

- [01 — The stats cards paint data in the role tint](tickets/01-stat-cards-use-the-role-tint.md)
- [02 — Destruction needs a colour that is neither tint](tickets/02-a-token-for-destructive-actions.md)
- [03 — Per-player rating counts have no endpoint](tickets/03-rating-counts-have-no-endpoint.md) — blocks decision 8
- [04 — The global ratings table loses its home](tickets/04-where-the-global-ratings-table-goes.md)
- [05 — The header search does not say it drives the admin roster](tickets/05-search-does-two-jobs.md) — **resolved** by the ticket's answer
- [06 — The admin "players" card counts rated players, not players](tickets/06-admin-stats-players-card-counts-rated-players.md) — a live defect, verified

None of these blocked issue 01, which is resolved. **03 is the one that blocks work**:
decision 8's guard cannot state a rating count that no endpoint returns, and it has been
handed to [issue 03](../03-form-behaviour-contract.md) because it is a route-shape
question. **06 is independent of this map** — a one-line defect on live, fixable now.
01, 02 and 04 are follow-ups with nothing waiting on them.

## Notes written back onto open tickets

- [03 — form behaviour contract](../03-form-behaviour-contract.md): where messages go,
  what create does about slug collisions, and the missing rating-count endpoint. Now
  unblocked.
- [04 — where the global ratings table goes](tickets/04-where-the-global-ratings-table-goes.md):
  narrowed, because the ticket's answer settled the immediate half.
- [map.md](../../map.md): one line under Decisions so far.
