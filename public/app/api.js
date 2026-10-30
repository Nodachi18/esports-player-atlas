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

export const getGames = () => request('/api/games');

/**
 * The session probe every page load makes. It answers 200 signed out as well as in, with
 * `account: null`, so there is nothing here to catch — a visitor who has not signed in has
 * not failed at anything. The cookie is HttpOnly and travels on its own; nothing is passed.
 *
 * There is no start() beside these two. The authorize step is a top-level redirect to
 * discord.com, which an XHR cannot perform: that control is an anchor the browser follows,
 * not a call this module makes.
 */
export const getSession = () => request('/api/auth/me');

/**
 * Signing out needs a route even though it stores nothing: the session cookie is HttpOnly,
 * so the server that set it is the only thing that can unset it.
 */
export const logout = () => request('/api/auth/logout', { method: 'POST' });

export const adminLogin = key => json('/api/admin/login', { key });
export const getAdminStats = token => request('/api/admin/stats', { headers: { authorization: `Bearer ${token}` } });
export const getAdminRatings = token => request('/api/admin/ratings', { headers: { authorization: `Bearer ${token}` } });

const admin = (path, method, token, body) => request(path, {
  method,
  headers: {
    authorization: `Bearer ${token}`,
    ...(body ? { 'content-type': 'application/json' } : {}),
  },
  ...(body ? { body: JSON.stringify(body) } : {}),
});

const playerPath = slug => `/api/admin/players/${encodeURIComponent(slug)}`;

export const createPlayer = (token, body) => admin('/api/admin/players', 'POST', token, body);
export const updatePlayer = (token, slug, body) => admin(playerPath(slug), 'PUT', token, body);
export const deletePlayer = (token, slug) => admin(playerPath(slug), 'DELETE', token);
