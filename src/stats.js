// Pure aggregation helpers shared by the Worker and the unit tests.

export const CATEGORIES = ['strategy', 'tactics', 'micro', 'macro', 'decisions'];

// Combined score weights the professional median against the community median.
// This is a product assumption, not an empirically established fact.
export const PRO_WEIGHT = 2;

// Outlier detection only runs once a panel has enough ratings for a z-score to mean anything.
export const OUTLIER_MIN_SAMPLE = 8;
export const OUTLIER_Z = 3;

export function median(values) {
  if (!values.length) return null;
  const sorted = [...values].sort((a, b) => a - b), mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function mean(values) {
  return values.length ? values.reduce((sum, v) => sum + v, 0) / values.length : null;
}

export function stdDev(values) {
  if (values.length < 2) return 0;
  const m = mean(values);
  return Math.sqrt(values.reduce((sum, v) => sum + (v - m) ** 2, 0) / (values.length - 1));
}

// Per-category median, mean, sample standard deviation and 95% confidence interval.
export function summarize(rows) {
  const out = { n: rows.length };
  for (const c of CATEGORIES) {
    const values = rows.map(r => r[c]), m = mean(values), sd = stdDev(values);
    const margin = values.length > 1 ? 1.96 * sd / Math.sqrt(values.length) : 0;
    out[c] = {
      median: median(values),
      mean: m,
      sd,
      ci95: values.length ? [Math.max(0, m - margin), Math.min(100, m + margin)] : null,
    };
  }
  return out;
}

// IDs of rows whose score in any category is >= OUTLIER_Z standard deviations from the panel mean.
// Rows an admin has already reviewed are never auto-flagged again.
export function outlierIds(rows) {
  if (rows.length < OUTLIER_MIN_SAMPLE) return [];
  const ids = new Set();
  for (const c of CATEGORIES) {
    const values = rows.map(r => r[c]), m = mean(values), sd = stdDev(values);
    if (!sd) continue;
    for (const r of rows) if (!r.reviewed && Math.abs((r[c] - m) / sd) >= OUTLIER_Z) ids.add(r.id);
  }
  return [...ids];
}

export function combine(community, professional) {
  const out = {};
  for (const c of CATEGORIES) {
    const a = community[c].median, b = professional[c].median;
    out[c] = a == null ? b : b == null ? a : (a + PRO_WEIGHT * b) / (1 + PRO_WEIGHT);
  }
  return out;
}

// Single value per category for a panel ('combined' already holds plain numbers).
export function categoryScores(profile, metric) {
  const scores = {};
  for (const c of CATEGORIES) scores[c] = metric === 'combined' ? profile.combined[c] : profile[metric][c].median;
  return scores;
}

export function overall(scores) {
  return mean(CATEGORIES.map(c => scores[c]).filter(v => v != null));
}
