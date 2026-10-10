# The header's single row is full

Status: ready-for-agent
Source: navigation-overhaul spec §15, found while prototyping variant A

## Problem

The header is one dense command bar: brand, search, navigation, auth control. At 1280px in
the admin state it does not fit. Before it was caught, the search field collapsed to a
sliver.

It currently wraps the auth controls onto a second row rather than clipping them, which is
honest but was a stopgap, not a decision. Every item added to the navigation makes it worse,
and sign-in is still a short `planned` label — the real "Sign in with Discord" button plus an
admin indicator will be wider than what is there now.

## Options

1. **Shorten the sign-in label** once it is real. The Discord glyph carries recognition;
   "Sign in" plus the mark may be enough. Weigh against the research note that an unlabelled
   control jumping to `discord.com` reads as a phishing attempt.
2. **Fold the admin indicator into the Admin nav item** rather than standing beside it.
3. **Accept two rows in the admin state alone**, which is what happens today, and say so
   deliberately.
4. **Collapse the navigation into a menu** below some width.

## Why ready-for-agent

The options are enumerated and the constraint is measurable: all states must fit one row at
1280px, or wrap deliberately rather than by accident.

## Done when

No state overflows or collapses a control at 1280px, and whichever behaviour was chosen is
described in `README.md`'s frontend section.
