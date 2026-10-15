# Terms of service

Status: resolved
Type: task
Source: grilling session 2026-10-16; prerequisite to
[../accounts/01-discord-oauth-sign-in.md](../accounts/01-discord-oauth-sign-in.md)
Blocks: ../accounts/01-discord-oauth-sign-in.md

## Why this page exists

Sign-in changes what a rating is. Today it is attached to a browser token that resets in
two clicks; afterwards it is attached to a Discord account, and every rating that account
has ever cast becomes attributable to one identifiable person. The moment there are
accounts there are rules — what gets an account blocked, what happens to its ratings, what
the site promises and does not.

The site has no page that states them. [02](02-legal-notice-private-site.md) is about the
operator, [03](03-privacy-statement.md) is about data. Neither is about what the reader may
and may not do.

**The driver is the site's own need, not a Discord form field.** The developer portal has
Terms of Service and Privacy Policy URL fields on the General Information page, and filling
the first one is a free side-effect of this ticket — but neither the
[OAuth research](../navigation-overhaul/research/01-discord-oauth.md) nor Discord's public
documentation establishes that an OAuth app is gated on it. Do not write this page as
though the portal were the reason. If the portal turns out to demand it, this ticket has
already satisfied the demand.

## Register: house rules, not a contract

Plain English, the same voice as [02](02-legal-notice-private-site.md) and
[03](03-privacy-statement.md). **No AGB boilerplate.** No acceptance clause, no liability
limitation, no governing-law paragraph, no "we may update these terms at any time".

The reasoning is the one [02](02-legal-notice-private-site.md) already made when it threw
out the German *Haftung für Inhalte / Haftung für Links* blocks: that boilerplate is
written for a commercial service with something to enforce. A private, non-commercial hobby
project where no money changes hands has nothing to contract over. What is worth saying is
narrower and specific to this app.

Heading is **"Terms of service"**, nothing more. The bilingual
"Legal notice · Impressum" treatment in [02](02-legal-notice-private-site.md) was for a
specific reader behaviour — a German reader who believes provider information is missing
searches the page for *Impressum*. Nobody searches a hobby site for *Nutzungsbedingungen*,
and *AGB* is the wrong register besides.

## The rules

Nine, and nothing else. Every one is either true today or decided here.

**What the site is**

1. A private, non-commercial hobby prototype. It may change or disappear; nothing here is
   guaranteed to be kept.
2. Ratings are opinions submitted by visitors about named real people — not facts, not
   verified, not a measurement.

**Rating**

3. One rating per player per panel.
4. The combined score weights the professional panel above the community panel. A product
   choice, not a measurement of anybody.
5. An admin can flag a rating; flagged ratings leave the published scores.
6. One account per person. Rating from several accounts is grounds for blocking.

**Accounts** — true once [../accounts/01](../accounts/01-discord-oauth-sign-in.md) lands;
see "Shipping before sign-in" below for how to write them now.

7. Rating requires signing in with Discord. The site stores the Discord account id, and the
   username and avatar as a display cache. No email address.
8. An account can be blocked. A blocked account cannot sign in.
9. Ratings cast by a blocked account are removed from the site.

**If you appear here**

10. Anyone rated can ask to be removed, through the contact card on the legal notice.

## Decisions

1. **Its own page at `?page=terms`, a fourth footer link.** Following
   [03](03-privacy-statement.md) decision 1: the legal notice is about the operator, the
   privacy statement is about data, this is about the reader's conduct. Three questions,
   three pages, and a reader looking for one should not have to read the others.

2. **Rule 9 says "removed from the site"; the implementation excludes rather than deletes.**
   These are different things and the difference is deliberate. Deletion is irreversible and
   an unban cannot restore the rows. Exclusion keeps them, drops them out of the published
   aggregates the way flagged ratings already are, and keeps the evidence the block was
   based on.

   "Removed from the site" is true to the reader either way — the ratings stop being
   published, which is the part that happens to them — without promising a deletion the
   moderation story will want back.

   **Why exclusion specifically:** it leaves room for a strike rule later — a count of
   flagged ratings per account leading to a block — which is impossible if the rows are
   gone. That rule is *not* decided and must not appear on the page.

   This closes one of the open questions in
   [../moderation/03](../moderation/03-ban-accounts-and-moderate-ratings.md) ("what a ban
   does to ratings already cast"). It does **not** close that ticket's other one, whether a
   human confirms before a block. That question matters more under a strike rule, not less:
   flagging is partly automatic via z-score outlier detection, and the README's statistical
   caveats warn it misclassifies legitimate ratings. An automatic flag feeding an automatic
   block turns a review signal into a punishment. Left where it lives.

3. **Rule 6 is stated even though it cannot be enforced.** The
   [research](../navigation-overhaul/research/01-discord-oauth.md) §3.2 is blunt that a
   second Discord account costs an email address and a few minutes, and §3.3 that the agreed
   bar was "not trivially resettable", never "one human, one account". Stating the rule
   anyway gives a block something to point at — and it is the only abuse route the design
   knowingly leaves open.

4. **No age rule.** Discord's own terms set a minimum and nobody reaches an account here
   without clearing it. Stating a separate one adds a claim this site cannot verify. Silence.

5. **Rules 2 and 10 are repeated from the legal notice, not linked.** They already appear on
   `?page=legal` under "About the ratings" in near-identical words. A reader on either page
   needs both facts; two sentences of duplication is cheaper than sending someone to another
   page for half an answer.

6. **A "last updated" date, and no change clause.** The date is a fact and becomes useful
   once accounts have standing that depends on the rules. "We may update these terms at any
   time" is exactly the sentence [03](03-privacy-statement.md) decision 5 cut: it does not
   change what the reader knows about what happens to them.

7. **`planned` marks the account rules; it does not mark the ones this page omits.** Two
   different cases, and conflating them is what the first draft of this decision did.

   Rules 6-9 are *decided and unbuilt*, which is precisely the case
   [03](03-privacy-statement.md) used the device for. They ship marked.

   The rules this page does not state — a strike rule, ban duration, appeals — are
   *undecided*. A visible block saying "we have not worked out what gets you blocked" reads
   as an invitation rather than a disclosure, so there is none. Ship what is true;
   [../moderation/03](../moderation/03-ban-accounts-and-moderate-ratings.md) reopens this
   page when it lands.

## Shipping before sign-in

**This page ships now, standalone.** That is what makes it a prerequisite rather than a
sub-task of sign-in, and it means the portal's Terms of Service URL has something to point
at before Step 0 of [../accounts/01](../accounts/01-discord-oauth-sign-in.md) is run.

Rules 1-5 and 10 are true of the site today, with zero accounts. Rules 6-9 are about a
sign-in that does not exist yet, so they ship in their own section, **marked `planned`**,
opening on "There are no accounts yet."

**Corrected 2026-10-16, during implementation.** This section originally said to write them
in the present tense. That was wrong, and decision 7 below is what makes it wrong: the
`planned` device is right for a thing that is *decided and unbuilt*, and rules 6-9 are
exactly that. "Rating requires signing in with Discord" is simply false on the live site
today, and [01](01-help-and-legal-notice.md) already settled how this repo handles that
case — the Help page says nobody can currently become a professional "rather than
describing a route that cannot be walked". Same situation, same answer.

What this page must **not** do is describe the current anonymous arrangement as though it
were permanent. There is no rule to write about browser tokens: the voter id is an
implementation of rule 3, not a rule of its own, and [03](03-privacy-statement.md) decision
2 already cut that mechanism from the privacy page for reading as instructions for getting
around it. Same rule here.

## What the page does not say

Carried from [01](01-help-and-legal-notice.md)'s closing rule — *a reader wants to know what
the scores mean, not how they are computed* — and [03](03-privacy-statement.md) decision 5 —
*does this sentence change what the reader knows?*

- No mechanism: no `voter_hash`, no snowflake, no table or column names, no thresholds, no
  formulas. Rule 4 says the professional panel counts for more; it does not say twice, and
  it does not say how.
- No intro explaining what the page is for.
- No defence against an objection nobody raised.
- No strike rule, no ban duration, no appeal process. None of it is decided.
- Nothing about what happens to ratings cast before accounts existed —
  [../accounts/06](../accounts/06-legacy-ratings-after-accounts.md) is `needs-triage` and
  the privacy page has already publicly admitted the question is open. Do not answer it
  here by accident.

## What to build

- `terms` added to `PAGES` in [../../public/app/state.js](../../public/app/state.js).
- A fourth entry in `FOOTER_LINKS` in [../../public/app/nav.js](../../public/app/nav.js),
  label "Terms of service", href `/terms`, `VISIBILITY.visible`.
- `termsPage` in [../../public/app/views.js](../../public/app/views.js), next to
  `legalPage`, `helpPage` and `privacyPage`, and its branch in `main.js`.

## Tests

Pin the claims that would go stale quietly. Precedent is
[../../test/frontend.test.js](../../test/frontend.test.js), which already fails if the Help
page starts talking in formulas.

1. **The footer carries four real links and nothing `planned`.**
2. **The register holds**: the rendered page contains no mechanism vocabulary —
   `voter_hash`, `snowflake`, `localStorage`, table names, numeric thresholds.
3. **Rule 7 stays honest**: fails if the page claims no email address is stored while the
   OAuth scope string requests `email`. This is the one claim on the page that a one-word
   change in [../accounts/01](../accounts/01-discord-oauth-sign-in.md) could silently
   falsify, and it is the test worth having.

Do **not** duplicate the `PRO_WEIGHT` test that guards the word "twice" on the Help page.
Rule 4 here deliberately does not name the number, so there is nothing to pin, and a second
copy only doubles the maintenance.

## Done when

- `?page=terms` renders the ten rules, and the footer carries a fourth real link.
- The heading reads "Terms of service" and the page carries a last-updated date.
- Every claim is checkable against the repo, or is a decision recorded above.
- The three tests pass.
- [../accounts/01](../accounts/01-discord-oauth-sign-in.md) Step 0 lists the Terms of
  Service URL alongside the redirect URIs.

## Comments

**2026-10-16 — built, and this ticket closes.** `?page=terms` renders, the footer carries a
fourth real link, and eight tests cover it.

**One deviation from the ticket as written**, recorded above: the account rules ship marked
`planned` rather than in the present tense. The ticket contradicted itself — decision 7's
own test for when the device applies ("decided and unbuilt") selects rules 6-9, and writing
them as current would have put a false sentence on a page whose only value is being true.

**What the implementation added that the ticket did not ask for:**

- Two extra tests beyond the three specified. The specified three were the footer link, the
  register, and the `email` scope. Added: that rule 4 names no number (which is what makes
  skipping the `PRO_WEIGHT` duplicate safe), that the `planned` marking and its prose are
  both present, that the last-updated date is there and no change clause crept in, that the
  repeated rules 2 and 10 are actually repeated, and that the page has not quietly answered
  [../accounts/06](../accounts/06-legacy-ratings-after-accounts.md).
- A closing note linking the legal notice and the privacy statement. Decision 5 forbade
  *replacing* repeated rules with links; it did not forbid telling a reader where the other
  two pages are, which is one line and is what the privacy page already does.

**Still outstanding, and not this ticket's to fix:** rule 9 is not deliverable against the
current schema. There is no accounts table — migrations stop at `0006_player_name_unique.sql`
— and `ratings` carries only `voter_hash`, with no column connecting a rating to an account.
Either `ratings` gains an account reference or `voter_hash` becomes a hash of the Discord
account id, which the [research](../navigation-overhaul/research/01-discord-oauth.md) §3.3
already suggests for exactly this reason: so that bans have something durable to attach to.
That needs its own ticket under `../accounts/`, and it blocks
[../moderation/03](../moderation/03-ban-accounts-and-moderate-ratings.md) rather than this
page.
