# Destruction needs a colour that is neither tint

Type: task
Status: resolved
Blocked by: —
Map: ../../../map.md
Found by: ../prototype.md

## Problem

The two-tint rule covers who you are (`--role`) and which panel you are reading
(`--lens`). An irreversible cascading delete is neither, and the admin page is about to
grow the most dangerous control on the site.

- Amber (`--role`) would make the delete button look like the save button and collapse
  chrome into data.
- `--lens` would make a destruction count look like a score.

There is already a red in the stylesheet — `#ff7a7a`, hardcoded twice, as `.result.bad`'s
left border and as `.err`'s colour (`#ff9b9b`, a third near-identical value). None of them
is a token, so the delete work would add a fourth.

## What to decide

Promote one value to a token — the prototype uses `--danger: #ff7a7a` with
`--danger-sunk: #1d0f12` behind it — and fold the existing hardcoded reds into it, or
decide explicitly that destructive affordances reuse something that already exists.

Then write the rule down next to `--role` and `--lens` in `:root`, because the pair is
currently documented as exhaustive and would no longer be:

```
  --role   who you are        chrome
  --lens   which panel        data
  --danger what cannot be undone
```

## Check while you are there

`.result.ok` uses `#6fd08c`, also hardcoded. Same question, lower stakes.

## Answer

**Resolved 2026-10-12 by the build (`9ee0da8`): `--danger` and `--danger-sunk` are tokens
in `:root`, with the rule written beside `--role` and `--lens`.**

```
  --danger: #ff7a7a;
  --danger-sunk: #1d0f12;
```

The comment above them states the rule the ticket asked for — destruction is neither tint,
amber would make it chrome and `--lens` would make it look like a score — and `.result.bad`
now points at the token instead of repeating the hex. The delete button, its disabled
state and the guard's border all use it.

**Two near-misses survive**, both the "check while you are there" half of this ticket and
neither worth reopening on its own: `.err` is still `#ff9b9b` and `.result.ok` is still
`#6fd08c`. Fold them in next time either line is touched — `.err` is a failure, so it is
the same token; the green wants one of its own if it ever gets a second use.
