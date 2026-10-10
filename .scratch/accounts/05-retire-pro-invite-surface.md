# Retire the pro invite surface

Status: needs-triage
Source: navigation-overhaul spec §12
Blocked by: 04

## Problem

The frontend no longer reaches any of it — the invite UI went with the navigation overhaul —
but the backend still carries:

- `POST /api/pro/verify`
- `POST /api/admin/pro-invites`
- the `pro_invites` table

Dead surface invites accidental revival, and the mechanism it implements was explicitly
rejected: one shared code where every holder hashes to `'pro:' + invite.id`, so ten
professionals sharing a code cast one rating between them.

## Do not remove it yet

**Removing `/api/pro/verify` before promotion (04) exists leaves no path at all to a
professional rating.** The route is the only thing that issues a pro token. That is why this
is blocked rather than ready.

A pro token already in a browser's `localStorage` keeps working until it expires, so there
is no rush.

## What to do, in order

1. Promotion (04) ships and is the live path to professional access.
2. Delete both routes and the token kind they issue.
3. Migration dropping `pro_invites`.
4. Remove `PRO-DEMO-2026` and its hash from `seed/demo.sql`, and the invite-code lines from
   `README.md`.

## Done when

Nothing in `src/`, `seed/` or `README.md` mentions pro invites, and professional access
comes only from promotion.
