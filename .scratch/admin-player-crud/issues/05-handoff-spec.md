# Write the admin player CRUD handoff spec

Type: task
Status: open
Blocked by: 01, 02, 03, 04
Map: ../map.md

## Question

Fold the map's standing decisions and every resolved ticket into
`.scratch/admin-player-crud/spec.md`, complete enough that a build session implements it
without reopening any of these questions.

It has to carry:

- The two new routes, their request and response shapes, and their failure modes (03).
- The migration, written as the actual file under `migrations/` but **not applied** (02).
- The form: fields, modes, the read-only slug, the datalist on `game`, and the layout the
  prototype settled (01).
- The delete flow end to end, including the typed-slug guard and where the Selection lands
  afterwards (decisions 8 and 9).
- The preconditions, if `04` set any.
- What a test has to assert. At minimum: that the Selection round-trips through the URL
  into the form, that delete is unreachable without an exact slug match, and that create
  then immediately selecting the new Player works without `frontend/01` (decision 10).

Write down what the spec deliberately leaves out, with pointers — images, professional
self-editing, soft delete, rating moderation — so the build session does not rediscover
them as gaps. The map's Out of scope section is the source for that list.

Then close the map.
