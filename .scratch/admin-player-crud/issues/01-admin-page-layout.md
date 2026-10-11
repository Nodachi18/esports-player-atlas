# Lay out the admin page around the player form

Type: prototype
Status: open
Blocked by: —
Map: ../map.md

## Question

What does the admin page actually look like once a player form lives in it?

Today it is 17 lines: three stat cards and a ratings table behind a "Load ratings" button
(`public/app/views.js:281`). The form, the Selection it reads, and the create path all have
to find a place in that, and the page has to make its mode obvious — decision 4 means the
same form is Create or Edit depending only on whether a Selection exists, which is exactly
the kind of state that reads as a bug when it is not shown.

Produce a throwaway prototype to react to — cheap and rough, not the real implementation.
Render, side by side:

- **No Selection** — the create form, empty, and whatever tells you that is what you are
  looking at.
- **A Selection** — the same form loaded with a Player, Save and Delete present, slug shown
  read-only (decision 7).
- **The delete dialog** — naming the Player, stating the exact number of Ratings that will
  be destroyed, with Delete disabled until the slug is typed (decision 8).

Open questions the prototype should answer rather than assume: whether the stats cards and
ratings table stay above the form, below it, or move; how the header search and the form
sit together when searching is how you pick what to edit (decision 3); whether "New player"
is a button, a tab, or just the state you get by clearing the search.

Call the `prototype` and `frontend-design` skills. Note the two-tint rule from the handoff:
`--role` colours the chrome, `--lens` colours the data, and collapsing them makes an admin
see amber scores.
