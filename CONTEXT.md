# Esports Player Atlas

A rating and scouting prototype for competitive players. A community panel and an
invite-only professional panel submit ratings; the app publishes aggregate profiles,
radar charts, leaderboards and history.

Some terms below are **target-state**: decided, but not yet built. Where that is true it
is marked. The glossary records the language the project uses, not what ships today.

## Language

**Player**:
A competitor who can be rated and has a public profile page. Players exist whether or not
anyone has claimed them.
_Avoid_: Pro, athlete, subject

**Account** (target-state):
A registered identity that signs in. Distinct from a Player: an Account is who is using
the app, a Player is who is being rated.
_Avoid_: User, login, profile

**Role**:
What an Account is permitted to do. Exactly one of community, professional or admin.
_Avoid_: Permission, tier, level

**Professional**:
An Account that owns exactly one Player, edits only that Player's profile, and rates on
the professional Panel. A Professional *is* a Player; they are not two entities.
_Avoid_: Expert, scout, verified user

**Community**:
An Account with no public Player of its own. It rates and nothing else.
_Avoid_: Fan, public, anonymous

**Admin**:
Full access to every Player and every Rating. Currently a shared key rather than an
Account, so it has no Role in the sense above.
_Avoid_: Moderator, owner, staff

**Panel**:
The group a Rating was cast in — community or professional. Every Player carries one
aggregate score per Panel, plus a Combined score across both.
_Avoid_: Group, audience, pool

**Rating**:
One rater's scores across all five Categories for one Player, in one Panel. A rater has
at most one Rating per Player per Panel.
_Avoid_: Vote, review, score

**Category**:
One of the five fixed rating dimensions: strategy, tactics, micro, macro, decisions.
_Avoid_: Metric, dimension, attribute, stat

**Combined score**:
A Player's score across both Panels, weighting the professional median higher than the
community median. A configurable product choice, not an objective measure.
_Avoid_: Overall, total, final score

**Form**:
A Player's recent competitive standing, written as free text — "Top ~50, inconsistent". An
editorial judgement made by whoever edits the Player, never derived from Ratings or from
any score. A Player with no Ratings can still have a Form.
_Avoid_: Streak, standing, rank

**Selection**:
The Player currently being looked at or edited, carried in the URL as `?player=` and
shared by every page. Not to be confused with `players.active`, a vestigial column meaning
"not retired" — the phrase "active player" is ambiguous here and is avoided.
_Avoid_: Current player, active player, focus

**Handle**:
A Player's competitive name — the `name` column, and what the admin form labels. Unique
across the roster, case-insensitively, because it is how a Player is found and picked.
Distinct from their real name and from their slug.
_Avoid_: Nickname, alias, gamertag

**Slug**:
A Player's public address, derived from their Handle by the server when they are created
and never afterwards. It is in every link ever shared, so it does not change — and typing
it is the only confirmation accepted before a Player is deleted.
_Avoid_: ID, permalink, handle

**Flagged**:
A Rating marked as a statistical outlier, automatically or by an Admin. A review signal,
never proof of manipulation.
_Avoid_: Banned, rejected, invalid

**Promotion**:
An Admin linking an Account to a Player and granting it the professional Role. The only
live way to become a Professional.
_Avoid_: Upgrade, approval, verification

**Unlinked Player**:
A Player that no Account owns. Admin-created Players start this way and stay so until a
Promotion or a Claim links one.
_Avoid_: Orphan, unclaimed, stub

**Claim** (target-state):
A request by an Account to be linked to an Unlinked Player, granted or refused by an Admin.
_Avoid_: Application, request, verification

**Pro invite** (retired):
A shared code that grants professional rating access. It carries no individual identity:
everyone holding one code counts as a single rater — which is why Promotion replaces it.
_Avoid_: Token, key, invitation
