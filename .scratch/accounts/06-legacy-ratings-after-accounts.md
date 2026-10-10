# Decide what happens to pre-account ratings

Status: needs-triage
Source: navigation-overhaul map fog, decisions 7 and 16
Blocked by: 01

## Problem

Every rating cast before accounts exists is anonymous, and the two panels are anonymous in
different ways:

- **Community** ratings hash a browser-local voter id: `sha256('community:' + voter)`. A
  real person may hold several, and one browser may have been several people.
- **Professional** ratings hash the invite id: `sha256('pro:' + invite.id)`. Every holder of
  one code collapsed into a single rater. **There is no person in there to link an Account
  to** — not a hard migration, an impossible one.

It was already agreed that existing ratings are kept as historical data. What was never
decided is how they are shown once some ratings are attributable and some are not.

## Questions for triage

- Does a pre-account rating still count toward the published medians, or only toward
  history?
- Does the UI distinguish attributable ratings from legacy ones, or stay silent?
- `UNIQUE (player_id, panel, voter_hash)` means a person who rated anonymously and then signs
  in can rate the same player again under their Account. Is that acceptable, or does the old
  row need retiring?
- Do the collapsed professional ratings survive at all, given one row may represent many
  people's opinions?

## Done when

The answer is written down and, if it implies data work, a migration ticket exists.
