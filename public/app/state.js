// The one selection object, and its mapping to and from a query string. Pure.
//
// Client-side routing is deferred, so today this reads and writes `?page=…`. When real
// paths land, only this module changes: everything else already reads the state object.

import { LENSES } from './scores.js';

export const PAGES = ['players', 'leaderboard', 'rate', 'account', 'admin'];
export const METRICS = LENSES;
export const CATEGORY_FILTERS = ['', 'strategy', 'tactics', 'micro', 'macro', 'decisions'];

export const DEFAULT_STATE = Object.freeze({
  page: 'players',
  player: null,     // slug; null means "whichever is top-ranked"
  query: '',
  lens: 'combined',      // which panel the radar shows
  metric: 'combined',    // which panel the leaderboard ranks by — deliberately separate
  category: '',          // '' is Overall
  strip: 0,              // ranked-strip page index
});

const oneOf = (allowed, value, fallback) => (allowed.includes(value) ? value : fallback);

export function stateFromSearch(search) {
  const params = new URLSearchParams(search);
  return {
    ...DEFAULT_STATE,
    page: oneOf(PAGES, params.get('page'), DEFAULT_STATE.page),
    player: params.get('player') || null,
    query: params.get('q') || '',
    lens: oneOf(LENSES, params.get('lens'), DEFAULT_STATE.lens),
    metric: oneOf(METRICS, params.get('metric'), DEFAULT_STATE.metric),
    category: oneOf(CATEGORY_FILTERS, params.get('category'), DEFAULT_STATE.category),
    strip: Math.max(0, Number.parseInt(params.get('strip') || '0', 10) || 0),
  };
}

/** Only non-default values are written, so a shared link stays readable. */
export function searchFromState(state) {
  const params = new URLSearchParams();
  const put = (key, value, fallback) => { if (value && value !== fallback) params.set(key, value); };
  put('page', state.page, DEFAULT_STATE.page);
  put('player', state.player, null);
  put('q', state.query, '');
  put('lens', state.lens, DEFAULT_STATE.lens);
  put('metric', state.metric, DEFAULT_STATE.metric);
  put('category', state.category, DEFAULT_STATE.category);
  if (state.strip > 0) params.set('strip', String(state.strip));
  const query = params.toString();
  return query ? `?${query}` : '';
}

/**
 * Apply a change. Returns a new object; never mutates.
 * Changing what is listed resets the page index, since page 3 of a different list is
 * meaningless and silently shows the wrong players.
 */
export function update(state, change) {
  const next = { ...state, ...change };
  if ('query' in change && change.query !== state.query) next.strip = 0;
  return next;
}
