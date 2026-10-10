# Promote an account to professional

Status: needs-triage
Source: navigation-overhaul issue 02, CONTEXT.md (Promotion, Unlinked Player, Claim)
Blocked by: 01

## Problem

The decided model has no implementation. A Professional is an Account that owns exactly one
Player and rates on the professional panel. Nothing creates that link.

Three paths were agreed, two of them live:

1. **Promotion** — an Admin links an existing Account to an existing Player and grants the
   professional role.
2. **Admin creates a professional Player** — a Player row only, unlinked, marked
   professional. This is `POST /api/admin/players` plus a marker.
3. **Claim** — an Account asks to be linked to an Unlinked Player, an Admin reviews.
   Planned, entered from that Player's public profile, no nav item.

Accounts are created only by signing in with Discord. Admin tooling never creates an
Account, so there is no second credential path to secure.

## Why it matters beyond itself

It unblocks retiring the pro invite (05). Until promotion exists, deleting `/api/pro/verify`
would leave **no path at all** to a professional rating.

## Open questions for triage

- Does promotion link to an existing Player only, or may it create one inline?
- What happens to a Professional's ratings if they are later demoted?
- Does a Player row need an `account_id`, or a separate link table allowing history?

## Done when

An Admin can promote a signed-in Account against a Player, that Account then rates on the
professional panel, and its own ratings are attributable to it rather than to a shared code.
