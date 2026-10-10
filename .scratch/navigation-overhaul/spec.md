# Navigation and header — build spec

Handoff artifact of the [Navigation Overhaul](map.md) map. Everything here is decided;
nothing in it needs re-litigating before implementation. Items that are deliberately *not*
decided are listed in the last section.

Vocabulary is `CONTEXT.md` at the repo root. Account, Player, Rating, Panel and Role mean
what it says there.

**Scope.** The shell: static header, main navigation, content area, footer, and the Players
page that proves the shell works. Not in scope: building authentication, SPA routing, admin
accounts, or ban and moderation mechanics.

---

## 1. The shell

Three parts, in this order:

1. **Static header** — one dense command bar, 62px minimum height, full width, on every page.
2. **Content area** — the only thing the primary navigation swaps.
3. **Footer** — secondary and legal links.

Header contents, left to right: brand lockup (pentagon mark + wordmark), search field,
navigation items, auth control. The brand mark is the radar pentagon; it is the only place
the shape is used outside the radar itself.

**The header does not scroll away** and does not change between pages. Only its *states*
change, per §3.

---

## 2. Navigation items

| Item | Content area shows |
|---|---|
| Players | Ranked strip plus one Player in detail (§6) |
| Leaderboard | Rankings table, with its own metric control |
| Rate | Submit a Rating |
| Account | Your own account (§8) |
| Admin | Create Players, promote, moderate |

Search is **not** a navigation item; it lives in the header itself. Compare stays folded
into Leaderboard as it is today. History moves into the Player detail rather than being
top-level.

The footer carries **Help** and **Legal notice**. Both are planned, so both render per §4.

---

## 3. Visibility matrix

Four states. Admin is a shared key and not an Account, so it is orthogonal to the other
three: an admin-key holder is otherwise anonymous.

| Item | Anonymous | Community | Professional | Admin key |
|---|---|---|---|---|
| Players | visible | visible | visible | visible |
| Leaderboard | visible | visible | visible | visible |
| Rate | **sign-in prompt** | visible | visible | sign-in prompt |
| Account | hidden | visible | visible | hidden |
| Admin | hidden | hidden | hidden | **visible** |
| Help (footer) | planned | planned | planned | planned |
| Legal notice (footer) | planned | planned | planned | planned |

Three rendering rules, and they must not be confused with each other:

- **hidden** — the item is absent from the DOM. It means *your role cannot do this*.
- **planned** — rendered, visibly inert: 38% opacity, `aria-disabled`, removed from tab
  order, and tagged `planned`. It means *this is not built yet*. Nothing else may use this
  treatment.
- **sign-in prompt** — rendered and fully active; activating it asks the viewer to sign in.
  It means *you are not signed in yet*, which is not the same as being forbidden. This
  applies to Rate alone, because Rate is the reason to create an account.

---

## 4. Header search

Searches Players by name, real name, game and faction.

The result **feeds the Players page** — Players is one view over the ranked list and the
search result, not two separate screens. With the field empty the strip is the leaderboard
ranking; with a query it is the matching set, and the detail below follows the top hit.
A query that matches nothing says so in place of the strip; it does not empty the page.

Search never navigates away from Players, and never opens a separate results screen.

---

## 5. Page inventory

| Page | Build status |
|---|---|
| Players | **Build now.** The reference implementation of the shell. |
| Leaderboard | Exists; re-host inside the new content area unchanged. |
| Rate | Exists as the voting panel; re-host, and gate behind sign-in once accounts land. |
| Account | Planned. Needs accounts first. |
| Help | Planned. Content undecided. |
| Legal notice | Planned. Content is a legal question, not a design one. |
| Admin | Exists behind `ADMIN_KEY`; re-host unchanged. |

There is **no sign-in page**. Signing in is a redirect to Discord and back, so it has
nothing to render.

---

## 6. The Players page

Two regions, stacked.

**Ranked strip**, above. Each entry carries rank, Player name, game and faction, and the
score. Five per page, paged with previous/next controls that state the position
(`1–5 of 40`). Selecting an entry replaces the detail below; it does not navigate.

**Player detail**, below, in three columns:

1. **Portrait** — 3:4, with a caption bar carrying the faction and nothing else.
2. **Identity and facts** — Player name large, real name and game beneath it, then three
   labelled sections: Style, Form, Notes.
3. **Ratings panel** — heading, the Rating count, the lens (§7), and the radar. Each vertex
   of the radar carries its category label and that category's score. A Panel with no
   Ratings shows an em dash at every vertex, draws no polygon, and says so in words.

Data comes from `GET /api/leaderboard`, which returns **whole profiles**, not just names and
scores. One call fills both the strip and the detail: selecting a Player must not trigger a
second request.

---

## 7. Colour: two tints, two meanings

Keeping these apart is the single most important visual rule here. Collapsing them makes an
Admin see amber scores, which reads as a fourth Panel that does not exist.

| Tint | Means | Applies to |
|---|---|---|
| **Role** | who you are | Header, nav, brand mark, identity control, focus rings |
| **Lens** | which Panel you are reading | Radar polygon, vertex scores, strip scores |

Tokens: community `#75c8fa`, professional `#bd8dff`, admin `#ffb259`, combined `#dfeefb`.

**Combined needs its own colour.** The current app paints Combined and Community in the same
`#75c8fa`, so the two readings cannot be told apart. Combined becomes neutral.

The **lens belongs to the pentagon**, inside the ratings panel, spanning the radar it
filters. It is not global chrome. The Leaderboard keeps its own separate metric control.

---

## 8. Auth control and the Account page

**Sign in** must be a full-page navigation (an anchor or `location.assign`), not a `fetch` —
the OAuth authorize step is a top-level browser redirect and XHR cannot perform it. It must
be visibly labelled as Discord: an unlabelled "Login" that jumps to `discord.com` reads as a
phishing attempt.

**There is no separate Register control.** First sign-in is registration; a second button
would point at a byte-identical URL.

**Sign out** is `POST /api/auth/logout`, which replies with an expired cookie. JavaScript
cannot clear an `HttpOnly` cookie, so this cannot be done client-side — but it writes no
database row and calls Discord not at all.

**Account page** holds sign-in details now. Your own Ratings, and editing them, are planned.
For a Professional it also carries "edit my player profile", because a Professional owns
exactly one Player.

Until accounts exist, the auth control renders as `planned` per §3.

---

## 9. What comes out of the current page

- The **Professional access** sidebar block, `#procode` and its Unlock button. Promotion is
  an admin act now; the Pro invite is retired.
- The **v3 tab strip** (`#profile`, `#compare`, `#history`, `#admin`) and the JS that toggles
  section visibility. The content area replaces it.
- The separate score list beside the radar; scores move onto the vertices.
- `#view` as a standalone select; it becomes the lens.

Dead backend surface once this lands, to remove rather than preserve: `POST /api/pro/verify`,
`POST /api/admin/pro-invites`, and the `pro_invites` table.

---

## 10. Staying routable

Client-side routing is deliberately deferred, so the navigation swaps sections today. Build
it so routing is cheap to add later:

- Keep one function mapping a route key to a rendered content area. Today it is called by a
  click handler; later by a router.
- Nav items should be real anchors with `href` set to their eventual path, with the click
  handler calling `preventDefault`. The paths are `/players`, `/players/<slug>`,
  `/leaderboard`, `/rate`, `/account`, `/admin`, `/help`, `/legal`.
- Selection state (current page, current Player, search query, lens) belongs in one object
  that a URL can later be parsed into and serialised from.

When routing does land it needs `not_found_handling: "single-page-application"` on the assets
block in `wrangler.jsonc`, because `public/` is served by Workers Assets without invoking the
Worker.

---

## 11. Quality floor

- Responsive to 390px. The header wraps rather than overflowing; the ranked strip scrolls.
- Visible keyboard focus, in the role tint.
- `prefers-reduced-motion` respected.
- Planned items are removed from the tab order, not merely dimmed.
- The page body never scrolls horizontally.

---

## 12. Deliberately not decided here

Handed on rather than answered. None of these block the build.

- **A profile image and a Form field.** Both appear in the layout and neither exists in
  `players`. They render as `planned` until a migration and admin editing UI exist.
- **Where unrated Players appear in the ranked strip.** `GET /api/leaderboard` filters out
  every Player with no Ratings, so a newly created Player is invisible in a purely
  rank-ordered strip. The prototype appends them unranked as a stopgap.
- **The header's one row is full.** At 1280px in the admin-key state, brand, search, four
  nav items, the key pill and the sign-in button overflow. Pick one: shorten the sign-in
  label, fold the key pill into the Admin item, or accept a second row in that state alone.
- **A `kind` discriminator on signed tokens.** `verifyToken` returns whatever JSON was
  signed, with no type field; only ad-hoc `role` checks keep admin and pro tokens apart.
  Harmless today, a real confusion risk once a signed OAuth `state` is handed to the
  browser. Adding it invalidates live 30-day pro tokens.
- **Session revocation.** A stateless HMAC session cannot be revoked before it expires, so a
  ban does not bite until the cookie lapses. Costs one D1 read per authenticated request to
  fix.
- **"Legal notice" as the Impressum label.** The UI is English throughout, but a site
  operated from Germany must make provider information easily recognisable, and German
  readers look for "Impressum".

---

## Prototype

`public/prototype-header.html` — throwaway, reading the live API.
`?variant=A|B|C`, `?state=anon|community|professional|adminkey`, `?lens=`, `?page=`,
`?player=`, `?q=`. **Delete it before deploying.** Variant A is the one specified above;
B and C are the rejected alternatives, kept only until this spec is accepted.
