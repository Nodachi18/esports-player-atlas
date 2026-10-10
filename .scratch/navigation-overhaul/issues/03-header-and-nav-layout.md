# Static header and main nav layout

Type: prototype
Status: resolved
Blocked by: 01, 02
Map: ../map.md

## Question

What does the header actually look like?

Produce a throwaway prototype of the static header, main nav and footer to react to —
cheap and rough, not the real implementation (decision 1). It must carry the brand block,
search, the four nav items, the auth control and the footer links.

Render every state the Notes fix, side by side so they can be compared:

- **Anonymous** — Voting visible and prompting sign-in (decision 12), Profile absent.
- **Community** — Profile present as the account page (decision 11).
- **Professional** — same, plus whatever decision 3's "edit my Player" entry turns out to
  need.
- **Admin-with-key** — Admin behaving as it does today, since no admin Role exists yet.

Planned items (Hilfe, Impressum, and anything else not built) appear disabled and marked
(decision 2); role-forbidden items are absent entirely (decision 10).

Calls the `frontend-design` skill. The prototype is linked from this ticket as an asset,
not pasted into it.

## Prototype

`public/prototype-header.html` — **throwaway, must not ship.** Served at
<http://localhost:8787/prototype-header.html>, reading the real `/api` so density is judged
against real data.

- `?variant=A|B|C` — A: command bar, one dense row. B: two tier, utility over navigation.
  C: rail, navigation is vertical. Arrow keys or the floating bar cycle them.
- `?state=anon|community|professional|adminkey` — buttons in the floating bar.

Design tokens: the app's existing navy palette, extended with `#ffb259` for admin. Barlow
Condensed for brand and nav, Barlow for UI. The radar pentagon doubles as the brand mark
and the active-nav marker.

### Findings while building

- **Role-as-colour has to stop at the chrome.** Tinting the whole page by role means an
  Admin viewing a community panel sees amber scores, which reads as a fourth panel that
  does not exist. The tint belongs to header, nav and identity only; the radar and scores
  keep their own panel colour. The prototype currently tints everything, which is what
  exposed it — judge the chrome, ignore the data colour.
- **Admin is orthogonal to accounts.** The `adminkey` state renders as signed-out *plus*
  Admin, because the key is not an Account (decision 3). Seeing it makes the oddity
  concrete: Profile is absent while Admin is present.
- Variant C leaves the rail's footer stranded at the bottom of a tall empty column, and
  narrows the content enough to shrink the radar noticeably.

### Variant A chosen (2026-10-10), lens added

The existing `#view` control (combined / community / professional) was missing. It is now a
**lens** in the header — one global control, since the same three options exist twice today
as `#view` on the profile and `#metric` on the leaderboard.

That fixes the colour collision above: **the lens colours the data, the role colours the
chrome.** Two tints, two meanings. It also separates Combined from Community, which the
current app renders in the same blue (`#75c8fa` for both) — Combined now reads as neutral
`#dfeefb`, so the three options are finally distinguishable.

- `?lens=combined|community|professional`.

### Finding: A's single row is full

With the lens added, variant A does **not** fit one row at 1280px in the admin-key state —
brand, search, four nav items, three lens buttons, the key pill and the Discord button
together overflow. The prototype now wraps the auth controls to a second row rather than
clipping them. Options for the spec: shorten the sign-in label, fold the key pill into the
Admin item, or accept a two-row header in that one state.

### Content area, and the lens moved (2026-10-10)

A broadcast-overlay reference settled the lens placement: **it belongs to the pentagon, not
to the chrome.** It now sits inside the ratings panel, spanning the radar it filters. The
global-lens idea is dropped; the leaderboard keeps its own `#metric`.

The content area is now what the primary nav swaps, rather than v3's everything-on-one-page.
Non-players items render an honest placeholder naming what will go there (`?page=`).

The players page follows the reference: portrait, name over real name, three labelled fact
sections, and the pentagon carrying its label and score at each vertex. `?player=` switches
between players; the header search is the other way in.

### Finding: two fields in the reference have no data behind them

`players` holds `name`, `real_name`, `game`, `faction`, `style`, `notes` — so **Style**,
**Notes**, the real name and the faction badge are real. The reference also shows a
**profile image** and a **Form** line, and neither exists in the schema. Both render as
`geplant` per decision 2 rather than being faked with stock content.

Adding them is a migration plus admin editing UI, which is past this map's destination.
Recorded as fog on the map.

## Answer

**Variant A, the single command bar**, carrying brand, search, nav and the auth control.

The **lens belongs to the pentagon**, inside the ratings panel, spanning the radar it
filters. Not global chrome. The leaderboard keeps its own metric control.

The **content area is what the primary nav swaps**, replacing v3's one-page tab toggling.

**Players is one view over the ranked list and the search result.** It opens on the
top-ranked player in full detail, with a paginated strip of the next-best above it —
rank, name, game, faction, score — moved through with arrows. Typing in the header search
turns the same strip into the search result and the detail follows the top hit.

Layout of the detail, following the broadcast reference: portrait, name over real name,
three labelled fact sections (Style / Form / Notes), and the pentagon carrying its label and
score at each vertex.

### Findings carried into the spec

- **Role tint and lens tint are different things.** Who you are colours the chrome; what you
  are reading colours the data. Tinting both by role made an Admin see amber scores, which
  reads as a fourth panel that does not exist.
- **Combined needs its own colour.** The live app paints Combined and Community in the same
  `#75c8fa`, so the two readings are indistinguishable. Combined is now neutral `#dfeefb`.
- **Variant A's single row is full.** At 1280px in the admin-key state it overflows, so the
  auth controls wrap to a second row. Spec decides: shorten the sign-in label, fold the key
  pill into the Admin item, or accept two rows in that one state.
- **Two fields in the reference have no data**: a profile image and Form. Both render as
  `planned`; adding them is a migration plus admin editing UI, recorded as map fog.
- **The leaderboard route drops unrated players** (`value == null` is filtered out), so
  Players-as-leaderboard would hide every newly created player. The prototype fetches
  `/api/players` as well and appends them unranked. The spec must say where unrated players
  appear, because the ranked strip alone cannot show them.
- `/api/leaderboard` returns **whole profiles**, not just names and scores, so one call
  feeds the strip and the detail with no second fetch on select.

Prototype remains at `public/prototype-header.html` — throwaway, delete before deploying.
