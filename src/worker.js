// Esports Player Atlas API on Cloudflare Workers + D1.
// Static files in public/ are served by Workers Assets; this Worker only sees /api/* and unmatched paths.

import { CATEGORIES, summarize, outlierIds, combine, categoryScores, overall } from './stats.js';
import { validatePlayerInput } from './players.js';
import {
  SESSION_MAX_AGE_SECONDS,
  sessionCookie,
  expiredSessionCookie,
  statePayload,
  returnPage,
  authorizeUrl,
  tokenRequestBody,
} from './auth.js';

const VERSION = '4.0';
const MAX_BODY_BYTES = 16 * 1024;
const PRO_TOKEN_TTL = 30 * 864e5, ADMIN_TOKEN_TTL = 8 * 36e5;
const PLAYER_COLUMNS = 'id,slug,name,real_name,game,faction,style,form,notes,created_at';
// Discord's three endpoints. They live here rather than in src/auth.js so that module stays
// a pile of pure decisions with no host in it — see its header, and the tripwires in
// test/frontend.test.js that watch src/ for exactly these strings.
const DISCORD_AUTHORIZE_URL = 'https://discord.com/api/oauth2/authorize';
const DISCORD_TOKEN_URL = 'https://discord.com/api/oauth2/token';
const DISCORD_IDENTITY_URL = 'https://discord.com/api/users/@me';
// Five minutes is the whole life of a state token: long enough to read a consent screen,
// short enough that a copy left in a browser history or a referrer log is already dead.
const STATE_TTL = 5 * 60e3;
// Every way sign-in can fail answers with this one URL. A reason in the query string would
// be shareable, loggable and visible to the one party that already knows what it did wrong.
const AUTH_FAILED = '/?page=rate&auth=failed';
// Discord caps a username and a global name at 32 characters and an avatar hash at 34.
// These columns are a display cache, so the cap is a sanity bound on a third party's
// response, not a validation rule.
const DISCORD_FIELD_MAX = 64;
const SCORE_COLUMNS = CATEGORIES.join(',');

class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.status = status;
  }
}

// `public/_headers` covers the static site, but it does not reach responses the Worker
// builds itself — and /api/players serves the real names of real people. Same directive,
// stated here too.
const NOINDEX = 'noindex, nofollow, noarchive, nosnippet';

const json = (status, body) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json', 'cache-control': 'no-store', 'x-robots-tag': NOINDEX },
  });

/**
 * The one response in this Worker that can carry a `Set-Cookie`.
 *
 * `json()` builds its headers inline and has nowhere to put one, and widening it would hang
 * a cookie parameter off every call site in this file that will never pass one. The auth
 * routes are the only responses that write a cookie, and two of the three are redirects
 * rather than JSON at all, so they get their own helper instead.
 */
const authResponse = (status, { location, cookie, body } = {}) =>
  new Response(body ? JSON.stringify(body) : null, {
    status,
    headers: {
      'cache-control': 'no-store',
      'x-robots-tag': NOINDEX,
      ...(location ? { location } : {}),
      ...(cookie ? { 'set-cookie': cookie } : {}),
      ...(body ? { 'content-type': 'application/json' } : {}),
    },
  });

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);
    try {
      return await route(request, env, url);
    } catch (e) {
      if (e instanceof HttpError) return json(e.status, { error: e.message });
      console.error(e);
      return json(500, { error: 'Server error' });
    }
  },
};

async function route(request, env, url) {
  const db = env.DB, method = request.method, path = url.pathname, q = url.searchParams;

  if (method === 'GET' && path === '/api/health') return json(200, { ok: true, version: VERSION });

  if (method === 'GET' && path === '/api/games') {
    return json(200, await all(db.prepare('select game,count(*) players from players where active=1 group by game order by game')));
  }

  if (method === 'GET' && path === '/api/players') {
    const search = q.get('q') || '', game = q.get('game') || '', args = [];
    // `ratings` counts every row including flagged ones, because a delete cascades to
    // those too. Deliberately not the same number as community.n/professional.n, which
    // exclude flagged rows — one flat count, from one place, serving the admin roster
    // rail, the form's read-only cell and the delete guard alike.
    let sql = `select p.id,p.slug,p.name,p.real_name,p.game,p.faction,p.style,p.form,p.notes,
                      count(r.id) ratings
               from players p left join ratings r on r.player_id=p.id
               where p.active=1`;
    if (search) {
      sql += ' and (p.name like ?1 or p.real_name like ?1 or p.game like ?1)';
      args.push('%' + search + '%');
    }
    if (game) {
      sql += ` and p.game=?${args.length + 1}`;
      args.push(game);
    }
    return json(200, await all(db.prepare(sql + ' group by p.id order by p.name').bind(...args)));
  }

  if (method === 'GET' && path.startsWith('/api/players/')) {
    const [player] = await profiles(db, [decodeURIComponent(path.slice('/api/players/'.length))]);
    return player ? json(200, player) : json(404, { error: 'Player not found' });
  }

  if (method === 'GET' && path === '/api/compare') {
    return json(200, await profiles(db, (q.get('players') || '').split(',').filter(Boolean).slice(0, 4)));
  }

  if (method === 'GET' && path === '/api/leaderboard') {
    const metric = ['combined', 'community', 'professional'].includes(q.get('metric')) ? q.get('metric') : 'combined';
    const category = CATEGORIES.includes(q.get('category')) ? q.get('category') : null;
    const players = (await profiles(db, null))
      .map(p => {
        const scores = categoryScores(p, metric);
        return { ...p, value: category ? scores[category] : overall(scores) };
      })
      .filter(p => p.value != null)
      .sort((a, b) => b.value - a.value);
    return json(200, { metric, category, players });
  }

  if (method === 'GET' && path === '/api/history') {
    const player = await db.prepare('select id from players where slug=? and active=1').bind(q.get('player') || '').first();
    if (!player) return json(404, { error: 'Player not found' });
    const averages = CATEGORIES.map(c => `round(avg(${c}),1) ${c}`).join(',');
    return json(200, await all(db.prepare(
      `select substr(created_at,1,10) day,panel,count(*) n,${averages} from ratings where player_id=? and flagged=0 group by day,panel order by day`,
    ).bind(player.id)));
  }

  if (method === 'POST' && path === '/api/pro/verify') {
    const { code } = await readJson(request);
    const invite = code && await db.prepare('select id from pro_invites where code_hash=?').bind(await sha256Hex(code)).first();
    if (!invite) return json(401, { error: 'Invalid professional code' });
    return json(200, { token: await signToken(env, { role: 'pro', invite: invite.id, exp: Date.now() + PRO_TOKEN_TTL }) });
  }

  if (method === 'POST' && path === '/api/ratings') return submitRating(env, await readJson(request));

  if (method === 'POST' && path === '/api/admin/login') {
    const { key } = await readJson(request);
    // The success path returns first, so .limit() is only ever reached by a failed
    // attempt: a correct key never spends budget and an attacker spends it every time.
    // Written the other way round the 429 would sit between the 401 and its own
    // condition, and would throttle the admin as readily as the attacker.
    if (await isAdminKey(env, key)) {
      return json(200, { token: await signToken(env, { role: 'admin', exp: Date.now() + ADMIN_TOKEN_TTL }) });
    }
    // Keyed on CF-Connecting-IP because the edge sets it and a client cannot suppress it.
    // Absent only under `wrangler dev`, where this fails open: a constant fallback key
    // would give every header-less caller one shared bucket, which anyone could exhaust
    // to lock the admin out of their own site.
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip && !(await env.LOGIN_LIMIT.limit({ key: ip })).success) {
      return json(429, { error: 'Too many attempts. Please try again shortly.' });
    }
    return json(401, { error: 'Invalid admin key' });
  }

  if (path.startsWith('/api/auth/')) return authRoute(request, env, method, path, url);

  if (path.startsWith('/api/admin/')) {
    const token = await verifyToken(env, (request.headers.get('authorization') || '').replace(/^Bearer /i, ''));
    if (token?.role !== 'admin') return json(403, { error: 'Admin authentication required' });
    return adminRoute(request, env, method, path);
  }

  return json(404, { error: 'Not found' });
}

/**
 * Discord sign-in: authorization-code grant with this Worker as a confidential client, so
 * no PKCE. Three routes, and `Authorization: Bearer` is untouched by all three — this adds
 * a cookie path for visitors, it replaces nothing for admins or professionals.
 */
async function authRoute(request, env, method, path, url) {
  if (method === 'GET' && path === '/api/auth/discord/start') {
    const { clientId, redirectUri } = discordSecrets(env);
    // The page to come back to is signed, not remembered: there is nowhere to remember it
    // yet, and a value the browser carries is safe here because returnPage() only ever
    // answers with a key from its own list. statePayload normalises it before signing, so
    // a junk ?page= is discarded at the start of the trip rather than the end of it.
    const state = await signToken(env, statePayload(url.searchParams.get('page'), Date.now(), STATE_TTL));
    return authResponse(302, {
      location: authorizeUrl({ base: DISCORD_AUTHORIZE_URL, clientId, redirectUri, state }),
    });
  }

  if (method === 'GET' && path === '/api/auth/discord/callback') return discordCallback(request, env, url);

  if (method === 'POST' && path === '/api/auth/logout') {
    // A route for something that writes nothing, because JavaScript cannot clear an
    // HttpOnly cookie — only the server that set it can unset it. 200 with the expired
    // cookie rather than a redirect: the caller is a fetch() that re-renders itself, and
    // a 302 would make it fetch the index page for a body it throws away.
    return authResponse(200, { cookie: expiredSessionCookie(), body: { ok: true } });
  }

  return json(404, { error: 'Not found' });
}

/**
 * The Discord credentials, or a 503 — and deliberately **not** part of secrets(env).
 *
 * secrets(env) guards every route in this Worker through hmac(), so adding these three to
 * it would take the public site down the moment one of them was missing from a deploy. A
 * misconfigured sign-in should break sign-in and nothing else.
 *
 * DISCORD_REDIRECT_URI is configuration rather than something derived from the request
 * origin: Discord matches it byte-for-byte against a registered value, so deriving it means
 * every origin the app is ever opened at has to be registered in its own right.
 */
function discordSecrets(env) {
  const { DISCORD_CLIENT_ID: clientId, DISCORD_CLIENT_SECRET: clientSecret, DISCORD_REDIRECT_URI: redirectUri } = env;
  if (!clientId || !clientSecret || !redirectUri) {
    throw new HttpError(503, 'Sign-in is not configured: set DISCORD_CLIENT_ID, DISCORD_CLIENT_SECRET and DISCORD_REDIRECT_URI');
  }
  return { clientId, clientSecret, redirectUri };
}

/**
 * The return leg. Ordered so that the cheap refusals happen first: nothing below touches D1
 * or discord.com until the state has proved it was signed here.
 *
 * The Discord access token exists between the exchange and /users/@me and is then dropped.
 * It is never written to D1 and never put in the session: the app wants to know who someone
 * is, not to act as them, and a stored credential with no use for it is a liability with no
 * asset against it.
 */
async function discordCallback(request, env, url) {
  const failed = () => authResponse(302, { location: AUTH_FAILED });
  const q = url.searchParams;

  // The visitor pressed Cancel on the consent screen (?error=access_denied), or Discord
  // refused for its own reasons. Checked first, so a declined sign-in costs neither a
  // signature verification nor a round trip, and so the same refusal covers an error
  // parameter this code has never heard of.
  if (q.get('error')) return failed();

  const state = await verifyToken(env, q.get('state'));
  // `kind` is checked here, at the call site, rather than inside verifyToken. Moving the
  // check in there for every caller is .scratch/accounts/02-token-kind-discriminator.md,
  // which merges separately; this route cannot wait for it, because it is the route that
  // creates the problem — a session token is signed with the same key and would otherwise
  // verify here as a perfectly good state.
  if (state?.kind !== 'state') return failed();

  const code = q.get('code');
  if (!code) return failed();

  const { clientId, clientSecret, redirectUri } = discordSecrets(env);
  // Form-encoded. The token endpoint does not accept JSON, and the failure mode if you
  // send it anyway is an unhelpful invalid_request.
  const exchange = await fetch(DISCORD_TOKEN_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: tokenRequestBody({ clientId, clientSecret, code, redirectUri }),
  });
  if (!exchange.ok) {
    // AUTH_LIMIT, and its reason is not the admin login's. There is no guessable secret
    // anywhere in this flow: `state` is HMAC-SHA256 over APP_SECRET, so forging one means
    // already holding the secret. What this guards against is amplification — a caller
    // fetches one legitimate state from /start for free, then replays it here with a
    // garbage code, and every replay makes this Worker POST to discord.com. Discord rate
    // limits per application, so a few minutes of that gets our client 429'd and sign-in
    // stops working for everyone. An availability control, not a credential one. Anyone
    // moving this later needs that distinction, because the admin login's placement rule
    // ("never spend budget on a success") was written for the other reason entirely.
    //
    // Its own namespace rather than LOGIN_LIMIT's: one shared bucket per IP would mean
    // that hammering /api/auth/* locks the administrator out of their own site.
    //
    // KNOWN LIMIT, stated rather than quietly carried: counting here means the refusal
    // lands after the outbound POST has already been made, so this caps the response and
    // not the call it is named for. Capping the call means consulting the limiter in front
    // of the exchange, which also spends budget on successful sign-ins. Specified this way
    // in .scratch/accounts/01-discord-oauth-sign-in/04-the-three-auth-routes.md; the
    // reasoning above is what a change to either placement has to answer to.
    //
    // Keyed and failing open exactly as POST /api/admin/login is: the edge sets
    // CF-Connecting-IP and a client cannot suppress it, and it is absent only under
    // `wrangler dev`.
    const ip = request.headers.get('CF-Connecting-IP');
    if (ip && !(await env.AUTH_LIMIT.limit({ key: ip })).success) {
      // The one failure that does not redirect. Six failed exchanges from one address
      // inside a minute is not a person signing in, and a refusal that looks identical to
      // the thing it is refusing is a refusal nobody can act on.
      return json(429, { error: 'Too many attempts. Please try again shortly.' });
    }
    return failed();
  }

  const grant = await exchange.json().catch(() => null);
  if (!grant?.access_token) return failed();

  const identity = await fetch(DISCORD_IDENTITY_URL, {
    headers: { authorization: `${grant.token_type || 'Bearer'} ${grant.access_token}` },
  });
  if (!identity.ok) return failed();
  const user = await identity.json().catch(() => null);
  // The snowflake is the identity and the only field this flow cannot do without. It stays
  // a string from here to the database: 19 digits do not survive a JavaScript number.
  if (!user?.id) return failed();

  // Upsert on the snowflake, never on the username — that one is mutable and not unique on
  // Discord's side, and is a display cache here and nothing else. Refreshed on every
  // sign-in, because this is the only moment the app ever hears about a change to it.
  await env.DB.prepare(
    `insert into accounts(discord_id,username,global_name,avatar,last_login_at)
     values(?,?,?,?,CURRENT_TIMESTAMP)
     on conflict(discord_id) do update set
       username=excluded.username,global_name=excluded.global_name,avatar=excluded.avatar,
       last_login_at=CURRENT_TIMESTAMP`,
  ).bind(
    String(user.id),
    text(user.username, DISCORD_FIELD_MAX),
    text(user.global_name, DISCORD_FIELD_MAX),
    text(user.avatar, DISCORD_FIELD_MAX),
  ).run();

  const token = await signToken(env, {
    kind: 'session',
    sub: String(user.id),
    exp: Date.now() + SESSION_MAX_AGE_SECONDS * 1000,
  });
  // Normalised a second time: statePayload already did this before signing, and the value
  // has been through a browser since. This is the assertion that the return leg is a
  // navigation inside the app rather than an open redirect.
  return authResponse(302, {
    location: `/?page=${returnPage(state.page)}`,
    cookie: sessionCookie(token),
  });
}

async function adminRoute(request, env, method, path) {
  const db = env.DB;

  if (method === 'GET' && path === '/api/admin/stats') {
    // `players` has to come from `players`. Counting distinct player_id in `ratings`
    // answers a different question — how many players anyone has rated — and the admin
    // page labelled that answer "players", so a roster of 38 reported 3.
    const totals = await db.prepare(
      `select count(*) ratings,sum(panel='community') community,sum(panel='professional') professional,sum(flagged) flagged,count(distinct player_id) rated from ratings`,
    ).first();
    const roster = await db.prepare('select count(*) players from players where active=1').first();
    const daily = await all(db.prepare(
      'select substr(created_at,1,10) day,count(*) ratings,sum(flagged) flagged from ratings group by day order by day desc limit 30',
    ));
    return json(200, { totals: { ...totals, players: roster.players }, daily });
  }

  if (method === 'GET' && path === '/api/admin/ratings') {
    return json(200, await all(db.prepare(
      `select r.id,p.name,r.panel,r.created_at,${CATEGORIES.map(c => 'r.' + c).join(',')},r.flagged,r.reviewed from ratings r join players p on p.id=r.player_id order by r.id desc limit 1000`,
    )));
  }

  if (method === 'POST' && path === '/api/admin/players') {
    const check = validatePlayerInput(await readJson(request));
    if (!check.ok) return json(check.status, { error: check.error });
    const v = check.values;

    // The slug comes from the name and from nothing else. It is the Player's public
    // address and sits in every link ever shared, so a client that could supply one
    // could mint an address for a Player it does not own.
    const slug = await uniqueSlug(db, v.name);
    try {
      // created_at and updated_at are written in one statement rather than left to the
      // column default: SQLite evaluates CURRENT_TIMESTAMP once per statement, so the
      // two are identical instead of a microsecond apart.
      await db.prepare(
        `insert into players(slug,${EDITABLE_COLUMNS},created_at,updated_at)
         values(?,?,?,?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)`,
      ).bind(slug, ...editableValues(v)).run();
    } catch (e) {
      if (isUniqueViolation(e)) return json(409, { error: `A player called ${v.name} already exists` });
      throw e;
    }
    return json(201, (await profiles(db, [slug]))[0]);
  }

  if (path.startsWith('/api/admin/players/') && (method === 'PUT' || method === 'DELETE')) {
    const slug = decodeURIComponent(path.slice('/api/admin/players/'.length));
    if (!slug) return json(404, { error: 'Player not found' });
    return method === 'PUT'
      ? updatePlayer(db, slug, await readJson(request))
      : deletePlayer(db, slug);
  }

  if (method === 'POST' && path === '/api/admin/pro-invites') {
    const b = await readJson(request);
    const code = b.code ? String(b.code) : base64url(crypto.getRandomValues(new Uint8Array(12)));
    if (code.length < 8) return json(400, { error: 'Invite codes must be at least 8 characters' });
    try {
      await db.prepare('insert into pro_invites(code_hash,label) values(?,?)').bind(await sha256Hex(code), text(b.label, 120)).run();
    } catch (e) {
      if (String(e.message).includes('UNIQUE')) return json(409, { error: 'Invite code already exists' });
      throw e;
    }
    return json(201, { code });
  }

  if (method === 'POST' && path === '/api/admin/ratings/flag') {
    const b = await readJson(request);
    const rating = Number.isInteger(b.id) && await db.prepare('select player_id,panel from ratings where id=?').bind(b.id).first();
    if (!rating) return json(404, { error: 'Rating not found' });
    await db.prepare('update ratings set flagged=?,reviewed=1 where id=?').bind(b.flagged ? 1 : 0, b.id).run();
    await refreshStats(db, rating.player_id, rating.panel);
    return json(200, { ok: true });
  }

  return json(404, { error: 'Not found' });
}

/**
 * A full replace, not a patch: an absent field is written as '', never read as
 * "unchanged". A partial update would make it impossible to clear a field, and the API
 * would have to guess which of the two an empty string meant.
 *
 * updated_at moves on every call, including one that changes nothing. One UPDATE, no
 * read-back and no diff — "the admin pressed Save" is the event worth recording, and
 * deciding whether anything really changed costs a read to answer a question nobody asked.
 *
 * Does not filter `active`: the column is vestigial and nothing writes it, so filtering on
 * it here would make a Player unreachable for reasons no one could see.
 */
async function updatePlayer(db, slug, body) {
  const check = validatePlayerInput(body);
  if (!check.ok) return json(check.status, { error: check.error });
  const v = check.values;

  let result;
  try {
    result = await db.prepare(
      `update players set ${EDITABLE_COLUMNS.split(',').map(column => `${column}=?`).join(',')},
              updated_at=CURRENT_TIMESTAMP
       where slug=?`,
    ).bind(...editableValues(v), slug).run();
  } catch (e) {
    if (isUniqueViolation(e)) return json(409, { error: `A player called ${v.name} already exists` });
    throw e;
  }
  if (!result.meta.changes) return json(404, { error: 'Player not found' });

  // The response is what the form repaints from: the server's row, not the client's
  // optimism about what it just sent.
  return json(200, (await profiles(db, [slug]))[0]);
}

/**
 * A hard delete. The row goes, and the Player's Ratings and their cached aggregates in
 * player_stats go with it — through ON DELETE CASCADE and, on any connection where
 * foreign keys are not enforced, through the trigger in 0005.
 *
 * No body and no `confirm` echo: typing the slug is a UI mechanic, and an API that
 * accepted its own confirmation would be confirming nothing.
 */
async function deletePlayer(db, slug) {
  const player = await db.prepare('select id from players where slug=?').bind(slug).first();
  if (!player) return json(404, { error: 'Player not found' });

  // Counted in the same batch as the delete and before it, so the number reported is the
  // number removed. Flagged rows included: the cascade takes those too.
  const [count] = await db.batch([
    db.prepare('select count(*) n from ratings where player_id=?').bind(player.id),
    db.prepare('delete from players where id=?').bind(player.id),
  ]);
  return json(200, { slug, ratings: count.results[0].n });
}

async function submitRating(env, b) {
  const db = env.DB;
  const player = await db.prepare('select id,slug from players where slug=? and active=1').bind(String(b.player || '')).first();
  if (!player) return json(404, { error: 'Player not found' });

  const panel = b.panel === 'professional' ? 'professional' : 'community';
  let voterHash;
  if (panel === 'professional') {
    const token = await verifyToken(env, b.token);
    if (token?.role !== 'pro') return json(401, { error: 'Professional access required' });
    voterHash = await sha256Hex('pro:' + token.invite);
  } else {
    const voter = String(b.voter || '');
    if (voter.length < 20 || voter.length > 200) return json(400, { error: 'Missing voter token' });
    voterHash = await sha256Hex('community:' + voter);
  }

  const scores = CATEGORIES.map(c => Number(b[c]));
  if (scores.some(x => !Number.isInteger(x) || x < 0 || x > 100)) return json(400, { error: 'Scores must be 0-100 integers' });

  try {
    await db.prepare(`insert into ratings(player_id,panel,voter_hash,${SCORE_COLUMNS}) values(?,?,?,?,?,?,?,?)`)
      .bind(player.id, panel, voterHash, ...scores).run();
  } catch (e) {
    if (String(e.message).includes('UNIQUE')) return json(409, { error: 'Already rated this player' });
    throw e;
  }
  await refreshStats(db, player.id, panel);
  return json(201, { ok: true, player: (await profiles(db, [player.slug]))[0] });
}

// Re-derives outlier flags and the cached aggregate for one player/panel.
// This is the only place that scans a player's ratings; public reads use player_stats.
async function refreshStats(db, playerId, panel) {
  const rows = await all(db.prepare(`select id,flagged,reviewed,${SCORE_COLUMNS} from ratings where player_id=? and panel=?`).bind(playerId, panel));
  const newlyFlagged = new Set(outlierIds(rows).filter(id => !rows.find(r => r.id === id).flagged));
  const stats = summarize(rows.filter(r => !r.flagged && !newlyFlagged.has(r.id)));
  await db.batch([
    ...[...newlyFlagged].map(id => db.prepare('update ratings set flagged=1 where id=?').bind(id)),
    db.prepare(
      `insert into player_stats(player_id,panel,n,data) values(?,?,?,?)
       on conflict(player_id,panel) do update set n=excluded.n,data=excluded.data,updated_at=CURRENT_TIMESTAMP`,
    ).bind(playerId, panel, stats.n, JSON.stringify(stats)),
  ]);
}

// Loads active players (all of them when slugs is null) with their community/professional/combined aggregates,
// preserving the order of the requested slugs.
async function profiles(db, slugs) {
  if (slugs && !slugs.length) return [];
  const where = slugs ? `and p.slug in (${slugs.map(() => '?').join(',')})` : '';
  const [players, stats] = await db.batch([
    db.prepare(`select ${PLAYER_COLUMNS} from players p where active=1 ${where}`).bind(...(slugs || [])),
    db.prepare(`select s.player_id,s.panel,s.data from player_stats s join players p on p.id=s.player_id where p.active=1 ${where}`).bind(...(slugs || [])),
  ]);
  const byPlayer = new Map();
  for (const s of stats.results) byPlayer.set(s.player_id + ':' + s.panel, JSON.parse(s.data));
  const out = players.results.map(p => {
    const community = byPlayer.get(p.id + ':community') || summarize([]);
    const professional = byPlayer.get(p.id + ':professional') || summarize([]);
    return { ...p, community, professional, combined: combine(community, professional) };
  });
  return slugs ? slugs.map(s => out.find(p => p.slug === s)).filter(Boolean) : out;
}

async function all(statement) {
  return (await statement.all()).results;
}

async function readJson(request) {
  if (Number(request.headers.get('content-length')) > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');
  const body = await request.text();
  if (body.length > MAX_BODY_BYTES) throw new HttpError(413, 'Request body too large');
  if (!body) return {};
  try {
    const parsed = JSON.parse(body);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) return parsed;
  } catch {}
  throw new HttpError(400, 'Invalid JSON body');
}

// Written in the order the INSERT and UPDATE above bind them.
const EDITABLE_COLUMNS = 'name,real_name,game,faction,style,form,notes';
const editableValues = v => EDITABLE_COLUMNS.split(',').map(column => v[column]);

/**
 * D1 surfaces a constraint failure as a message, not a code. Both the unique index on
 * `name` and the one on `slug` land here; only `name` is reachable, because the slug is
 * derived by uniqueSlug() which has already looked.
 */
const isUniqueViolation = e => String(e.message).includes('UNIQUE');

/** Still used for values no user typed. Everything an admin types goes through players.js. */
function text(value, max) {
  return String(value ?? '').trim().slice(0, max);
}

function slugify(s) {
  return String(s).toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'player';
}

async function uniqueSlug(db, source) {
  const base = slugify(source);
  for (let n = 1, slug = base; ; slug = base + '-' + ++n) {
    if (!await db.prepare('select 1 from players where slug=?').bind(slug).first()) return slug;
  }
}

// --- Crypto (WebCrypto) ---

const encoder = new TextEncoder();

function secrets(env) {
  if (!env.ADMIN_KEY || env.ADMIN_KEY.length < 16 || !env.APP_SECRET || env.APP_SECRET.length < 32) {
    throw new HttpError(503, 'Server is not configured: set ADMIN_KEY (16+ chars) and APP_SECRET (32+ chars)');
  }
  return env;
}

function base64url(bytes) {
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function fromBase64url(s) {
  return Uint8Array.from(atob(s.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0));
}

async function sha256(value) {
  return new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(String(value))));
}

async function sha256Hex(value) {
  return [...await sha256(value)].map(b => b.toString(16).padStart(2, '0')).join('');
}

async function hmac(env, data) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secrets(env).APP_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(data)));
}

function safeEqual(a, b) {
  return a.byteLength === b.byteLength && crypto.subtle.timingSafeEqual(a, b);
}

async function isAdminKey(env, key) {
  // Hash both sides so the comparison is constant-time regardless of input length.
  return typeof key === 'string' && safeEqual(await sha256(key), await sha256(secrets(env).ADMIN_KEY));
}

async function signToken(env, payload) {
  const body = base64url(encoder.encode(JSON.stringify(payload)));
  return body + '.' + base64url(await hmac(env, body));
}

async function verifyToken(env, token) {
  const [body, signature] = String(token || '').split('.');
  if (!body || !signature) return null;
  try {
    if (!safeEqual(fromBase64url(signature), await hmac(env, body))) return null;
    const payload = JSON.parse(new TextDecoder().decode(fromBase64url(body)));
    return payload.exp > Date.now() ? payload : null;
  } catch (e) {
    if (e instanceof HttpError) throw e;
    return null;
  }
}
