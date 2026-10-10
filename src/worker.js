// Esports Player Atlas API on Cloudflare Workers + D1.
// Static files in public/ are served by Workers Assets; this Worker only sees /api/* and unmatched paths.

import { CATEGORIES, summarize, outlierIds, combine, categoryScores, overall } from './stats.js';

const VERSION = '4.0';
const MAX_BODY_BYTES = 16 * 1024;
const PRO_TOKEN_TTL = 30 * 864e5, ADMIN_TOKEN_TTL = 8 * 36e5;
const PLAYER_COLUMNS = 'id,slug,name,real_name,game,faction,style,notes,created_at';
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
    let sql = 'select id,slug,name,real_name,game,faction,style,notes from players where active=1';
    if (search) {
      sql += ' and (name like ?1 or real_name like ?1 or game like ?1)';
      args.push('%' + search + '%');
    }
    if (game) {
      sql += ` and game=?${args.length + 1}`;
      args.push(game);
    }
    return json(200, await all(db.prepare(sql + ' order by name').bind(...args)));
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
    if (!await isAdminKey(env, key)) return json(401, { error: 'Invalid admin key' });
    return json(200, { token: await signToken(env, { role: 'admin', exp: Date.now() + ADMIN_TOKEN_TTL }) });
  }

  if (path.startsWith('/api/admin/')) {
    const token = await verifyToken(env, (request.headers.get('authorization') || '').replace(/^Bearer /i, ''));
    if (token?.role !== 'admin') return json(403, { error: 'Admin authentication required' });
    return adminRoute(request, env, method, path);
  }

  return json(404, { error: 'Not found' });
}

async function adminRoute(request, env, method, path) {
  const db = env.DB;

  if (method === 'GET' && path === '/api/admin/stats') {
    const totals = await db.prepare(
      `select count(*) ratings,sum(panel='community') community,sum(panel='professional') professional,sum(flagged) flagged,count(distinct player_id) players from ratings`,
    ).first();
    const daily = await all(db.prepare(
      'select substr(created_at,1,10) day,count(*) ratings,sum(flagged) flagged from ratings group by day order by day desc limit 30',
    ));
    return json(200, { totals, daily });
  }

  if (method === 'GET' && path === '/api/admin/ratings') {
    return json(200, await all(db.prepare(
      `select r.id,p.name,r.panel,r.created_at,${CATEGORIES.map(c => 'r.' + c).join(',')},r.flagged,r.reviewed from ratings r join players p on p.id=r.player_id order by r.id desc limit 1000`,
    )));
  }

  if (method === 'POST' && path === '/api/admin/players') {
    const b = await readJson(request);
    const name = text(b.name, 80), game = text(b.game, 80);
    if (!name || !game) return json(400, { error: 'name and game are required' });
    const slug = await uniqueSlug(db, b.slug || name);
    await db.prepare('insert into players(slug,name,real_name,game,faction,style,notes) values(?,?,?,?,?,?,?)')
      .bind(slug, name, text(b.real_name, 120), game, text(b.faction, 80), text(b.style, 200), text(b.notes, 1000)).run();
    return json(201, (await profiles(db, [slug]))[0]);
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
