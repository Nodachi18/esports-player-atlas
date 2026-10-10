// The only module that talks to /api. Every failure arrives as an ApiError carrying the
// status, so callers can branch on 409 vs 401 without parsing prose.

export class ApiError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new ApiError(0, 'Cannot reach the server.');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(response.status, body.error || 'Request failed');
  return body;
}

const json = (path, payload) => request(path, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify(payload),
});

export const getPlayers = () => request('/api/players');
export const getPlayer = slug => request(`/api/players/${encodeURIComponent(slug)}`);
export const getHistory = slug => request(`/api/history?player=${encodeURIComponent(slug)}`);

export const getLeaderboard = (metric = 'combined', category = '') =>
  request(`/api/leaderboard?metric=${encodeURIComponent(metric)}&category=${encodeURIComponent(category)}`);

export const submitRating = body => json('/api/ratings', body);

export const adminLogin = key => json('/api/admin/login', { key });
export const getAdminStats = token => request('/api/admin/stats', { headers: { authorization: `Bearer ${token}` } });
export const getAdminRatings = token => request('/api/admin/ratings', { headers: { authorization: `Bearer ${token}` } });

/**
 * Browser-local voter identity, as today. Trivially resettable, which is precisely why
 * accounts are planned; until then it is what distinguishes one community rater from
 * another.
 */
export function voterId() {
  let id = localStorage.voterAtlas;
  if (!id) {
    id = crypto.randomUUID() + crypto.randomUUID();
    localStorage.voterAtlas = id;
  }
  return id;
}
