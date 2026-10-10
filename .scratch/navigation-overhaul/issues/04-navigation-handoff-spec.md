# Write the navigation handoff spec

Type: task
Status: resolved
Map: ../map.md

## Question

Assemble the destination artifact: the spec a build session implements from.

Contents:

- The nav item set and the footer, and what each item points at **today** versus once built.
- The role × session visibility matrix — every item against anonymous, community,
  professional and admin-with-key, resolving to visible, hidden, disabled-planned or
  sign-in-prompt.
- The page inventory from the original list (Profil, Leaderboard, Voting, Anmeldung, Hilfe,
  Impressum) with the build status of each.
- The account page contents: login details now, own Ratings and editing them marked planned.
- What search in the header searches, and what it does with a result.
- A note on staying routable later, so decision 5's deferred SPA routing is cheap to add.

Terminal ticket: when this is written and agreed, the map is done and the work hands off.

## Inventory (agreed 2026-10-10)

The original German draft, cleaned up and aligned to the glossary. This is input to the
spec, not the spec itself.

### Roles

| Role | Can do |
|---|---|
| Community | Rate players. No public profile. |
| Professional | Everything community can, plus owns one Player profile and edits it. |
| Admin | Create Players, promote an Account to professional, ban Accounts, moderate Ratings. |

Corrections to the draft: "profil verwalten" and "können ihr profil managen" were the same
line twice and are merged. "Admin can do everything a professional can" does **not** hold —
Admin is a shared key, not an Account, and a Rating needs an identity to attach to, so an
Admin cannot rate as anyone. Admin inherits moderation powers, not rating powers.

### Pages

Global chrome on every page: Search (players), and Sign in / Sign out.

| Page | Holds |
|---|---|
| Players | The Player profile — name, photo, style, form, notes, and the ratings radar |
| Leaderboard | Combined, community and professional rankings |
| Rate | Submit a Rating |
| Account | Sign-in details; your own Ratings (planned); edit my Player profile, for professionals |
| Help | FAQ |
| Legal notice | Impressum |
| Admin | Create Players, promote, moderate |

Renames and removals are recorded as map decisions 14 and 15.

## Answer

Written: [spec.md](../spec.md).

Twelve sections: the shell, nav items, the visibility matrix, header search, page inventory,
the Players page, the two-tint colour rule, auth controls and the Account page, what comes
out of the current page, how to stay routable, the quality floor, and the six items
deliberately handed on undecided.

The map is complete. Nothing is left to decide before someone builds it.
