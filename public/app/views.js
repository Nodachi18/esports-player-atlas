// HTML builders. Pure string functions: they read data and return markup, and never
// touch the document. Wiring lives in main.js.

import { CATEGORIES, LENSES, panelScores, hasScores, ratingCount, polygonPoints, vertex } from './scores.js';
import { pageOf } from './ranking.js';
import { FOOTER_LINKS, VISIBILITY } from './nav.js';
import { hrefFor } from './state.js';
import { CAPS, canDelete, deletePrompt, formMode, formValues } from './playerForm.js';

export const PER_PAGE = 5;

export const esc = value => String(value ?? '').replace(/[&<>"']/g, ch =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;
const plannedTag = '<span class="tag">planned</span>';

const inert = ' aria-disabled="true" tabindex="-1"';

// ---- shell ----

const PENTAGON = polygonPoints(44, [1, 1, 1, 1, 1], 50, 50);

export function header(items, activePage, state, session) {
  // A planned item gets no href at all: an anchor without one is not focusable and cannot
  // be opened in a new tab, which is exactly what "not built yet" should behave like.
  const links = items.map(item => {
    const planned = item.visibility === VISIBILITY.planned;
    return `
    <a class="navlink${planned ? ' planned' : ''}"
       ${planned ? inert : `href="${hrefFor(state, { page: item.key })}"`} data-page="${item.key}"
       ${item.key === activePage ? 'aria-current="page"' : ''}>
      ${esc(item.label)}${planned ? plannedTag : ''}
    </a>`;
  }).join('');

  return `
    <header class="bar">
      <a class="brand" href="${hrefFor(state, { page: 'players' })}" data-page="players">
        <svg viewBox="0 0 100 100" aria-hidden="true"><polygon points="${PENTAGON}"/></svg>
        <span class="wordmark">Player Atlas</span>
      </a>
      <div class="searchwrap">
        <input id="search" class="search" type="search" placeholder="Search player or game"
               value="${esc(state.query)}" aria-label="Search players">
      </div>
      <nav class="nav" aria-label="Main">${links}</nav>
      <div class="auth">${authControl(session)}</div>
    </header>`;
}

/**
 * The sign-in control is an anchor, and it has to be: the authorize step is a top-level
 * redirect to discord.com, and an XHR cannot navigate the window. A button wired to a
 * fetch would hit the 302 and follow it inside the request, never reaching the user.
 *
 * It says Discord rather than "Sign in", because a control that jumps to another company's
 * domain without naming it first is the shape a phish has. There is no Register beside it:
 * the first sign-in is the registration, and a second control starting the identical
 * redirect would be two names for one thing.
 */
export const DISCORD_START = '/api/auth/discord/start';

export const signInLink = (label, extraClass = '') =>
  `<a class="discord${extraClass ? ` ${extraClass}` : ''}" href="${DISCORD_START}">${esc(label)}</a>`;

/**
 * Signed in, the header shows a name and a way out. It deliberately shows no avatar: the
 * hash is stored and rendering it means an <img> pointing at cdn.discordapp.com, which is
 * a load from another origin that the privacy page says nothing here performs.
 *
 * global_name is Discord's display name and username is the handle. The display name is
 * what the person chose to be called, so it is preferred, with the handle behind it for
 * the accounts that have none.
 */
function authControl(session) {
  if (!session.accountsEnabled) {
    return `<span class="planned signin"${inert}>Sign in with Discord${plannedTag}</span>`;
  }
  const account = session.account;
  if (!account) return signInLink('Sign in with Discord', 'signin');
  // Not the footer's `.pill`, which carries an admin-coloured dot. An account is not an
  // admin key and the chrome may not suggest it is.
  return `<span class="signin">
      <span>${esc(account.global_name || account.username)}</span>
      <button class="mini" type="button" data-signout>Log out</button>
    </span>`;
}

/**
 * The two lines the OAuth return leg can carry back, read out of `?auth=` once and then
 * dropped — see main.js, where it never enters the state object, so the URL rewrite at the
 * end of render() takes it off the address bar and a reload does not re-show it.
 *
 * `busy` is its own line rather than a second spelling of `failed` because it is a
 * different situation with a different remedy: the limiter in front of the token exchange
 * counts successful sign-ins too, so a whole office behind one address can trip it while
 * doing nothing wrong. "Wait a minute" is something they can act on; "sign-in failed" is
 * not, and would send them to retry immediately, which is the one thing that keeps it shut.
 */
export const AUTH_NOTICES = Object.freeze({
  failed: 'Sign-in did not complete. Try again.',
  busy: 'Too many sign-ins from your network in the last minute. Try again shortly.',
});

// hasOwn, not a truthiness test: the key comes off the query string, so `?auth=constructor`
// would otherwise find Object.prototype and render a function body as a notice.
export const authNotice = kind =>
  (Object.hasOwn(AUTH_NOTICES, kind) ? `<p class="result bad" role="status">${esc(AUTH_NOTICES[kind])}</p>` : '');

export function footer(state, session) {
  const links = FOOTER_LINKS.map(link => `
    <a class="footlink" href="${hrefFor(state, { page: link.key })}" data-page="${link.key}"
       ${link.key === state.page ? 'aria-current="page"' : ''}>${esc(link.label)}</a>`).join('');
  return `<footer class="foot">${links}${adminDoor(session)}</footer>`;
}

/** Interim: the footer is the door to admin, the Admin page is the room. */
function adminDoor(session) {
  if (session.adminKey) {
    return `<span class="door">
      <span class="pill">Signed in as admin</span>
      <button class="mini" type="button" data-admin-out>Sign out</button>
    </span>`;
  }
  return `<form class="door" data-admin-form>
    ${session.adminError ? `<span class="err">${esc(session.adminError)}</span>` : ''}
    <input id="adminkey" type="password" placeholder="Admin key" autocomplete="off" aria-label="Admin key">
    <button class="mini" type="submit">Sign in as admin</button>
  </form>`;
}

// ---- players ----

export function playersPage(filtered, selected, state) {
  return `
    ${rankedStrip(filtered, selected, state)}
    ${selected ? playerDetail(selected, state) : emptyDetail(state.query)}`;
}

export function rankedStrip(filtered, selected, state) {
  if (!filtered.length) {
    return `<p class="empty">${state.query
      ? `No player matches “${esc(state.query)}”.`
      : 'No players yet.'}</p>`;
  }
  const { items, page, pages, from, to, total } = pageOf(filtered, state.strip, PER_PAGE);
  const cards = items.map(player => `
    <button class="card" type="button" data-slug="${esc(player.slug)}"
            ${selected && player.slug === selected.slug ? 'data-current="1" aria-current="true"' : ''}>
      <span class="pos">${player.rank == null ? '–' : player.rank}</span>
      <span class="who">${esc(player.name)}</span>
      <span class="score">${player.value == null ? '—' : Math.round(player.value)}</span>
      <span class="sub">${esc(player.game)} · ${esc(player.faction)}</span>
    </button>`).join('');

  return `
    <section class="strip" aria-label="Ranked players">
      <div class="striphead">
        <h2>${state.query ? 'Search result' : 'Ranked by combined score'}</h2>
        <span class="count">${from + 1}–${to} of ${total}</span>
        <button class="pager" type="button" data-strip="prev" aria-label="Previous players" ${page === 0 ? 'disabled' : ''}>←</button>
        <button class="pager" type="button" data-strip="next" aria-label="More players" ${page >= pages - 1 ? 'disabled' : ''}>→</button>
      </div>
      <div class="cards">${cards}</div>
    </section>`;
}

const emptyDetail = query => `<p class="empty">Nothing to show${query ? ' for this search' : ''}.</p>`;

export function playerDetail(player, state) {
  const scores = panelScores(player, state.lens);
  const rated = hasScores(scores);

  // Form is a real column now, written by an admin and never derived from ratings. It
  // read `No column for this yet` behind a planned tag until the admin form shipped; a
  // planned tag on something that exists is the one thing that word may not mean.
  const facts = [
    { key: 'Style', value: player.style },
    { key: 'Form', value: player.form },
    { key: 'Notes', value: player.notes },
  ].map(fact => `
    <div class="fact">
      <div class="k">${fact.key}</div>
      <div class="v">${esc(fact.value || '—')}</div>
    </div>`).join('');

  return `
    <div class="profile">
      <figure class="portrait">
        <div class="frame" aria-hidden="true">${esc((player.name || '?').trim()[0] || '?')}</div>
        <figcaption><span>${esc(player.faction)}</span><small>Photo planned</small></figcaption>
      </figure>

      <div class="identity">
        <h1>${esc(player.name)}</h1>
        <p class="real">${esc([player.real_name, player.game].filter(Boolean).join(' · '))}</p>
        ${facts}
        <div id="history" class="history"></div>
      </div>

      ${ratingsPanel(player, scores, rated, state)}
    </div>`;
}

function ratingsPanel(player, scores, rated, state) {
  const lensButtons = LENSES.map(lens => `
    <button type="button" data-lens="${lens}" aria-pressed="${lens === state.lens}"
            ${lens === state.lens ? 'data-on="1"' : ''}>${lensLabel(lens)}</button>`).join('');

  return `
    <section class="ratings" aria-label="Ratings">
      <div class="panelhead">
        <h2>Ratings</h2>
        <span class="count">${plural(ratingCount(player, state.lens), 'rating')}</span>
      </div>
      <div class="lens" role="group" aria-label="Panel">${lensButtons}</div>
      ${radar(scores, rated)}
      ${rated ? '' : '<p class="empty">No ratings in this panel yet.</p>'}
      <a class="ratecta" href="${hrefFor(state, { page: 'rate', player: player.slug })}" data-page="rate" data-slug="${esc(player.slug)}">Rate ${esc(player.name)}</a>
    </section>`;
}

export const lensLabel = lens =>
  ({ combined: 'Combined', community: 'Community', professional: 'Professionals' }[lens]);

const CX = 250, CY = 220, R = 120, LABEL_R = 158;

function radar(scores, rated) {
  const rings = [25, 50, 75, 100]
    .map(pct => `<polygon points="${polygonPoints(R, CATEGORIES.map(() => pct / 100), CX, CY)}"/>`)
    .join('');

  const spokes = CATEGORIES.map((_, i) => {
    const [x, y] = vertex(i, R, 1, CX, CY);
    return `<line x1="${CX}" y1="${CY}" x2="${x.toFixed(1)}" y2="${y.toFixed(1)}"/>`;
  }).join('');

  const shape = rated ? `
    <polygon class="plot" points="${polygonPoints(R, CATEGORIES.map(c => (scores[c] ?? 0) / 100), CX, CY)}"/>
    ${CATEGORIES.map((c, i) => {
      if (scores[c] == null) return '';
      const [x, y] = vertex(i, R, scores[c] / 100, CX, CY);
      return `<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="4"/>`;
    }).join('')}` : '';

  const labels = CATEGORIES.map((c, i) => {
    const [x, y] = vertex(i, LABEL_R, 1, CX, CY);
    return `<text class="cat" x="${x.toFixed(0)}" y="${y.toFixed(0)}">${c.toUpperCase()}</text>
            <text class="val" x="${x.toFixed(0)}" y="${(y + 22).toFixed(0)}">${scores[c] == null ? '—' : Math.round(scores[c])}</text>`;
  }).join('');

  return `<svg class="radar" viewBox="0 0 500 440" role="img" aria-label="Ratings radar">
    <g class="grid">${rings}${spokes}</g>${shape}${labels}
  </svg>`;
}

export function historyTable(rows) {
  if (!rows.length) return '';
  const head = `<tr><th>Date</th><th>Panel</th><th>n</th>${CATEGORIES.map(c => `<th>${c}</th>`).join('')}</tr>`;
  const body = rows.map(row =>
    `<tr><td>${esc(row.day)}</td><td>${esc(row.panel)}</td><td>${row.n}</td>${CATEGORIES.map(c => `<td>${row[c] ?? '—'}</td>`).join('')}</tr>`).join('');
  return `<details class="histbox"><summary>Rating history</summary><table>${head}${body}</table></details>`;
}

// ---- leaderboard ----

const CATEGORY_OPTIONS = [['', 'Overall'], ...CATEGORIES.map(c => [c, c])];

export function leaderboardPage(rows, state) {
  const option = (value, label, current) =>
    `<option value="${value}"${value === current ? ' selected' : ''}>${esc(label)}</option>`;

  const list = rows.map((player, i) => `
    <button class="lbrow" type="button" data-slug="${esc(player.slug)}" data-page="players">
      <span class="pos">${i + 1}</span>
      <span class="who">${esc(player.name)}<small>${esc(player.game)} · ${esc(player.faction)}</small></span>
      <span class="score">${Math.round(player.value)}</span>
    </button>`).join('');

  return `
    <section aria-label="Leaderboard">
      <div class="controls">
        <label for="metric">Panel</label>
        <select class="sel" id="metric" data-control="metric">
          ${LENSES.map(m => option(m, lensLabel(m), state.metric)).join('')}
        </select>
        <label for="category">Category</label>
        <select class="sel" id="category" data-control="category">
          ${CATEGORY_OPTIONS.map(([v, l]) => option(v, l, state.category)).join('')}
        </select>
        <span class="count">${plural(rows.length, 'player')} ranked</span>
      </div>
      ${list || '<p class="empty">No scored players yet.</p>'}
      <p class="note">Players with no ratings are not ranked here, so they do not appear.</p>
      <div class="planned block"${inert}>
        <b>Compare${plannedTag}</b>
        <span>Up to four players side by side.</span>
      </div>
    </section>`;
}

// ---- rate ----

/**
 * Signed out with accounts on, the form is rendered disabled behind a sign-in panel rather
 * than replaced by one. What is being asked for is five sliders and a panel choice, and a
 * visitor cannot weigh signing in against that without seeing it. Replacing the form with
 * "sign in to rate" asks them to agree to something they have not been shown.
 *
 * The disabled attributes are a courtesy, not the gate. /api/ratings answers 401 without a
 * session whatever the DOM says, which is the only reason it is safe to render the form at
 * all — a disabled input is a suggestion to anyone with a console open.
 */
export function ratePage(player, result, session = {}) {
  if (!player) {
    return `<div class="block"><b>No player selected</b><span>Pick someone on Players first — there is nothing to rate.</span></div>`;
  }

  const locked = Boolean(session.accountsEnabled) && !session.account;
  const off = locked ? ' disabled' : '';

  const sliders = CATEGORIES.map(category => `
    <div class="slider">
      <label for="r-${category}">${category}<output id="out-${category}" for="r-${category}">75</output></label>
      <input type="range" min="0" max="100" value="75" id="r-${category}" data-slider="${category}"${off}>
    </div>`).join('');

  const gate = locked ? `
      <div class="block">
        <b>Sign in with Discord to rate</b>
        <span>A rating is attached to your account, so the form below is shown but inert until you sign in.</span>
        ${signInLink('Sign in with Discord')}
      </div>` : '';

  return `
    <section class="rate" aria-label="Submit a rating">
      <h1>Rate ${esc(player.name)}</h1>
      <p class="real">${esc([player.real_name, player.game].filter(Boolean).join(' · '))}</p>
      ${gate}
      <form data-rate-form${locked ? ' aria-disabled="true"' : ''}>
        <div class="controls">
          <label for="ratepanel">Panel</label>
          <select class="sel" id="ratepanel"${off}>
            <option value="community">Community</option>
            <option value="professional">Professional</option>
          </select>
        </div>
        ${sliders}
        <button class="btn" type="submit"${off}>Submit rating</button>
      </form>
      ${result ? `<p class="result ${result.tone}">${esc(result.text)}</p>` : ''}
    </section>`;
}

// ---- admin ----

export function adminPage(ctx) {
  const { stats, ratings, roster, filtered, selected, draft, games, guard, query, saving } = ctx;
  if (!stats) return `<div class="block"><b>Admin</b><span>Loading…</span></div>`;

  const create = formMode(selected) === 'create';
  const values = formValues(selected, draft);

  return `
    <section class="admin" aria-label="Admin">
      <div class="adminwork">
        ${rosterRail(roster, filtered, selected, create, query)}
        <div class="work">
          ${formHead(selected, create)}
          ${playerForm(values, games, create, selected, saving)}
          ${draft && draft.message ? `<p class="result ${draft.message.tone}" role="status">${esc(draft.message.text)}</p>` : ''}
          ${create ? '' : ratingDisclosure(selected)}
        </div>
      </div>
      ${totalsLine(stats.totals || {})}
      ${globalRatings(ratings)}
      ${guard ? deleteGuard(guard) : ''}
    </section>`;
}

/**
 * The result list of the header search, not a picker of its own — there is one Selection
 * and one search box on this site, and a second one here would be a second answer to
 * "which player am I looking at".
 */
function rosterRail(roster, filtered, selected, create, query) {
  const rows = filtered.map(player => `
    <li><button type="button" data-slug="${esc(player.slug)}"
                ${!create && selected && player.slug === selected.slug ? 'aria-current="true"' : ''}>
      <span class="n">${esc(player.name)}</span>
      <span class="r${player.ratings ? '' : ' zero'}">${player.ratings || '–'}</span>
      <span class="s">${esc([player.real_name, player.faction].filter(Boolean).join(' · '))}</span>
    </button></li>`).join('');

  return `
    <aside class="rail">
      <div class="railhead">
        <h2>Roster</h2>
        <span class="count">${query.trim()
          ? `${filtered.length} of ${roster.length} matching “${esc(query.trim())}”`
          : `${filtered.length} of ${roster.length}`}</span>
      </div>
      <button class="railnew" type="button" data-player-new ${create ? 'data-on' : ''}>+ New player</button>
      <p class="railhint">Filtered by the search in the header. The figure is ratings cast.</p>
      ${rows
        ? `<ul class="raillist">${rows}</ul>`
        : `<p class="railempty">No player matches that search. Clearing it brings all
             ${roster.length} back.</p>`}
    </aside>`;
}

/**
 * Mode is shown three ways at once — a tag, the handle set large, and the slug — because
 * it is derived from the Selection rather than picked, and state nobody can see reads as
 * a bug. The slug appears only once it exists: it is never previewed or guessed at.
 */
function formHead(selected, create) {
  if (create) {
    return `
      <div class="mode">
        <span class="modetag create">New player</span>
        <h1>New player</h1>
      </div>
      <span class="hint">The slug is built from the handle when the player is created, and is shown then.</span>`;
  }
  return `
    <div class="mode">
      <span class="modetag edit">Editing</span>
      <h1>${esc(selected.name)}</h1>
      <span class="slugchip">/<b>${esc(selected.slug)}</b></span>
    </div>
    <span class="hint">The slug is this player's public address and is in every link ever shared.
      It cannot change.</span>`;
}

const fieldInput = (key, label, value, o = {}) => `
  <label class="f${o.wide ? ' wide' : ''}">
    <span class="fl">${esc(label)}</span>
    ${o.area
      ? `<textarea rows="${o.rows || 3}" maxlength="${CAPS[key]}" data-player-field="${key}"
                   placeholder="${esc(o.ph || '')}">${esc(value)}</textarea>`
      : `<input type="text" maxlength="${CAPS[key]}" data-player-field="${key}"
                value="${esc(value)}" placeholder="${esc(o.ph || '')}"
                ${o.list ? `list="${o.list}"` : ''}>`}
    ${o.hint ? `<span class="hint">${esc(o.hint)}</span>` : ''}
  </label>`;

function playerForm(values, games, create, selected, saving) {
  const datalist = `<datalist id="games">${(games || [])
    .map(row => `<option value="${esc(row.game)}"></option>`).join('')}</datalist>`;

  return `
    <form data-player-form>
      ${datalist}
      <fieldset class="set">
        <legend>Identity</legend>
        <div class="grid2">
          ${fieldInput('name', 'Handle', values.name, { ph: 'BoxeR' })}
          ${fieldInput('real_name', 'Real name', values.real_name, { ph: 'Lim Yo Hwan' })}
          ${fieldInput('game', 'Game', values.game, {
            ph: 'StarCraft: Brood War', list: 'games',
            hint: 'Pick an existing game or type a new one. Spelling it differently splits the roster.',
          })}
          ${fieldInput('faction', 'Faction', values.faction, { ph: 'Terran' })}
        </div>
      </fieldset>
      <fieldset class="set">
        <legend>Editorial</legend>
        <div class="grid2">
          ${fieldInput('style', 'Style', values.style, { ph: 'How they play', area: true, rows: 2, wide: true })}
          ${fieldInput('form', 'Form', values.form, {
            ph: 'Top ~50, inconsistent', wide: true,
            hint: 'Your judgement of where they stand. Never calculated from ratings.',
          })}
          ${fieldInput('notes', 'Notes', values.notes, { ph: 'Anything else worth recording', area: true, wide: true })}
          ${create ? '' : readCell('Ratings', selected.ratings || 0)}
        </div>
      </fieldset>
      <div class="actions">
        <button class="btn" type="submit" ${saving ? 'disabled' : ''}>
          ${create ? 'Create player' : 'Save changes'}
        </button>
        ${create
          ? '<span class="hint">Creating opens the new player for editing.</span>'
          : `<button class="btn danger" type="button" data-player-delete>Delete ${esc(selected.name)}</button>`}
      </div>
    </form>`;
}

/** Not a field: a read-only cell, so the row of inputs does not end ragged. */
const readCell = (label, value) => `
  <div class="f read">
    <span class="fl">${esc(label)}</span>
    <p><b>${value}</b> cast about this player, flagged ones included.</p>
  </div>`;

/**
 * The count comes from /api/players. The rows behind it have no endpoint of their own
 * yet, so the disclosure links into the global table rather than inventing one.
 */
const ratingDisclosure = player => `
  <details class="sub">
    <summary>${plural(player.ratings || 0, 'rating')} about ${esc(player.name)}</summary>
    <p class="hint">The rows behind this number have no endpoint of their own yet.
      <a class="tolink" href="#allratings">Every rating on the site</a> is in the table at the
      foot of this page.</p>
  </details>`;

/**
 * Unchanged, and still at the foot of the page behind its own button: it is how an admin
 * finds a rating to flag, and nothing else offers that yet. Where it belongs once rating
 * moderation exists is a question this page does not answer.
 */
const globalRatings = ratings => (!ratings
  ? '<div id="allratings"><button class="btn ghost" type="button" data-admin-ratings>Load ratings</button></div>'
  : `<table class="admintable" id="allratings">
      <tr><th>Player</th><th>Panel</th><th>Date</th><th>Scores</th><th>Flagged</th></tr>
      ${ratings.map(row => `<tr>
        <td>${esc(row.name)}</td><td>${esc(row.panel)}</td><td>${esc(row.created_at)}</td>
        <td>${CATEGORIES.map(c => row[c]).join(' / ')}</td>
        <td>${row.flagged ? 'yes' : 'no'}</td>
      </tr>`).join('')}
    </table>`);

/**
 * Site-wide totals, at the foot. They were three cards above the form, which made the
 * first thing read the least relevant thing on screen once the page became about one
 * player.
 */
const totalsLine = totals => `
  <div class="totals">
    <span><b>${totals.players || 0}</b> players</span>
    <span><b>${totals.ratings || 0}</b> ratings</span>
    <span><b>${totals.flagged || 0}</b> flagged</span>
  </div>`;

/**
 * Decision 8. A modal, because the non-modal versions can be scrolled away from and leave
 * a half-typed confirmation sitting in the page, which looks like progress.
 *
 * Keep holds the focus, so a reflexive Enter cancels, and Escape cancels too — cancelling
 * is the safe direction.
 */
function deleteGuard({ player, typed }) {
  const prompt = deletePrompt(player);
  return `
    <dialog class="guard" aria-label="${esc(prompt.heading)}">
      <div class="guardbody">
        <h2>${esc(prompt.heading)}</h2>
        <p>${esc(prompt.lead)}</p>
        <p>Nothing on this site restores them. There is no undo.</p>
        <label class="f">
          <span class="fl">Type ${esc(player.slug)} to confirm</span>
          <input type="text" id="confirmslug" data-confirm-slug value="${esc(typed)}"
                 placeholder="${esc(player.slug)}" autocomplete="off" spellcheck="false"
                 aria-describedby="confirmwhy">
        </label>
        <span class="hint" id="confirmwhy">Typing the slug is the only confirmation. A dialog you can
          dismiss with a reflexive Enter is not a guard.</span>
        <div class="guardacts">
          <button class="btn ghost" type="button" data-guard-cancel autofocus>${esc(prompt.cancel)}</button>
          <button class="btn danger" type="button" data-guard-confirm
                  ${canDelete(typed, player.slug) ? '' : 'disabled'}>${esc(prompt.confirm)}</button>
        </div>
      </div>
    </dialog>`;
}

// ---- legal notice ----

/**
 * The operator's public contact card. Linked and never mirrored: nothing from that page —
 * no name, no address, no phone number — is reproduced here, so this repo holds no second,
 * stale copy of someone's personal data. `nofollow` because a municipal directory did not
 * ask to be associated with a ratings prototype. See
 * `.scratch/content-pages/02-legal-notice-private-site.md`.
 */
export const CONTACT_CARD = 'https://www.falkenstein-harz.de/m/verzeichnis/visitenkarte.php?mandat=21964';

/**
 * Both words in the heading on purpose. "Legal notice" is the label everywhere else,
 * because the UI is English (navigation-overhaul decision 13) — but "Impressum" is the one
 * word a German reader scans for, and the one they search the page for when they think
 * something is missing. This closes that decision's open check.
 */
export const legalPage = () => `
  <section class="prose" aria-label="Legal notice">
    <h1>Legal notice <span class="alt" lang="de">Impressum</span></h1>

    <h2>A private site, with no provider information</h2>
    <p>
      Esports Player Atlas is a private, non-commercial hobby project. Nothing is sold here,
      nothing is advertised, and no business sits behind it. The duty to publish provider
      information under <span lang="de">§ 5 DDG</span>
      (<span lang="de">Digitale-Dienste-Gesetz</span>) applies to digital services offered
      on a commercial basis, so it does not attach to this one, and no name or postal
      address is published.
    </p>

    <h2>Contact</h2>
    <p>
      The operator can be contacted through this public contact card:
    </p>
    <p>
      <a class="extlink" href="${CONTACT_CARD}" target="_blank" rel="nofollow noopener noreferrer">
        Contact card on falkenstein-harz.de <span aria-hidden="true">↗</span>
      </a>
    </p>
    <p class="note">
      An external page, operated by someone else. This site has no control over what it
      shows.
    </p>

    <h2>About the ratings</h2>
    <p>
      Every rating on this site is an opinion submitted by a visitor about a named real
      person. Ratings are not checked, not verified, and not statements of fact.
      The combined score weights the professional panel above the community panel — a
      product choice, not a measurement of anybody.
    </p>
    <p>
      This is a prototype running on disposable data. If you appear here and would rather
      not, say so through the contact card above and the entry will be removed.
    </p>
  </section>`;

/**
 * Disclosed because the visitor's browser necessarily reaches it: Cloudflare hosts the
 * site, so it sees every request. It is the only one — fonts are served from here, and
 * nothing else on the page is remote. nofollow, like the contact card.
 */
export const CLOUDFLARE_PRIVACY = 'https://www.cloudflare.com/privacypolicy/';

/**
 * The second one, and for the same reason: signing in is a round trip through Discord, so
 * a visitor who signs in reaches discord.com and Discord sees them. Nothing is loaded from
 * there — this is a link a reader follows, not a resource the page fetches — and the avatar
 * is deliberately never rendered, which is what keeps that true.
 */
export const DISCORD_PRIVACY = 'https://discord.com/privacy';

// ---- help ----

/**
 * Four questions a reader actually asks, answered in their terms. No formulas, no
 * thresholds, no mention of what is stored where — the mechanisms are in
 * `.scratch/content-pages/01-help-and-legal-notice.md` and the code, and a reader wanting
 * to know what the scores mean is not helped by either.
 *
 * The one number that survives is the weighting, as a word, because "counts for twice as
 * much" is the answer to the question rather than a detail of it.
 */
export const helpPage = state => `
  <section class="prose help" aria-label="Help">
    <h1>Help</h1>

    <div class="qa">
      <h2>Why are there two panels, and why does Combined count professionals double?</h2>
      <p>
        Anyone with a Discord account can rate on the community panel. The professional
        panel is for invited players rating their own field, and a rating there counts for
        twice as much, so the Combined score leans towards them.
      </p>
      <p>
        That weighting is a choice somebody made, not a measurement of anybody. And a player
        no professional has rated yet simply shows their community score as Combined.
      </p>
    </div>

    <div class="qa">
      <h2>What does a flagged rating mean?</h2>
      <p>
        That it is worth a second look, and nothing more. A flag is never proof that anyone
        cheated.
      </p>
      <p>
        A rating is flagged when it sits far outside what everyone else said about the same
        player, and an admin can flag or clear one by hand. Flagged ratings are left out of
        the scores shown on the site.
      </p>
    </div>

    <div class="qa">
      <h2>Why can I only rate a player once per panel?</h2>
      <p>
        So that one person cannot move a player's score by rating them over and over.
      </p>
      <p>
        It also means a rating cannot be taken back or changed afterwards — a second one is
        refused rather than replacing the first. Worth being sure before you submit.
      </p>
    </div>

    <div class="qa">
      <h2>How does someone become a professional?</h2>
      <p>
        At the moment, nobody can. The professional panel is invite-only, and there is
        currently no way to ask for an invite or to use one.
      </p>
      <p>
        Signing in with Discord is not that route: it is what lets you rate at all, and it
        makes you a community rater. Opening the professional panel up is a separate thing,
        and nobody has built it.
      </p>
    </div>

    <p class="note">
      None of the numbers here are measurements. They are opinions submitted by visitors
      about named real people — the
      <a class="inlink" href="${hrefFor(state, { page: 'legal' })}" data-page="legal">legal notice</a>
      covers what that means for anyone rated on this site, and how to have an entry removed.
    </p>
  </section>`;

// ---- privacy ----

/**
 * Every claim here is checkable against `migrations/0001_init.sql`,
 * `migrations/0007_accounts.sql`, `src/auth.js`, `src/worker.js` and `public/index.html`.
 * If you change what is stored, this page is part of the change — see
 * `.scratch/content-pages/03-privacy-statement.md`.
 *
 * The § 5 DDG exemption on the legal notice does NOT extend to this page: that provision
 * scopes on commercial purpose, the GDPR does not.
 *
 * The cookie sentence names one cookie and asks for no consent, which is the honest answer
 * rather than a shortcut: § 25(2) TDDDG exempts storage that is strictly necessary for a
 * service the visitor asked for, and a session cookie that only keeps them signed in is
 * that. A banner on a site with no analytics would be theatre. The provision is not named
 * on the page — the reader is owed the fact, not the citation, and a test keeps "DDG" off
 * this page so the legal notice's § 5 reasoning cannot be read as covering it.
 *
 * Two claims here depend on code outside this file staying the way it is: that the browser
 * holds no rating identity of its own (nothing may mint `localStorage.voterAtlas` again —
 * `api.js`), and that nothing renders the stored avatar (`cdn.discordapp.com` would make
 * the no-third-party-origin claim false — a test asserts it against rendered output).
 */
export const privacyPage = state => `
  <section class="prose" aria-label="Privacy">
    <h1>Privacy <span class="alt" lang="de">Datenschutz</span></h1>

    <h2>If you are rated on this site</h2>
    <p>
      Player entries are created by an administrator, from public competitive records. An
      entry can hold a handle, a real name, a game, a faction and free-text notes. You
      were not asked for your consent.
    </p>
    <p>
      Ask through the contact card below and the entry will be deleted, along with every
      rating attached to it.
    </p>

    <h2>If you submit a rating</h2>
    <p>
      Rating means signing in with Discord first. What is written with the rating is: which
      player, which panel, five scores from 0 to 100, the time, a <em>voter hash</em>, and
      which account cast it. No name, no email address, no IP address.
    </p>
    <p>
      The voter hash is a one-way hash of your Discord account id. Nobody who reads it can
      work out whose it is. This site can: it holds the account the hash was made from, so
      every rating you cast is attached to your account, and through it to every other
      rating you have cast.
    </p>

    <h2>Cookies, and what else stays in your browser</h2>
    <p>
      One cookie, set when you sign in. It is what keeps you signed in, it is readable only
      by this site, and it lasts 30 days or until you sign out. There is no banner asking
      you to accept it: a cookie that does nothing but keep you signed in needs no
      permission, and there is nothing else here to permit — no analytics, no advertising,
      no tracking pixels.
    </p>
    <p>
      Two further values, in your browser's own storage, neither of which leaves it except
      as described above: a professional access token if you have one (30 days), and an
      administrator token if you are one (until the tab closes).
    </p>

    <h2>Cloudflare, as the host</h2>
    <p>
      This site is hosted on Cloudflare, so every request you make reaches Cloudflare
      before it reaches anything else. Cloudflare therefore handles connection data — your
      IP address and your browser's user agent — and retains request metadata in its
      logging for a period it sets. It does this as the hosting provider, on the
      operator's behalf.
    </p>
    <p>
      <a class="extlink" href="${CLOUDFLARE_PRIVACY}" target="_blank" rel="nofollow noopener noreferrer">
        Cloudflare's privacy policy <span aria-hidden="true">↗</span>
      </a>
    </p>

    <h2>Signing in with Discord</h2>
    <p>
      Signing in sends you to Discord and back, so Discord sees that you are signing in
      here. What this site is told is your Discord account id, your username, your display
      name, and which profile picture you have set. Never your email address. The picture
      is stored but never shown here, and nothing on this site loads anything from Discord.
    </p>
    <p>
      From that point a rating is no longer attached to a throwaway browser token: it is
      attached to <em>you</em>. Every rating you cast is attributable to one identifiable
      person and linkable across every player you have rated, for as long as the account
      exists.
    </p>
    <p>
      Every rating cast before accounts existed has been deleted — scores and all, with
      nothing kept.
    </p>
    <p>
      <a class="extlink" href="${DISCORD_PRIVACY}" target="_blank" rel="nofollow noopener noreferrer">
        Discord's privacy policy <span aria-hidden="true">↗</span>
      </a>
    </p>

    <h2>Your rights, and how to use them</h2>
    <p>
      Access, correction, deletion, objection, and a complaint to a supervisory authority.
      One route to all of them:
    </p>
    <p>
      <a class="extlink" href="${CONTACT_CARD}" target="_blank" rel="nofollow noopener noreferrer">
        Contact card on falkenstein-harz.de <span aria-hidden="true">↗</span>
      </a>
    </p>
    <p class="note">
      Who is responsible, and why no postal address is published, is on the
      <a class="inlink" href="${hrefFor(state, { page: 'legal' })}" data-page="legal">legal notice</a>.
    </p>
  </section>`;

// ---- terms of service ----

/**
 * House rules, not a contract. No acceptance clause, no liability limitation, no governing
 * law, no "we may update these terms at any time" — that boilerplate is written for a
 * commercial service with something to enforce, and this is a private hobby project where
 * no money changes hands. Same reasoning that threw the German Haftung blocks out of the
 * legal notice. See `.scratch/content-pages/05-terms-of-service.md`.
 *
 * Ten rules and nothing else. What is deliberately absent: any strike rule, any ban
 * duration or appeal process, and anything about ratings cast before accounts existed.
 * None of it is decided, and a terms page that invents policy is worse than a short one.
 *
 * No mechanism, carried from the Help page's rule: no voter hash, no snowflake, no browser
 * storage, no table names, no thresholds. Rule 4 says the professional panel counts for
 * more; it does not say how much, because the reader asking what the rules are is not
 * asking for the formula.
 *
 * Heading is "Terms of service" alone. The bilingual treatment on the legal notice and the
 * privacy page is for words a German reader actively searches the page for — "Impressum"
 * when they believe provider information is missing, "Datenschutz" when they want their
 * data rights. Nobody scans a hobby site for "Nutzungsbedingungen", and "AGB" names the
 * contract this page is not.
 *
 * ---
 *
 * THE ACCOUNT RULES WERE PUBLISHED AHEAD OF THE CODE, ON PURPOSE. "Your account" stated
 * rules for a sign-in that did not exist yet, in the present tense, because a rule has to
 * be published before the conduct it governs — not marked `planned` and not hedged.
 *
 * Sign-in has landed, and the four claims were re-read against it on 30 October 2026.
 * Where they stand now:
 *
 *   1. The OAuth scope. The page says "never your email address", and `SCOPE` in
 *      src/auth.js is `identify`. A test in test/frontend.test.js fails if any scope in
 *      src/ asks for one, and it stays.
 *   2. What is stored about an account. `migrations/0007_accounts.sql` holds the Discord
 *      account id, the username, the global name, the avatar, a role and timestamps — so
 *      the page names the display name as well, and says the picture is stored and never
 *      shown, because it is: nothing renders it, and an `<img>` at cdn.discordapp.com
 *      would break the no-third-party-origin claim on the privacy page. Anything stored
 *      beyond this list is a thing this page has not told the reader.
 *   3. What blocking does. STILL A PROMISE, NOT A DESCRIPTION. Nothing in this repository
 *      can block an account; ../moderation/03 owns it. When it lands it must exclude the
 *      ratings from the published scores rather than delete the rows — content-pages/05
 *      decision 2 — and anything that leaves them published makes this page false.
 *   4. One account per person. Stated, and unenforceable by design: a second Discord
 *      account costs an email address and a few minutes. It is a rule a block can point
 *      at, not a mechanism. If it stops being the rule, it stops being on this page.
 *
 * The tripwire that forced this re-read has done its job and is deleted. Its successor
 * watches src/ for blocking, because 3 is the claim still ahead of the code.
 */
export const TERMS_UPDATED = '30 October 2026';

export const termsPage = state => `
  <section class="prose" aria-label="Terms of service">
    <h1>Terms of service</h1>

    <h2>What this site is</h2>
    <p>
      Esports Player Atlas is a private, non-commercial hobby prototype. It may change,
      break or disappear. Nothing here is guaranteed to be kept, and nothing on it is
      offered as a service you can rely on.
    </p>

    <h2>What a rating is</h2>
    <p>
      Every rating is an opinion submitted by a visitor about a named real person. Ratings
      are not checked, not verified, and not statements of fact. The combined score weights
      the professional panel above the community panel — a product choice, not a
      measurement of anybody.
    </p>

    <h2>Rating</h2>
    <p>
      You may rate each player once per panel.
    </p>
    <p>
      An administrator can flag a rating. A flagged rating stops counting toward the
      published scores.
    </p>

    <h2>Your account</h2>
    <p>
      Rating means signing in with Discord. This site holds your Discord account id, the
      username and display name Discord shows for you, and which profile picture you have
      set. Never your email address. Your picture is kept but never shown here.
    </p>
    <p>
      One account per person. Rating from more than one is grounds for blocking.
    </p>
    <p>
      A blocked account cannot sign in, and the ratings it has cast are removed from the
      site.
    </p>

    <h2>If you appear on this site</h2>
    <p>
      You were not asked. Ask to be removed and you will be, along with every rating
      attached to you:
    </p>
    <p>
      <a class="extlink" href="${CONTACT_CARD}" target="_blank" rel="nofollow noopener noreferrer">
        Contact card on falkenstein-harz.de <span aria-hidden="true">↗</span>
      </a>
    </p>
    <p class="note">
      Who runs this site is on the
      <a class="inlink" href="${hrefFor(state, { page: 'legal' })}" data-page="legal">legal notice</a>;
      what it does with data is on the
      <a class="inlink" href="${hrefFor(state, { page: 'privacy' })}" data-page="privacy">privacy statement</a>.
    </p>

    <p class="note">Last updated ${TERMS_UPDATED}.</p>
  </section>`;

export const plannedPage = (title, detail) =>
  `<div class="block"><b>${esc(title)}${plannedTag}</b><span>${esc(detail)}</span></div>`;
