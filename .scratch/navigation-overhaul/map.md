# Navigation Overhaul

## Destination

A handoff-ready spec for the main navigation and static header: the item set, the role and
session states each item renders in, and the page inventory behind it — complete enough
that a build session implements it without reopening any of these questions.

**No navigation code is written in this map.** The spec is the deliverable.

## Notes

Single-page frontend at `public/index.html`, served by Workers Assets without invoking the
Worker; API at `/api/*` in `src/worker.js` over D1. Glossary: `CONTEXT.md` at the repo root.

Every decision ticket calls the `grilling` and `domain-modeling` skills. The header
prototype also calls `frontend-design`. Research tickets call `research`.

### Standing decisions from charting (2026-10-10)

1. The destination is a spec to hand off. Plan, don't build.
2. Planned-but-unbuilt nav items appear **disabled and marked planned**. Nothing is stubbed
   to look like it works.
3. **A Professional is a Player.** A professional Account owns exactly one Player and edits
   only that one. The `ADMIN_KEY` keeps edit and access over all Players for now.
4. Anmeldung/Login means session-based authentication. Accounts must be free to create and
   unique enough that ratings can be attributed and moderated.
5. SPA routing with real URLs is wanted eventually but deferred. The nav works as section
   toggling today and must stay routable later.
6. **Professionals may rate themselves.** Caveat recorded and accepted: a self-rating is
   unguarded — one row in a Panel whose medians often rest on a handful of Ratings, and the
   outlier flagger in `src/stats.js` will not catch it at small n.
7. Rating requires an Account in the target model, so Ratings become attributable,
   blockable and moderatable. Existing anonymous Ratings are kept as historical data.
   Building this is out of scope; this map plans its UI only.
8. Identity comes from social OAuth, provider **Discord**. The bar is "not trivially
   resettable", not "one human, one Account".
9. Nav item set: **Players · Leaderboard · Rate · Account**. Search lives in the static
   header itself, not as a nav item. Compare stays folded into Leaderboard. History demotes
   into the Player profile. Help/FAQ and Legal notice go in a footer.
10. Role-forbidden items are **hidden**. Disabled means planned, and only that.
11. **Account always means your own account page.** A Professional's public Player page is
    reached through Players/Search like any other Player; editing it lives inside the
    account page. The account page shows sign-in details now; your own Ratings, and editing
    them, are planned.
12. Rate is the one narrow exception to 10: visible when signed out, prompting sign-in.
13. **The UI is English throughout**, including the pages the original list named in German:
    Hilfe is **Help**, Impressum is **Legal notice**. Worth a check before launch — a site
    operated from Germany must make the provider information easily recognisable, and
    "Impressum" is the label German readers look for.
14. Two nav items renamed out of the original draft, 2026-10-10:
    - **Profile → Account.** The draft used "Profil" for the *player* page (name, image,
      score, description) while decision 11 used it for your own account — one word, two
      things. "Profile" now always means the Player's page; the nav item is Account.
    - **Voting → Rate.** `CONTEXT.md` makes Rating canonical and lists Vote under
      `_Avoid_`. The verb names the action, the noun names the data: you *Rate*, and the
      panel on a Player shows *Ratings*.
15. There is **no Anmeldung page.** Sign-in is a redirect to Discord and back, so it has
    nothing to render. The draft listed it twice; both entries collapse into the header's
    sign-in control.
16. **Players is one view over the leaderboard and the search result.** It opens on the
    top-ranked player in detail, with a paginated strip of the next-best above. The header
    search turns that strip into the search result. Consequence to resolve in the spec: the
    leaderboard route drops players with no Ratings, so an unrated Player is invisible in a
    purely rank-ordered strip.
17. **Player context is shared across Players, Leaderboard and Rate.** Switching Player on
    one and navigating to another keeps that Player: the UI changes, the context does not.
    One piece of state, not three.
18. **Leaderboard and Rate are built at parity with the existing API**, not reinvented.
    Leaderboard keeps metric × category; Rate keeps the five 0–100 sliders and both Panels.
    **Compare stays planned** — `/api/compare` works but no UI has ever called it, so
    "parity" there would mean building a feature, not re-hosting one.
19. **Admin is entered from a globally visible key field in the footer**, as an interim
    until Discord auth ships. On success the Admin nav item appears. The field is removed
    once Accounts and an admin Role exist — keeping it would be a second credential path.

## Decisions so far

<!-- one line per resolved ticket: gist + link -->

- [Discord OAuth and free session auth on Workers](issues/01-discord-oauth-session-auth.md):
  authorization-code grant, two `/api/auth/*` routes, session as an `HttpOnly` cookie
  carrying the token `signToken()` already produces. Free, and `wrangler.jsonc` needs no
  change. **Login is a full-page redirect labelled as Discord, and there is no separate
  Register control** — first sign-in is registration.
- [How an account becomes a professional](issues/02-becoming-a-professional.md): **the Pro
  invite code is retired.** An Admin promotes an Account by linking it to a Player, and
  creates unlinked professional Players; claiming an unlinked one is planned, entered from
  that Player's public profile and given no nav item. Accounts exist only via Discord.
- [Verify Discord redirect URIs in the developer portal](issues/05-discord-portal-redirects.md):
  plain `http://localhost` is accepted and multiple redirect URIs are permitted, so local
  dev uses the real sign-in flow and needs no stub. URIs match exactly; the registered
  deployed URI is missing its account subdomain and needs correcting after a first deploy.
- [Static header and main nav layout](issues/03-header-and-nav-layout.md): **variant A**, a
  single command bar. The lens belongs to the pentagon, not the chrome. The content area
  swaps with the nav, and **Players is one view over the ranked list and the search
  result** — top-ranked player in detail, paginated strip of the rest above it.
- [Write the navigation handoff spec](issues/04-navigation-handoff-spec.md): written to
  [spec.md](spec.md). **The map is complete** — nothing left to decide before building.

## Not yet specified

- What Hilfe/FAQ contains, and what the Impressum legally requires (operator details under
  German law).
- The account page beyond login details: how a user's own Ratings are listed, and what
  editing a past Rating does to the cached aggregates and to flagging.
- Moderation surfaces: blocking a malicious Rating, banning an Account. The roles list
  implies both; nothing has shaped them yet. Note from the OAuth research: a stateless HMAC
  session **cannot be revoked before it expires**, so a ban does not take effect until the
  cookie lapses. Real revocation costs one D1 read per authenticated request
  (a `token_version` on the Account row). Whichever ticket first shapes banning owns this.
- How existing anonymous community Ratings are displayed and attributed once Accounts land.
- What happens to professional Ratings already cast under a shared Pro invite, now that
  invites are retired. They currently collapse to one rater per invite code, so they cannot
  be attributed to any Account retroactively.
- Visual design language for the header — typography, density, how the brand block and
  search share the bar. A `frontend-design` pass once the layout is agreed.
- Responsive behaviour of the nav below the existing 900px and 600px breakpoints.
- **Player profile image and a Form field.** The players-page layout wants both; `players`
  holds neither. Needs a migration, a place to put the image, and admin editing UI — past
  this map's destination, but the layout has a hole until it exists.

## Out of scope

- **Building the authentication and Accounts system.** Decision 7 — this map plans the UI
  that assumes it, nothing more.
- **SPA client-side routing with real URLs.** Decision 5 — wanted later, a separate effort.
- **Replacing `ADMIN_KEY` with admin Accounts.** Decision 3 — the key stays for now.
- **Implementing bans and Rating moderation.** The UI that anticipates them is in scope;
  the mechanism is not.
- **Adding a `kind` discriminator to signed tokens.** Surfaced by
  [Discord OAuth and free session auth on Workers](issues/01-discord-oauth-session-auth.md):
  `verifyToken` in `src/worker.js` returns whatever JSON was signed, with no type field —
  only ad-hoc `role` checks at each call site keep admin, pro and (soon) OAuth `state` blobs
  apart. Harmless today, a real confusion risk the moment a signed `state` is handed to the
  browser. It belongs to the auth build, not to a navigation spec, and adding it is a
  flag-day change that invalidates live 30-day pro tokens.
