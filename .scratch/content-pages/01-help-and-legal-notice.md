# Fill in Help and Legal notice

Status: needs-info
Source: navigation-overhaul spec §5 and §15, the original page list

## Problem

Both sit in the footer rendered as `planned`. They were in the page list from the first
sketch and have never had content.

## Help / FAQ

Needs someone to decide what readers actually ask. Candidates from decisions already made,
each of which currently surprises people:

- Why are there two panels, and why is Combined weighted 2:1 toward professionals? The
  README is explicit that this is a configurable product choice and not an objective
  measure — that belongs where readers can see it.
- What does a flagged rating mean? The statistical caveats say flags are review signals, not
  proof of manipulation.
- Why can I only rate a player once per panel?
- How does someone become a professional?

## Legal notice

This is the one that is not a design question — and it is no longer hypothetical. The site
is **live and publicly reachable** at <https://www.esports-player-atlas.workers.dev>, so
whatever obligations attach to a publicly accessible service operated from Germany attach
now, not when it feels finished. `robots.txt` keeps it out of search results; it does not
make it private.

The UI is English throughout, so the label is "Legal notice" (decision 13). But a site
operated from Germany must make provider information **easily recognisable**, and
"Impressum" is the word German readers look for. Decision 13 flagged this for a check before
launch rather than settling it.

Content requires facts only the operator has: who runs it, a contact address, and whatever
else applies. A privacy statement is likely needed alongside it — the app stores Discord
snowflakes and rating history, and the README's pre-production list already names privacy
and data-retention policy.

## Why needs-info

Neither page can be written from the repository. Help needs an editorial call on what to
cover; Legal notice needs operator details and probably a lawyer's eye.

## Done when

Both pages exist with real content, and the footer links stop being `planned`.
