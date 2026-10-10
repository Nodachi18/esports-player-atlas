// Scoring and radar geometry. Pure: no DOM, no fetch.
//
// CATEGORIES is duplicated from src/stats.js on purpose. The Worker bundles src/, the
// browser is served public/, and nothing serves both.

export const CATEGORIES = ['strategy', 'tactics', 'micro', 'macro', 'decisions'];
export const LENSES = ['combined', 'community', 'professional'];

/**
 * One score per category for a lens, or null where that category has no rating.
 *
 * The shapes differ: `combined` holds plain numbers, `community` and `professional` hold
 * `{ median, mean, sd, ci95 }`. An unrated panel holds `{ median: null }`, which is why
 * reaching for `?? profile[lens]` instead of the median yields the stats object and
 * renders as NaN. Never returns NaN: a missing score is null.
 */
export function panelScores(profile, lens) {
  const source = profile ? (lens === 'combined' ? profile.combined : profile[lens]) : null;
  const scores = {};
  for (const category of CATEGORIES) {
    const cell = source ? source[category] : null;
    const value = cell !== null && typeof cell === 'object' ? cell.median : cell;
    scores[category] = typeof value === 'number' && Number.isFinite(value) ? value : null;
  }
  return scores;
}

/** False when a panel has no ratings at all — the caller draws no polygon. */
export function hasScores(scores) {
  return CATEGORIES.some(category => scores[category] != null);
}

/** Ratings behind a lens. `combined` spans both panels, so it sums them. */
export function ratingCount(profile, lens) {
  if (!profile) return 0;
  if (lens === 'combined') return (profile.community?.n ?? 0) + (profile.professional?.n ?? 0);
  return profile[lens]?.n ?? 0;
}

/** Radar vertex, index 0 at the top running clockwise, so it matches CATEGORIES order. */
export function vertex(index, radius, scale = 1, cx = 0, cy = 0) {
  const angle = -Math.PI / 2 + (index * 2 * Math.PI) / CATEGORIES.length;
  return [cx + Math.cos(angle) * radius * scale, cy + Math.sin(angle) * radius * scale];
}

/** `points` attribute for one polygon. `scales` is 0–1 per category. */
export function polygonPoints(radius, scales, cx, cy) {
  return CATEGORIES
    .map((_, i) => vertex(i, radius, scales[i], cx, cy).map(n => n.toFixed(1)).join(','))
    .join(' ');
}
