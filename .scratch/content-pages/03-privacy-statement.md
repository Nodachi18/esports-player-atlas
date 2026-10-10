# Privacy statement

Status: resolved
Type: task
Source: the "Still open" section of
[02-legal-notice-private-site.md](02-legal-notice-private-site.md)

## Why this is not covered by the legal notice

[02](02-legal-notice-private-site.md) established that § 5 DDG does not reach a private,
non-commercial site, so no provider information is published. **That reasoning does not
carry over.** § 5 DDG scopes on commercial purpose; the GDPR does not, and the household
exemption in Art. 2(2)(c) does not reach a site published to the open internet. Art. 13
information duties apply to this prototype as it stands today, hobby or not.

So: a separate page, a separate footer link, and prose that describes what actually
happens rather than boilerplate.

## What is actually processed, read out of the code

Written down here because the page must not say more than is true, and because the next
person to change the schema needs to know the page exists.

**In D1** ([migrations/0001_init.sql](../../migrations/0001_init.sql)):

| Table | Personal data | Note |
|---|---|---|
| `players` | `name`, `real_name`, `game`, `faction`, `style`, `notes` | Real competitors. Entered by an admin. Nobody consented. |
| `ratings` | `voter_hash`, five scores, `created_at`, `flagged` | About a player, by a rater |
| `pro_invites` | `code_hash`, `label` | The label is operator-chosen and may name someone |
| `player_stats` | — | Aggregates only |

`voter_hash` is `sha256('community:' + <random browser token>)` or `sha256('pro:' +
<invite id>)` ([src/worker.js](../../src/worker.js)). It is not reversible to a person,
but it is **stable**: every rating cast from the same browser carries the same hash, so
they are linkable to each other. That is what enforces one rating per player per panel.

**No IP address, email address or rater name is stored in D1 at all.**

**In the browser**: `localStorage.voterAtlas` (the voter token),
`localStorage.proAtlas` (professional token, 30 days), `sessionStorage.adminAtlas` (admin
token, 8 hours). No cookies. No analytics.

**At Cloudflare**: hosting is Workers + D1, so every request terminates at Cloudflare and
it necessarily sees connection data including IP address and user agent.
`observability.enabled` is `true` in [wrangler.jsonc](../../wrangler.jsonc), which means
Workers Logs retains request metadata for a period Cloudflare sets. Cloudflare is the
processor; the operator is the controller.

## Decisions

1. **Its own page at `?page=privacy`**, its own footer link, not a section of the legal
   notice. They answer different questions and a reader looking for one should not have to
   read the other.

2. **Describe the mechanism, not the category** — where the mechanism is what happens to
   the reader. "Which player, which panel, five scores, the time, and a hash that cannot be
   turned back into you" is the fact; "we may process technical data" is the boilerplate
   that hides it.

   **Revised 2026-10-11, by the operator.** An earlier draft carried on past that: that the
   hash is stable, that one browser's ratings are therefore linkable to each other, that
   clearing site storage mints a new token and lets you rate a player twice. Cut. It
   describes how the one-rating-per-panel rule is enforced — an implementation property of
   this site, not an exposure of the reader — and the last part reads as instructions for
   getting around it. The line between the two is *what happens to the person reading*;
   everything on the page has to be on that side of it. The mechanism stays recorded here,
   where the next person to touch the schema will look.

3. **Google Fonts is disclosed, not quietly fixed here.**
   [public/index.html](../../public/index.html) loads Barlow from `fonts.googleapis.com`
   and `fonts.gstatic.com`, so a visitor's browser connects to Google and Google receives
   their IP address before any choice is offered. This is the one third-party that sees a
   visitor at all. Disclosing it is this ticket; **removing it by self-hosting the two
   font families is a separate ticket and the better end state.**

   **Superseded 2026-10-11.** That ticket is
   [04-self-host-the-fonts.md](04-self-host-the-fonts.md), and it is done: the files are
   served from this origin and the section has been removed from the page rather than
   reworded. Disclosure was the right answer only for as long as the connection existed.

4. **The Discord section ships as `planned`, visibly.** See below.

5. **No sentence about the page, and no argument.** *Added 2026-10-11, after the operator
   cut several.* The page had grown an intro explaining what the page was for, a line
   saying the Discord section was published early on purpose, a promise that it would be
   rewritten before sign-in landed, and a note that a hobby project is not exempt from the
   GDPR. All true, none of it about the reader's data.

   The test: **does this sentence change what the reader knows about what happens to
   them?** An intro orienting them does not. A defence against an objection they have not
   raised does not. A promise about how the file will be maintained is addressed to
   whoever edits it, and belongs in this ticket instead — which is where it now is.

   It applies to [02](02-legal-notice-private-site.md) equally: "That is not a reason to be
   unreachable" went the same way. Same rule for the Help page when it gets written.

## The Discord placeholder

[accounts/01](../accounts/01-discord-oauth-sign-in.md) changes what this page has to say,
fundamentally. Today a rating is attached to a browser token that resets in two clicks.
Afterwards it is attached to a Discord account: a snowflake, a username, an avatar, and —
the part that matters — **every rating that account has ever cast becomes attributable to
one identifiable person and linkable to each other across players.**

That is not a footnote to the current page, it is a different page. So the section is
rendered now, marked `planned` in the repo's established sense — *not built yet, and
nothing else* — saying plainly what will change and that nothing of it happens today.

Two reasons to publish it before it is true, rather than after:

- A reader deciding whether to rate a player can see where this is going.
- It is the reminder. A `planned` block in the live page is harder to forget than a line in
  a ticket, and it reads as an obvious lie the moment sign-in ships, which is precisely the
  pressure wanted. A matching note goes on accounts/01.

## Done when

- `?page=privacy` renders, and the footer carries the link.
- Every claim on the page is checkable against the schema and the Worker.
- The Discord section is present, marked `planned`, and accounts/01 points back at it.
- Tests pin the claims that would quietly go stale: the `planned` marking, and the fact
  that no third party other than the two disclosed ones is contacted.

**Resolved 2026-10-11.** The page is built, the Discord section ships marked `planned`,
and [accounts/01](../accounts/01-discord-oauth-sign-in.md) carries the note that rewriting
it is part of shipping sign-in. The Google Fonts item it left open became
[04](04-self-host-the-fonts.md) and is done.
