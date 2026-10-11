# Design plan

Written before the code, per the `frontend-design` skill's two passes, and kept here with
what the build changed.

## The brief pins almost everything

This is not a new identity. The site has one: a near-black navy ground (`#050b10`), Barlow
and Barlow Condensed, 3–4px radii, hairline `#23445a` borders, uppercase condensed
wordmark. The skill's rule is that the brief's own words win, so palette and type were not
up for redesign. **The design question here is layout and information hierarchy**, and
that is where all three variants disagree.

What *was* open:

| Axis | Decision |
|---|---|
| Colour | Existing tokens, plus one new value for destruction (below) |
| Type | Existing: Barlow for prose and inputs, Barlow Condensed for names, numbers, buttons |
| Layout | The whole question. Three structurally different answers, not three skins |
| Copy | Written fresh; see below |

## The subject matter, and what it implies

The admin is one person with a shared key, maintaining 38 rows of other people's names
against public competitive records. Not a dashboard: a **workbench**. That argues for
density over whitespace, for the roster being present rather than summoned, and against
treating the page as a marketing surface. It also argues that the most dangerous control
on the site — an irreversible cascading delete, on a live public site, with no backup —
should not look like the other buttons.

## Colour: the third tint

`--role` says who you are and colours the chrome; `--lens` says which panel you are
reading and colours the data. The handoff is explicit that collapsing them makes an admin
see amber scores.

An irreversible destruction is neither. Painting it amber collapses chrome into data,
exactly the trap. Painting it `--lens` makes it look like a score. So the guard uses
`#ff7a7a` — **already in `styles.css`** as `.result.bad`'s left border — promoted in the
prototype to `--danger`, with `--danger-sunk: #1d0f12` behind it. Every red pixel on the
page is a destruction or a failure, and nothing else is red.

That value is not a token in the real stylesheet yet; see
[tickets/02](tickets/02-a-token-for-destructive-actions.md).

## Type: one correction to the existing scale

`.pt-fl` field labels follow the existing uppercase-micro-label idiom (`.stat span`,
`.fact .k`, `.controls label`). The `frontend-design` skill warns against all-caps labels
as a generated-page tell — but here the convention is already the house style across five
components, and inventing a second label treatment on one page would be noise, not
distinction. Consistency wins on an axis the brief has already settled.

Handles are set in Barlow Condensed at 42px in the mode line and 17–19px in lists, which
is how the rest of the site already treats a player name. Slugs are the only monospace on
the page, because a slug is a literal string you have to type exactly, twice (once to
confirm a delete).

## Layout: the three sketches

```
A  ROSTER RAIL                            B  ONE COLUMN                 C  MODE TABS
┌────────┬──────────────────────┐   ┌────────────────────────┐   ┌──────────────────────────┐
│ Roster │ ◆EDITING BoxeR /boxer│   │ ▌EDITING BoxeR  [Save] │   │ │Edit│ New │ Overview │  │
│[+ New] │ ┌ Identity ────────┐ │   │ ├────── message ──────┤│   ├──────────────────────────┤
│ Flash 9│ │ handle  real name│ │   │ handle                 │   │ Flash   Lee…  T  Top 3  9│
│ Jaedong│ │ game    faction  │ │   │ real name              │   │ Jaedong Lee…  Z  Top10  7│
│▸BoxeR12│ └──────────────────┘ │   │ game                   │   │▸BoxeR   Lim…  T  Retir 12│
│ NaDa  –│ ┌ Editorial ───────┐ │   │ faction                │   │ ┌ drawer ───────────────┐│
│ …      │ │ style/form/notes │ │   │ style / form / notes   │   │ │ EDITING /boxer        ││
│  (38)  │ └──────────────────┘ │   │ ┌ danger zone ───────┐ │   │ │ handle real game      ││
│        │ [Save]     [Delete]  │   │ │ Delete BoxeR       │ │   │ │ faction form  12 rtgs ││
│        │ ▸ 12 ratings         │   │ └────────────────────┘ │   │ │ style / notes         ││
└────────┴──────────────────────┘   │ ── Site overview ───── │   │ │ [Save][Discard][Del]  ││
 38 players · 39 ratings · 2 flagged │ [38][39][2] + table    │   │ └───────────────────────┘│
                                     └────────────────────────┘   └──────────────────────────┘
```

Alignment is left throughout, as the rest of the site is, with one exception: rating
counts are right-aligned in both list forms, because a column of numbers you scan for
"who has nothing" only works flush.

## Review pass — what changed before building

Three things in the first plan were defaults rather than choices:

1. **Stat cards at the top of all three.** That is just "keep what is there". They are
   site-wide totals and the page is now about one player; leaving them above the form
   makes the first thing you read the least relevant thing on screen. Changed: A demotes
   them to one line at the bottom, B pushes them below the form, C moves them to a tab.
   All three *disagree with today*, which is the useful signal.

2. **"New player" as a button in a toolbar, in every variant.** Same control three times
   is not three answers. Changed: A makes it a pinned row at the head of the list it
   replaces, B a secondary button in the sticky bar, C a tab. Those are the three real
   options the ticket asked about.

3. **A modal confirm in all three.** A modal is the reflex, not a decision. Changed: only
   A is modal; B confirms in an end-of-document danger zone and C confirms in the row.
   Worth seeing whether a non-modal guard reads as weaker, given decision 2 leaves no
   second line of defence.

## One accessory removed

The first build gave variant C a `12 ratings` ghost button in the drawer's action row,
next to Save and Delete. It looked like a third action and did nothing. Cut, and replaced
with a read-only cell in the form grid — which also fixed a ragged row, and put rating
data where the map says it eventually has to go.

## Copy

Buttons say what happens: `Save changes`, `Create player`, `Delete BoxeR and 12 ratings`,
`Keep BoxeR`. No `Submit`, no `Confirm`, no `Are you sure?`.

Hints explain a rule once, where the rule bites:

- Game: *Pick an existing game or type a new one. Spelling it differently splits the
  roster.* — decision 11's actual risk, not a description of a datalist.
- Form: *Your judgement of where they stand. Never calculated from ratings.* — the
  glossary's definition, in the admin's second person.
- Slug: *The slug is this player's public address and is in every link ever shared. It
  cannot change.* — decision 7's reason, which is more useful than the rule.
- The guard: *Typing the slug is the only confirmation. A dialog you can dismiss with a
  reflexive Enter is not a guard.* — decision 8, said to the person it constrains.

The empty state is not empty: with no Selection the page is a create form that already
shows the slug it is about to mint.
