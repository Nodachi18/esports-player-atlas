# Legal notice for a private, non-commercial site

Status: resolved
Type: research
Source: split out of [01-help-and-legal-notice.md](01-help-and-legal-notice.md); operator
decision, 2026-10-10

## Question

Ticket 01 was `needs-info` because a legal notice needs facts only the operator has. One of
those facts has now been supplied, and it is the one that decides the shape of the page:
**what is this site, legally?**

## Answer from the operator

Esports Player Atlas is a **private hobby project**. It is non-commercial: nothing is sold,
nothing is advertised, no business purpose sits behind it.

On that basis **§ 5 DDG does not apply**. The Digitale-Dienste-Gesetz replaced § 5 TMG in
May 2024 and carried the same scoping word with it: the duty to publish provider
information binds *geschäftsmäßige, in der Regel gegen Entgelt angebotene* digital
services. A purely private site is outside it. There is therefore **no obligation to
publish a name and postal address**, and the operator has decided not to.

"Private" is the operator's own characterisation of their site, and it is the
characterisation this page publishes. It is not a finding this repository made.

## Decisions

1. **The page states the exemption rather than hiding it.** A site with no provider
   information reads as an oversight. Saying "private, non-commercial, § 5 DDG does not
   attach" turns an absence into a statement, and tells a reader who wants to complain what
   kind of thing they are looking at.

2. **Contact is a link, not an address.** Reachability matters even where an Impressum does
   not; the operator already has a public contact card and it is the right target:

   <https://www.falkenstein-harz.de/m/verzeichnis/visitenkarte.php?mandat=21964>

   - **Linked, never mirrored.** None of that page's content — no name, no address, no
     phone number — is copied into this repository or rendered by this app. It is a
     third-party page with its own operator and its own obligations, and reproducing it
     here would create a second, stale copy of someone's personal data.
   - **`rel="nofollow"`**, so the link passes no endorsement or ranking weight to a
     municipal directory that did not ask to be associated with a ratings prototype. Also
     `noopener noreferrer`, and it opens in a new tab.
   - The practical consequence: **if the contact card moves or disappears, this site has no
     contact route.** That is the cost of not holding the details here, and it is accepted.

3. **Heading reads "Legal notice · Impressum".** This closes the question decision 13 of
   [navigation-overhaul/spec.md](../navigation-overhaul/spec.md) left open. The UI is
   English, so "Legal notice" stays the label everywhere — the footer link, the nav
   vocabulary. But "Impressum" is the single word a German reader scans for, and the one a
   reader who believes something is missing will search the page for. Printing both in the
   page heading costs one word and removes the ambiguity; it does not make "Impressum" the
   site's vocabulary.

4. **A liability note, kept to what is actually true here.** The usual German
   *Haftung für Inhalte / Haftung für Links* boilerplate is written for an Impressum this
   page does not have. What is worth saying is narrower and specific to this app: ratings
   are opinions submitted by anonymous visitors about named real people, aggregates are a
   configurable product choice and not a measurement, and there is a contact route for
   anyone who wants an entry removed. That is the part a subject of a rating needs.

## Still open — not solved by this ticket

**A privacy statement is a separate duty and is not covered by the private-site
exemption.** DDG § 5 scopes on commercial purpose; the GDPR does not. Art. 2(2)(c)'s
household exemption does not reach a website published to the open internet, so Art. 13
information duties attach to this prototype as it stands today:

- `players.real_name` holds the legal names of real people who never consented.
- Ratings are personal data about those people, retained indefinitely.
- A voter id is a browser-local token, but Cloudflare sees and logs request IP addresses as
  a processor on the operator's behalf.
- Discord snowflakes land in the database the moment
  [accounts/01](../accounts/01-discord-oauth-sign-in.md) ships.

None of that is addressed here, and the legal notice deliberately does not gesture at it —
a half-written privacy notice is worse than a missing one. It needs its own ticket, and
probably the lawyer's eye ticket 01 asked for.

**Done, in [03-privacy-statement.md](03-privacy-statement.md)**, as a separate page and a
separate footer link. It also turned up a third party nobody had written down: the page
loads its typefaces from Google's font servers, so a visitor's browser contacts Google
before they have clicked anything. Disclosed there; self-hosting the fonts is still open.

## Done when

- `?page=legal` renders the notice, and the footer link stops being `planned`.
- The contact card is reachable in one click, `nofollow`, with nothing from it reproduced.
- Tests cover the footer link becoming real and the `rel` on the outbound link.

**Resolved 2026-10-11.** The page is built, the footer link is real, and tests cover the
`nofollow` on the outbound link and the absence of any mirrored detail.
