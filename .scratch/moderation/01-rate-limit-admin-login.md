# Rate-limit the admin login endpoint

Status: ready-for-agent
Source: navigation-overhaul spec §11, README pre-production list

## Problem

`POST /api/admin/login` accepts unlimited attempts. Nothing throttles, delays or locks out.

The navigation overhaul did not create this gap, but it widened the exposure: the admin key
field now sits in the footer of every page, which advertises the endpoint to everyone rather
than hiding it behind a tab nobody clicked.

What already protects it: the key must be at least 16 characters, and it is compared in
constant time, so neither guessing nor timing is cheap. What does not protect it: anything
at all against a script trying continuously.

## What to build

Either is acceptable; pick one and say why.

- **Cloudflare WAF rate-limiting rule** on the path. No code, no state, counts against the
  free plan's rule allowance.
- **In-Worker throttle** keyed on client IP, backed by D1 or a KV namespace. More code, more
  reads per request, but it lives with the repository rather than in dashboard config.

Apply it to `/api/auth/*` too once sign-in exists.

## Done when

Repeated failed logins from one source are refused rather than merely rejected, and the
limit is documented wherever the key itself is documented.
