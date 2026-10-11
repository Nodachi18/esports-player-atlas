// What a Player's editable fields are allowed to be. Pure: no env, no db, no Response.
//
// It lives outside src/worker.js so `node --test` can reach it — nothing in this
// repository boots the Worker, so a rule left at the route boundary is a rule no test
// can see. POST and PUT both call it, which is also what stops the two drifting apart.

/**
 * Every editable field, in the order the form shows them, with its cap.
 *
 * One number for the whole Editorial fieldset — `style` was 200 and `notes` was 1000, and
 * two numbers for three fields of the same kind is a distinction the form cannot show.
 * Nothing in the schema enforces these: SQLite TEXT is unbounded and a CHECK cannot be
 * added to an existing column additively, so this object is the only place they live.
 * Each is also the input's maxlength, so in a browser the 400 never fires; it exists for
 * when the two drift apart, and for anything that is not the form.
 */
export const CAPS = Object.freeze({
  name: 80,
  real_name: 120,
  game: 80,
  faction: 80,
  style: 250,
  form: 250,
  notes: 250,
});

export const FIELDS = Object.keys(CAPS);

const REQUIRED = ['name', 'game'];

const trim = value => String(value ?? '').trim();

/**
 * @returns {{ok: true, values: object} | {ok: false, status: number, error: string}}
 */
export function validatePlayerInput(body = {}) {
  const values = Object.fromEntries(FIELDS.map(field => [field, trim(body[field])]));

  if (REQUIRED.some(field => !values[field])) {
    return { ok: false, status: 400, error: 'name and game are required' };
  }

  // Over-length is rejected, never truncated. Silently cutting an admin's text off at 250
  // loses work they can neither see nor get back; naming the field lets them shorten it
  // and save again.
  for (const field of FIELDS) {
    if (values[field].length > CAPS[field]) {
      return { ok: false, status: 400, error: `${field} must be ${CAPS[field]} characters or fewer` };
    }
  }

  return { ok: true, values };
}
