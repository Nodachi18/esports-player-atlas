// The admin player form's decisions. Pure: no DOM, no fetch, no state of its own.
//
// The form has one mode and it is derived from the Selection rather than picked, so the
// rule lives here where a test can see it instead of inside a render function.

/**
 * The seven columns an admin may edit, with the length the API will accept.
 *
 * Duplicated from src/players.js, the way public/app/scores.js duplicates CATEGORIES from
 * src/stats.js: the browser is served public/ alone and cannot import across. Unlike that
 * pair, a test asserts the two objects are identical, so the copies cannot drift apart
 * without something going red.
 *
 * These are the inputs' maxlength, which is why the API's 400 never fires in a browser.
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

/** No Selection is the create form; a Selection is the edit form. There is no third. */
export const formMode = selection => (selection ? 'edit' : 'create');

/**
 * What the inputs show: the Selection's stored values, overlaid with anything typed.
 *
 * The draft is overlaid rather than consulted with `||`, so a field the admin emptied
 * stays empty instead of having the stored value quietly put back.
 *
 * A draft carries the slug it was typed against — `null` while creating — and one
 * belonging to anybody else is dropped. Switching Selection is meant to discard the
 * draft silently, and tying it to a slug is what makes that true without depending on a
 * caller remembering to clear it.
 */
export function formValues(selection, draft) {
  const stored = selection || {};
  const typed = draft && draft.slug === (selection ? selection.slug : null) ? draft : {};
  return Object.fromEntries(FIELDS.map(field => [
    field,
    field in typed ? String(typed[field] ?? '') : String(stored[field] ?? ''),
  ]));
}

/**
 * Whether the typed confirmation arms the delete. An exact match on the slug and nothing
 * else: not the name, not a different case, not a value with whitespace around it.
 *
 * Decision 2 is a hard delete that takes the Player's Ratings and their cached scores
 * with it, so this is the only line of defence in front of it. Trimming the input or
 * folding its case would each remove a keystroke from a guard whose entire job is to cost
 * keystrokes.
 */
export const canDelete = (typed, slug) => Boolean(slug) && typed === slug;

const plural = n => `${n} rating${n === 1 ? '' : 's'}`;

/**
 * The delete guard's copy. Every control says what it does: the button is
 * `Delete BoxeR and 12 ratings`, never `Confirm`, and cancelling says `Keep BoxeR`.
 *
 * The zero case gets a sentence of its own rather than "and destroys the 0 ratings".
 * Most of the roster has no Ratings at all, so without it the warning reads as a lie
 * exactly when the admin is most likely to be reading it.
 */
export function deletePrompt(player) {
  const n = player.ratings || 0;
  return {
    heading: `Delete ${player.name}?`,
    lead: n
      ? `This removes ${player.name} from the site and destroys the ${plural(n)} cast about them.`
      : `This removes ${player.name} from the site. They have no ratings yet, so nothing else goes with them.`,
    confirm: n ? `Delete ${player.name} and ${plural(n)}` : `Delete ${player.name}`,
    cancel: `Keep ${player.name}`,
  };
}

/**
 * What the form does with the server's answer: the message to show, where the Selection
 * lands, and whether the roster has to be refetched.
 *
 * `select` is deliberately three-valued — absent means "leave the Selection where it is",
 * `null` means "clear it", a slug means "go there" — because a 400 that moved the
 * Selection would throw away the draft the admin is being asked to correct.
 *
 * A 404 lands exactly where a successful delete lands. The end state is identical: the
 * Player is gone and the roster on screen is stale.
 *
 * @param {{status: number, action: 'create'|'save'|'delete', name?: string,
 *          slug?: string, ratings?: number, error?: string}} outcome
 */
export function resultFor({ status, action, name, slug, ratings = 0, error = '' }) {
  if (status === 401) return { tone: 'bad', text: 'Your admin session expired.', signOut: true };

  if (status === 404) {
    return {
      tone: 'bad',
      text: 'That player no longer exists. The roster has been reloaded.',
      select: null,
      reload: true,
    };
  }

  if (status === 409) return { tone: 'bad', text: `A player called ${name} already exists.` };

  // Everything that is not an answer from the route is a failure, not just 4xx and 5xx:
  // a request that never reached the server arrives as status 0, which is below every
  // error branch and would otherwise fall through to the success tail below and report
  // "Saved." in green over a save that did not happen.
  if (status !== 200 && status !== 201) {
    return { tone: 'bad', text: error || 'That change was not saved.' };
  }

  if (action === 'create') {
    return { tone: 'ok', text: `Created ${name} at /${slug}`, select: slug, reload: true };
  }

  if (action === 'delete') {
    const went = ratings ? ` and ${plural(ratings)}` : '';
    return { tone: 'ok', text: `Deleted ${name}${went}.`, select: null, reload: true };
  }

  // A save: stay on the Player. The roster still reloads, because a renamed Player has to
  // reappear in the rail under the name that was just given to them.
  return { tone: 'ok', text: 'Saved.', reload: true };
}
