# How an account becomes a professional

Type: grilling
Status: resolved
Map: ../map.md

## Question

The page list named *Anmeldung*, which turned out to mean login and registration — so
nothing yet describes the path from a community Account to a professional one.

Today that path is a shared Pro invite code in the sidebar (`#procode` in
`public/index.html`), which carries no individual identity: every holder of one code counts
as a single rater.

Decide:

- Does the invite code survive the overhaul, get replaced by an application an Admin
  approves, or something else?
- Whoever takes that path ends up owning exactly one Player (decision 3) — is that Player
  created for them, claimed from the existing admin-created ones, or either?
- Does the path need a surface in the nav, the footer, or inside the account page?

This decides whether the overhauled layout keeps an invite-code control at all, which is
why it blocks the header prototype.

## Answer

**The Pro invite code is retired.** Becoming a professional is an admin act, not a shared
secret. For the layout that means `#procode`, the Unlock button and the whole "Professional
access" sidebar block come out of `public/index.html`.

Three paths, two of them live:

1. **Promotion** (live): an Admin takes an existing Account and links it to an existing
   Player, granting the professional Role.
2. **Admin creates a professional Player** (live): a Player record only — unlinked, marked
   professional. This is what `POST /api/admin/players` already does, plus the marker.
3. **Claim** (planned): an Account asks to be linked to an unlinked professional Player,
   and an Admin reviews the request.

**Accounts are created only by signing in with Discord.** Admin tooling never creates an
Account, so there is no second credential path to secure. "Create" and "promote" are the two
halves: make the Player, then link an Account to it once that person signs in.

**Surface** (the part that shapes the nav): the claim entry lives on the **public player
profile** of an unlinked professional — "Das bin ich" — rendered disabled and marked planned
per decision 2. It gets **no nav item**, so the main nav stays at the four items decision 9
settled. Promote and create live in the Admin section, which still sits behind the
`ADMIN_KEY` as decision 3 requires.
