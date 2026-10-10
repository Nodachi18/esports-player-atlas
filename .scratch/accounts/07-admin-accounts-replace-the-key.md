# Replace ADMIN_KEY with an admin role

Status: needs-triage
Source: navigation-overhaul spec §11, decisions 3 and 19
Blocked by: 01

## Problem

Admin is a shared secret, not an identity. Consequences, all of them live today:

- Every admin action is unattributable. The audit trail says "someone with the key".
- The key cannot be revoked for one person without rotating it for everyone.
- Admin is orthogonal to accounts, which is why an admin-key holder shows as otherwise
  anonymous — Account hidden, Rate prompting for sign-in. That oddity is specified
  behaviour, not a bug, but it exists only because admin is not a Role.
- The sign-in field sits in the footer on every page (spec §11), explicitly as an interim
  with a sunset.

## What to build

An `admin` Role on an Account, checked the way community and professional are. Then:

1. Remove the footer key field and `POST /api/admin/login`.
2. Remove `ADMIN_KEY` from `wrangler.jsonc` secrets, `.dev.vars.example`, `docker-compose.yml`
   and `README.md`.
3. Admin becomes a plain Role check in `nav.js`, which drops the `adminKey` special case.

Leaving the footer field in place after this would be a second credential path to secure —
exactly what keeping one way in was meant to avoid.

## Questions for triage

- Who grants the first admin role, with no admin account to grant it? A one-off migration,
  or a bootstrap env var used once?
- Is admin per-account, or a flag an account can hold alongside professional?

## Done when

`ADMIN_KEY` appears nowhere, and admin actions are attributable to an Account.
