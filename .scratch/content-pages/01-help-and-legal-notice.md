# Fill in Help and Legal notice

Status: resolved
See also: [02-legal-notice-private-site.md](02-legal-notice-private-site.md)
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

## Comments

**2026-10-10 — Legal notice split out and answered.** The operator supplied the fact that
was missing: this is a private, non-commercial hobby project, so § 5 DDG does not attach and
no provider information is published. Contact is a link to an existing public contact card,
`nofollow` and never mirrored. The reasoning, the decisions and the heading question from
decision 13 are in [02-legal-notice-private-site.md](02-legal-notice-private-site.md), and
the page is built.

**What is left on this ticket is Help**, which is still an editorial call on what readers
actually ask — the four candidate questions above have had no answer. The footer link stays
`planned` until they do.

**A privacy statement is still unwritten** and is *not* covered by the private-site
exemption: § 5 DDG scopes on commercial purpose, the GDPR does not. See the "Still open"
section of 02.

**2026-10-11 — Help is built, and this ticket closes.** The editorial call the ticket was
waiting on turned out not to need one: all four candidate questions were already answered
in [CONTEXT.md](../../CONTEXT.md), so what was missing was never the content, only the
decision to publish it.

The page answers the four as written, one card each, and closes on a link to the legal
notice — where a reader who has just learned the scores are opinions needs to go next.

**It answers them in the reader's terms, not the implementation's.** A first draft was
written out of [src/stats.js](../../src/stats.js) and quoted the maths: the Combined
formula, the three-standard-deviation flagging threshold, the eight-rating minimum, which
browser value identifies a rater. All accurate, none of it an answer to what the reader
asked. The rule that survived the rewrite, and that a test now enforces: **a reader wants
to know what the scores mean, not how they are computed.** No formulas, no thresholds, no
naming of what is stored where.

The weighting is the one number that stayed, as the word "twice", because "a professional
rating counts for twice as much" *is* the answer to the first question rather than a detail
of it. A test imports `PRO_WEIGHT` and fails if that word stops being true.

Two things the page says that the repo had not said out loud anywhere:

- **Combined is not an average with zero.** A player no professional has rated shows their
  community score as Combined. With 3 ratings live across 38 players, that is every rated
  player on the site right now.
- **Nobody can currently become a professional.** The panel is invite-only and there is no
  reachable way to request an invite or redeem one — `POST /api/pro/verify` exists, nothing
  writes `localStorage.proAtlas`. The page says so plainly rather than describing a route
  that cannot be walked. [accounts/05](../accounts/05-retire-pro-invite-surface.md) retires
  the arrangement; [accounts/01](../accounts/01-discord-oauth-sign-in.md) is what reopens
  the panel.

The footer now carries three real links and nothing `planned`.
