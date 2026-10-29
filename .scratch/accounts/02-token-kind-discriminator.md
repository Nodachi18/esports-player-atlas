# Add a kind discriminator to signed tokens

Status: ready-for-agent
Source: navigation-overhaul spec §15, surfaced by the Discord OAuth research
Blocks: 01

## Problem

`verifyToken` in `src/worker.js` returns whatever JSON was signed, with no type field. Only
ad-hoc `role` checks at each call site keep an admin token and a pro token apart.

That holds today because there are exactly two kinds and both are checked. It stops holding
the moment OAuth introduces a signed `state` value: that blob is handed to the browser and
fed back to the same verifier, so "signed by us" stops meaning "is the thing we expected".

## What to build

A required `kind` field on every signed payload (`'admin'`, `'pro'`, `'state'`, `'session'`),
checked inside `verifyToken` rather than at each call site — pass the expected kind in and
reject a mismatch there, so a new call site cannot forget.

## Why it blocks sign-in

Introducing the OAuth `state` without this is what creates the confusion risk. Doing it
first means sign-in is built against a verifier that already discriminates.

## Watch out

**This is a flag-day change.** Pro tokens carry a 30-day TTL, so every token issued before
the change fails verification after it. Either accept that logged-in professionals must
re-unlock, or grandfather kind-less tokens as `'pro'` for one TTL window and then remove the
fallback. Decide which, and write the decision down.

## Done when

`verifyToken` rejects a token whose kind does not match what the caller asked for, every
issuing site sets a kind, and a test covers an admin token being offered where a pro token
is expected.

## Comments

**2026-10-29 — the flag-day question is decided: hard break, no grandfathering.** Taken while
breaking down [01](01-discord-oauth-sign-in.md). The live database holds **0 professional
ratings**, so there is plausibly no pro token in circulation at all; grandfathering kind-less
tokens as `'pro'` would buy a fallback branch that nobody can observe working and that
somebody has to remember to delete a month later. If a professional is holding a token, they
re-unlock with the invite code they already have.
