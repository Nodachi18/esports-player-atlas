// The ranked player list. Pure: no DOM, no fetch.

/**
 * Merge the leaderboard with the full player list into one ranked set.
 *
 * Two rules live here, both of which are easy to get wrong:
 *
 * 1. Rank is carried on the record, never derived from an array index. The list gets
 *    filtered by search, where index 0 is the first match rather than the top-ranked
 *    player.
 * 2. `GET /api/leaderboard` omits every player with no ratings, so they are appended
 *    unranked. Without this a newly created player is invisible in the whole UI.
 */
export function buildRanking(scored = [], all = []) {
  const ranked = scored.map((player, i) => ({ ...player, rank: i + 1 }));
  const seen = new Set(ranked.map(player => player.slug));
  const unrated = all
    .filter(player => !seen.has(player.slug))
    .map(player => ({ ...player, value: null, rank: null }));
  return [...ranked, ...unrated];
}

/** Case-insensitive match across the fields a viewer would plausibly type. */
export function filterPlayers(records, query) {
  const needle = String(query || '').trim().toLowerCase();
  if (!needle) return records;
  return records.filter(player =>
    [player.name, player.real_name, player.game, player.faction]
      .some(field => String(field || '').toLowerCase().includes(needle)));
}

/** One page of a list, with the page index clamped into range. */
export function pageOf(list, pageIndex, perPage) {
  const pages = Math.max(1, Math.ceil(list.length / perPage));
  const page = Math.min(Math.max(0, pageIndex), pages - 1);
  const from = page * perPage;
  return {
    items: list.slice(from, from + perPage),
    page,
    pages,
    from,
    to: Math.min(from + perPage, list.length),
    total: list.length,
  };
}

/**
 * The player in context: the requested one when it survives the current filter, else the
 * best match, else nothing. Keeps a selection alive across pages, and lets a search that
 * excludes the selected player move the detail to the top hit.
 */
export function resolveSelection(records, filtered, slug) {
  return filtered.find(player => player.slug === slug)
    || filtered[0]
    || records.find(player => player.slug === slug)
    || null;
}
