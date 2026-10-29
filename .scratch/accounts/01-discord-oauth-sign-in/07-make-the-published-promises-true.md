# Make the published promises true, and turn accounts on

Status: ready-for-agent
Part of: [../01-discord-oauth-sign-in.md](../01-discord-oauth-sign-in.md)
Blocked by: 06

## Problem

Three pages are live right now saying things that this set makes false, or that it finally
makes true. This is not cleanup after the fact — it lands in the same PR as the flip, and it
gates the flip.

## The privacy page

Known going in: the `planned` Discord section says **"None of this happens yet."** It has to
become the present tense, unhedged, with its `data-planned` attribute and tag removed.

Found while planning, and more important than that section, because it is the sentence a
reader actually checks:

- **"No cookies, no analytics, no advertising, no tracking pixels"** —
  [views.js:670](../../../public/app/views.js#L670). Flatly false the moment `epa_session`
  ships. It needs an honest sentence naming the session cookie and what it is for. **No
  consent banner**: a strictly necessary session cookie is exempt under §25(2) TDDDG, and a
  banner on a site with no analytics would be theatre.
- **"The voter hash is a one-way hash of a random token your browser generated"** — it
  becomes a hash of a Discord account id, which is precisely the change the page's own
  `planned` section promises to disclose. "It cannot be turned back into you" stops being
  true in the way the reader will take it: the site holds the account id that produced it.
- **"Three values in your browser's own storage… the rating token"** — the rating token is
  gone.

## The help page

- "Signing in with Discord is planned, and that is what will open the panel up" is now
  false. Sign-in exists; what does not exist is promotion, so the professional panel is
  still shut. "At the moment, nobody can" become a professional stays true — a test pins it
  — and that is deliberate: [../04-promote-account-to-professional.md](../04-promote-account-to-professional.md)
  is what opens it.
- The page's jargon test forbids `tokens?`, `hashe?s?` and `localStorage`. Whatever is
  written has to stay in a reader's terms.

## The terms page

Rules 7-9 are already stated in the present tense and nothing on the page is marked planned.
Re-read all four claims the tripwire names, confirm each against the code as built, then
**delete that test** — it instructs you to. The four: the scope asks for no email address,
the site holds only the account id, username and avatar, one account per person is the rule,
and a blocked account cannot sign in and its ratings leave the site.

The last of those is **not true yet** and is not this set's to make true —
[../../moderation/03-ban-accounts-and-moderate-ratings.md](../../moderation/03-ban-accounts-and-moderate-ratings.md)
owns blocking, and rule 9 is specified as exclusion from the aggregates rather than
deletion, which is a constraint on how it gets built. If the honest reading is that the
terms page now overstates, say so here rather than deleting the sentence quietly.

**The email-scope guard test must survive.** It greps every line containing `scope` in
`src/` for the word `email`, and it is the one check standing between a one-word change and
a lie on a published page.

## Then

Flip `ACCOUNTS_ENABLED` to `true` in `public/app/main.js`. That is what turns on the
navigation matrix: Rate starts prompting, Account appears as `planned`.

## Done when

No page says something the code contradicts, the tripwire test is gone and the email-scope
guard remains, `npm test` is green, `ACCOUNTS_ENABLED` is `true` — and, after the merge
deploys, a visitor signs in with Discord **on the deployed origin**, is recognised on
return, rates a player, and signs out again, with an `accounts` row keyed on the snowflake
and a `ratings` row carrying its `account_id`.
