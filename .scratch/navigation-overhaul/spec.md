# Navigation and header — build spec

Handoff artifact of the [Navigation Overhaul](map.md) map. Everything here is decided;
nothing in it needs re-litigating before implementation. Items that are deliberately *not*
decided are listed in the last section.

Vocabulary is `CONTEXT.md` at the repo root. Account, Player, Rating, Panel and Role mean
what it says there.

**Scope.** The shell: static header, main navigation, content area, footer, and the Players,
Leaderboard and Rate pages that prove the shell works. Not in scope: building
authentication, SPA routing, admin accounts, or ban and moderation mechanics.

---

## 1. The shell

Three parts, in this order:

1. **Static header** — one dense command bar, 62px minimum height, full width, on every page.
2. **Content area** — the only thing the primary navigation swaps.
3. **Footer** — secondary links, legal links, and the interim admin key field (§11).

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
| Leaderboard | Rankings, with its own metric and category controls (§7) |
| Rate | Rating form for the Player currently in context (§8) |
| Account | Your own account (§10) |
| Admin | Create Players, promote, moderate |

Search is **not** a navigation item; it lives in the header itself. History moves into the
Player detail rather than being top-level. Compare is planned (§7).

The footer carries **Help**, **Legal notice** and the **admin key field**. Help and Legal
notice are planned, so both render per §3.

### Player context is shared across pages

Players, Leaderboard and Rate all operate on **one selected Player**, and that selection
survives navigation between them. Switching player on Players and then opening Rate rates
*that* Player — the UI changes, the context does not. This is one piece of state, not three
(§13).

---

## 3. Visibility matrix

Four states. Admin is a shared key and not an Account, so it is orthogonal to the other
three: an admin-key holder is otherwise anonymous.

| Item | Anonymous | Community | Professional | Admin key accepted |
|---|---|---|---|---|
| Players | visible | visible | visible | visible |
| Leaderboard | visible | visible | visible | visible |
| Rate | **sign-in prompt** | visible | visible | sign-in prompt |
| Account | hidden | visible | visible | hidden |
| Admin | hidden | hidden | hidden | **visible** |
| Help (footer) | planned | planned | planned | planned |
| Legal notice (footer) | planned | planned | planned | planned |
| Admin key field (footer) | visible | visible | visible | replaced by "signed in as admin" |

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
| Leaderboard | **Build now**, at parity with the existing API (§7). |
| Rate | **Build now**, at parity with the existing API (§8). |
| Account | Planned. Needs accounts first. |
| Help | Planned. Content undecided. |
| Legal notice | Planned. Content is a legal question, not a design one. |
| Admin | Exists behind `ADMIN_KEY`; re-host unchanged, entered from the footer (§11). |
| Compare | Planned. The endpoint exists, a UI never has (§7). |

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
3. **Ratings panel** — heading, the Rating count, the lens (§9), and the radar. Each vertex
   of the radar carries its category label and that category's score. A Panel with no
   Ratings shows an em dash at every vertex, draws no polygon, and says so in words.

Data comes from `GET /api/leaderboard`, which returns **whole profiles**, not just names and
scores. One call fills both the strip and the detail: selecting a Player must not trigger a
second request.

---

## 7. The Leaderboard page

Parity with `GET /api/leaderboard?metric=&category=`, which is what v3 already exposes.

**Controls**, two selects:

| Control | Values | Behaviour on a bad value |
|---|---|---|
| Metric | Combined, Community, Professionals | falls back to Combined |
| Category | Overall, strategy, tactics, micro, macro, decisions | falls back to Overall |

**Overall** is not a stored number: it is the mean of that metric's five category scores,
computed per Player. Picking a single category ranks by that category alone.

**Rows** carry rank, Player name, game, and the value, rounded. The response is already
sorted descending, so the UI must not re-sort.

**Selecting a row sets the Player context** (§2) and opens Players on that Player. The
Leaderboard is a way in, not a dead end.

**Its metric control is separate from the Players lens** (§9) and must stay that way. The
lens filters one Player's radar; this re-ranks everyone. They happen to offer the same three
Panels, which is exactly why conflating them would be easy and wrong.

**Compare is planned.** `GET /api/compare?players=a,b,c,d` works today and accepts up to
four slugs, but no UI has ever called it — `#compareBox` is never written to and the `sel`
Set in [public/index.html](../../public/index.html) is declared and never read. Render a
planned entry rather than quietly dropping it; building a four-way comparison view is a
feature of its own size.

**Unrated Players do not appear here**, by the API's design — see §15.

---

## 8. The Rate page

Parity with `POST /api/ratings`.

**Target.** Rate always acts on the Player in context (§2), named in the page heading so
there is no doubt who is being rated. Reaching Rate with no Player in context sends the
viewer to Players first — there is nothing to rate otherwise.

**Form:**

| Field | Shape |
|---|---|
| Panel | Community or Professional. Professional requires a professional token. |
| strategy, tactics, micro, macro, decisions | Five sliders, integers 0–100 |

**Request:** `{ player, panel, strategy, tactics, micro, macro, decisions }` plus identity —
`voter` for community, `token` for professional. Bodies are capped at 16 KB.

**Responses, all of which need a visible state:**

| Status | Means | Show |
|---|---|---|
| 201 | Accepted; the updated profile comes back | Confirm, and re-render the radar from the response (§8.1) |
| 409 | Already rated this Player on this Panel | Say so plainly; this is the expected second attempt, not an error state |
| 401 | Professional panel without a valid token | Explain that professional rating needs professional access |
| 404 | Unknown or inactive Player | Send back to Players |
| 400 | Scores outside 0–100, or not integers | Name the offending field |

**Identity today** is a `localStorage` voter id for community and the pro token for
professional. Once accounts land, the Account supplies identity and this page gates behind
sign-in per §3. The form itself does not change.

A Professional **may rate themselves**; this is deliberate. The consequence is recorded in
the map's decision 6.

### 8.1 What a 201 can and cannot refresh

The response carries the rated Player's **new aggregates**, so the radar and the Rating
count redraw from it immediately, with no second request.

It does **not** carry their new `value` or their new **rank**, and it cannot: rank is
relative to every other Player, which a single-Player response knows nothing about. A
submission must therefore refresh the ranked list from `GET /api/leaderboard` as well, or
the ranked strip keeps the Player's old score and old position while the detail beside it
shows the new numbers.

Do both, in this order: redraw the detail from the response so the submission feels
immediate, then refresh the ranking in the background. A build that does only the first is
subtly wrong in a way that is easy to miss, because the page a rater is looking at *does*
update — only the strip above it lies.

Related: **rank is a property of the Player, not a position in a list.** Carry it on the
record when the ranking is loaded. Deriving it from the row's index breaks as soon as the
list is filtered by search, where index 1 is whoever matched first rather than the
top-ranked Player.

---

## 9. Colour: two tints, two meanings

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
filters. It is not global chrome.

---

## 10. Auth control and the Account page

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

## 11. Admin access

**Interim mechanic, with an explicit sunset.** Until Discord auth ships, the footer carries a
globally visible admin key field. It is the door; the Admin page is the room.

1. The viewer enters the key in the footer field and submits.
2. `POST /api/admin/login` exchanges it for a token valid 8 hours, kept in
   `sessionStorage`. The key field is cleared immediately and never stored.
3. On success the **Admin nav item appears** (§3) and the content area opens Admin. The
   footer field is replaced by a signed-in indicator with a way to drop the token.
4. Admin requests send `Authorization: Bearer <token>`.

**Admin stays orthogonal to Accounts.** An admin-key holder is otherwise anonymous: Account
stays hidden, Rate still prompts for sign-in. Admin is not a Role in the `CONTEXT.md` sense
until admin accounts exist.

**Sunset:** when Accounts and an admin Role exist, this field is removed and Admin becomes a
Role check like any other. Leaving it in place after that point would be a second
credential path to secure, which decision 2 of the professional ticket explicitly avoids.

**Known gap, not introduced by this spec:** `/api/admin/login` has no rate limiting, and the
footer field advertises its existence on every page. The key is what protects admin — it
must be at least 16 characters and is compared in constant time — but rate limiting is
already on the README's pre-production list and this makes it easier to reach.

---

## 12. What comes out of the current page

- The **Professional access** sidebar block, `#procode` and its Unlock button. Promotion is
  an admin act now; the Pro invite is retired.
- The **v3 tab strip** (`#profile`, `#compare`, `#history`, `#admin`) and the JS that toggles
  section visibility. The content area replaces it.
- The separate score list beside the radar; scores move onto the vertices.
- `#view` as a standalone select; it becomes the lens.
- The **admin key field from the Admin section**; it moves to the footer (§11).
- The dead `#compareBox` markup and the unused `sel` Set, replaced by a planned entry.

Dead backend surface once this lands, to remove rather than preserve: `POST /api/pro/verify`,
`POST /api/admin/pro-invites`, and the `pro_invites` table.

---

## 13. Staying routable

Client-side routing is deliberately deferred, so the navigation swaps sections today. Build
it so routing is cheap to add later:

- Keep one function mapping a route key to a rendered content area. Today it is called by a
  click handler; later by a router.
- Nav items should be real anchors whose `href` **resolves today**, with the click handler
  calling `preventDefault`. That means the query-string form while routing is deferred: an
  anchor pointing at `/leaderboard` 404s on middle-click, ctrl-click or "copy link
  address", because that path does not exist yet. The eventual paths are `/players`,
  `/players/<slug>`, `/leaderboard`, `/rate`, `/account`, `/admin`, `/help`, `/legal`.
- A planned item gets **no `href` at all**, so it cannot be focused or opened in a new tab —
  which is how "not built yet" should behave.
- Selection state belongs in **one object**: current page, selected Player, search query,
  lens, leaderboard metric and category. Player context (§2) is a field in it, which is what
  makes the context survive navigation. A URL can later be parsed into and serialised from
  that object with no restructuring.

When routing does land it needs `not_found_handling: "single-page-application"` on the assets
block in `wrangler.jsonc`, because `public/` is served by Workers Assets without invoking the
Worker.

---

## 14. Quality floor

- Responsive to 390px. The header wraps rather than overflowing; the ranked strip scrolls.
- Visible keyboard focus, in the role tint.
- `prefers-reduced-motion` respected.
- Planned items are removed from the tab order, not merely dimmed.
- The page body never scrolls horizontally.
- The admin key field is `type="password"` and outside any form that could autofill it.

---

## 15. Deliberately not decided

Handed on rather than answered. None of these block the build.

- **A profile image and a Form field.** Both appear in the layout and neither exists in
  `players`. They render as `planned` until a migration and admin editing UI exist.
- **Where unrated Players appear.** `GET /api/leaderboard` filters out every Player with no
  Ratings, so a newly created Player is invisible in both the ranked strip and the
  Leaderboard. The prototype appends them unranked as a stopgap.
- **The header's one row is full.** At 1280px in the admin-key state, brand, search, four
  nav items and the sign-in button overflow. Pick one: shorten the sign-in label, fold the
  admin indicator into the Admin item, or accept a second row in that state alone.
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
- **Whether Compare is ever built**, and what a four-way radar comparison looks like.

---

## Prototype

`prototype/header-variants.html`, beside this spec. Throwaway, kept as the primary source
behind the decisions above — variant A is what shipped, B and C are the rejected
alternatives and the record of why A won.

It lived in `public/` while it was being judged, so it could read the live API against real
data and real density. It was moved out once the real frontend landed: anything under
`public/` is served by Workers Assets and would have deployed.

To run it again, copy it back into `public/` temporarily — it needs `/api` on the same
origin. `?variant=A|B|C`, `?state=anon|community|professional|adminkey`, `?lens=`, `?page=`,
`?player=`, `?q=`.

## Built

The spec is implemented in `public/index.html` and `public/app/`. See the Frontend section
of `README.md` for the module map. `ACCOUNTS_ENABLED` in `public/app/main.js` is the single
switch that turns on §3's target-state visibility rules once accounts exist.
