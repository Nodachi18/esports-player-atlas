// Every decision in the OAuth sign-in flow that is not a network call. Pure: no fetch, no
// env, no D1, no Workers globals.
//
// Same move as src/players.js. Nothing in this repository boots the Worker, so a rule left
// inside a route handler is a rule no test can see — and the three auth routes are mostly
// network plumbing wrapped around a handful of decisions that are worth getting right:
// which cookie attributes, which page a visitor comes back to, which scope is asked for.
// Those live here, under test, and what stays hand-checked is only the round trip to
// Discord itself.
//
// The authorize endpoint is **not** in this file. `authorizeUrl` takes its `base` as an
// argument, which keeps the host where the rest of the configuration already is and lets a
// test assert a whole URL against a base it chose. Two tripwires in test/frontend.test.js
// also watch src/ for that host, because the terms page makes promises about this flow.

/** The session cookie's name, in every environment. */
export const SESSION_COOKIE = 'epa_session';

/**
 * 30 days, in seconds, matching the `exp` the session token is signed with.
 *
 * There is no revocation: the token is valid until it expires, so this number is also how
 * long a signed-out-everywhere takes to become true. Accepted knowingly while breaking down
 * .scratch/accounts/01-discord-oauth-sign-in.md; a blocked-account check on the write routes
 * closes it later without touching the cookie.
 */
export const SESSION_MAX_AGE_SECONDS = 30 * 24 * 60 * 60;

/**
 * `identify` and nothing else, ever.
 *
 * This is the single string that keeps an address out of D1, and the terms page says so in
 * the present tense. A test in test/frontend.test.js reads every line in src/ that mentions
 * a scope and fails if it finds that word, so widening this is not a local change.
 */
export const SCOPE = 'identify';

/**
 * Where a visitor may be sent back to after signing in.
 *
 * This list, not the value in the state token, is what makes the return leg a navigation
 * within the app rather than an open redirect: `returnPage` answers with a key from here or
 * with the fallback, and never with anything the caller supplied. A key is a `?page=` value,
 * not a path and not a URL.
 *
 * Every page in public/app/state.js except `admin`, which is gated on a bearer token that a
 * Discord session does not grant — returning there would show a visitor a door they cannot
 * open. A test asserts this stays a subset of `PAGES`, since the two lists cannot import
 * each other: public/ is served as static assets and src/ is bundled.
 */
export const RETURN_PAGES = Object.freeze([
  'players', 'leaderboard', 'rate', 'account', 'help', 'legal', 'privacy', 'terms',
]);

/** Where sign-in goes when it has no trustworthy answer: the page that prompts for it. */
export const DEFAULT_RETURN_PAGE = 'rate';

// Discord's epoch (2015-01-01T00:00:00Z) and the width of the non-timestamp bits of a
// snowflake. https://docs.discord.com/developers/reference
const DISCORD_EPOCH_MS = 1420070400000n;
const SNOWFLAKE_TIMESTAMP_SHIFT = 22n;

/**
 * The full `Set-Cookie` value for a session.
 *
 * `HttpOnly` is the whole reason the token lives in a cookie rather than localStorage, and
 * `SameSite=Lax` is the CSRF defence for the API — `Lax` excludes `fetch()`, so a cross-site
 * POST carries no session. `Path=/` and no `Domain` pin it to this origin.
 *
 * **No `__Host-` prefix.** Its job is stopping a sibling subdomain writing the cookie, and
 * `workers.dev` is on the Public Suffix List, so a browser already refuses `Domain=workers.dev`
 * from any other Worker. Leaving it off buys one cookie name in both environments and no
 * uncertainty about how the prefix behaves under `wrangler dev` over plain HTTP.
 */
export function sessionCookie(token, maxAgeSeconds = SESSION_MAX_AGE_SECONDS) {
  return `${SESSION_COOKIE}=${token}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=${maxAgeSeconds}`;
}

/**
 * The same cookie, emptied and expired — what `POST /api/auth/logout` replies with.
 *
 * Every attribute has to match the one that set it or the browser keeps both. That is why
 * this goes through `sessionCookie` instead of spelling the header out a second time.
 */
export function expiredSessionCookie() {
  return sessionCookie('', 0);
}

/**
 * One cookie's value out of a `Cookie` request header, or `null`.
 *
 * Matching is on the whole name between the separator and the `=`, so `other_epa_session`
 * does not answer a lookup for `epa_session` — a substring test would hand the caller
 * somebody else's cookie, and the caller is the thing that decides whether you are signed in.
 */
export function readCookie(header, name) {
  for (const part of String(header ?? '').split(';')) {
    const eq = part.indexOf('=');
    if (eq < 0) continue;
    if (part.slice(0, eq).trim() !== name) continue;
    return part.slice(eq + 1).trim();
  }
  return null;
}

/**
 * The payload for the OAuth `state`, ready for `signToken`.
 *
 * `kind: 'state'` because `verifyToken` discriminates on it: this blob is handed to the
 * browser and fed back to the same verifier, so without a kind a state token is a candidate
 * session token. `page` is what lets the visitor come back to where they started, and it is
 * normalised here as well as on the return leg — there is no reason to sign a value that the
 * other end is only going to throw away.
 *
 * `now` and `ttlMs` are arguments rather than `Date.now()` so the expiry is testable.
 */
export function statePayload(page, now, ttlMs) {
  return { kind: 'state', page: returnPage(page), exp: now + ttlMs };
}

/**
 * A page key from `allowed`, or the fallback.
 *
 * This is the function that stops the OAuth return being an open redirect. The value comes
 * out of a token the browser carried, and a browser is not a place values stay put; `'../evil'`
 * and `'https://evil.example'` are the shapes that matter, and both fall back. The result is
 * only ever a member of `allowed`, so a caller cannot build a redirect out of it that leaves
 * this origin.
 */
export function returnPage(value, allowed = RETURN_PAGES) {
  return allowed.includes(value) ? value : DEFAULT_RETURN_PAGE;
}

/**
 * The authorize URL to redirect to, built on the `base` the caller supplies.
 *
 * `response_type=code` is the authorization-code grant: the Worker is a confidential client
 * holding the secret, so there is no PKCE. Everything is encoded by `URLSearchParams`;
 * `redirect_uri` in particular has to arrive encoded and byte-identical to the registered one.
 */
export function authorizeUrl({ base, clientId, redirectUri, scope = SCOPE, state }) {
  const params = new URLSearchParams({
    client_id: clientId,
    response_type: 'code',
    redirect_uri: redirectUri,
    scope,
    state,
  });
  return `${base}?${params}`;
}

/**
 * The body of the code exchange, as a `URLSearchParams`.
 *
 * Form-encoded, not JSON: the token endpoint does not accept JSON. The credentials go in the
 * body rather than an `Authorization: Basic` header — both are accepted, and this is one
 * `btoa()` fewer. Returning the `URLSearchParams` itself lets the caller hand it straight to
 * `fetch`, which sets the content type for it.
 */
export function tokenRequestBody({ clientId, clientSecret, code, redirectUri }) {
  return new URLSearchParams({
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: 'authorization_code',
    code,
    redirect_uri: redirectUri,
  });
}

/**
 * How long ago the account was created, in milliseconds, from the snowflake alone.
 *
 * **Nothing gates on this.** It is here because it costs nothing and
 * .scratch/moderation/03-ban-accounts-and-moderate-ratings.md will want a throwaway signal.
 *
 * BigInt is not optional. `>>` in JavaScript coerces to a signed 32-bit integer, so
 * `175928847299117063 >> 22` is `-252` and the account appears to predate Discord itself —
 * silently, with no error anywhere. A 19-digit snowflake does not survive a number either;
 * it arrives as a string and stays one.
 *
 * Returns `null` for anything that is not a run of digits, so a surprise in the identity
 * response cannot throw inside the callback for the sake of a signal nothing reads.
 */
export function accountAgeMs(snowflake, now) {
  const id = String(snowflake ?? '');
  if (!/^\d+$/.test(id)) return null;
  const createdAt = Number((BigInt(id) >> SNOWFLAKE_TIMESTAMP_SHIFT) + DISCORD_EPOCH_MS);
  return now - createdAt;
}
