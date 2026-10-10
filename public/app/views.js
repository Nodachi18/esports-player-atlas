// HTML builders. Pure string functions: they read data and return markup, and never
// touch the document. Wiring lives in main.js.

import { CATEGORIES, LENSES, panelScores, hasScores, ratingCount, polygonPoints, vertex } from './scores.js';
import { pageOf } from './ranking.js';
import { FOOTER_LINKS, VISIBILITY } from './nav.js';
import { hrefFor } from './state.js';

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

function authControl(session) {
  if (!session.accountsEnabled) {
    return `<span class="planned signin"${inert}>Sign in with Discord${plannedTag}</span>`;
  }
  return `<button class="discord" type="button" data-signin>Sign in with Discord</button>`;
}

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

  const facts = [
    { key: 'Style', value: player.style, missing: false },
    { key: 'Form', value: 'No column for this yet', missing: true },
    { key: 'Notes', value: player.notes, missing: false },
  ].map(fact => `
    <div class="fact${fact.missing ? ' gap' : ''}">
      <div class="k">${fact.key}${fact.missing ? plannedTag : ''}</div>
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

export function ratePage(player, result) {
  if (!player) {
    return `<div class="block"><b>No player selected</b><span>Pick someone on Players first — there is nothing to rate.</span></div>`;
  }

  const sliders = CATEGORIES.map(category => `
    <div class="slider">
      <label for="r-${category}">${category}<output id="out-${category}" for="r-${category}">75</output></label>
      <input type="range" min="0" max="100" value="75" id="r-${category}" data-slider="${category}">
    </div>`).join('');

  return `
    <section class="rate" aria-label="Submit a rating">
      <h1>Rate ${esc(player.name)}</h1>
      <p class="real">${esc([player.real_name, player.game].filter(Boolean).join(' · '))}</p>
      <form data-rate-form>
        <div class="controls">
          <label for="ratepanel">Panel</label>
          <select class="sel" id="ratepanel">
            <option value="community">Community</option>
            <option value="professional">Professional</option>
          </select>
        </div>
        ${sliders}
        <button class="btn" type="submit">Submit rating</button>
      </form>
      ${result ? `<p class="result ${result.tone}">${esc(result.text)}</p>` : ''}
    </section>`;
}

// ---- admin ----

export function adminPage(stats, ratings) {
  if (!stats) return `<div class="block"><b>Admin</b><span>Loading…</span></div>`;
  const totals = stats.totals || {};
  const cards = [['players', totals.players], ['ratings', totals.ratings], ['flagged', totals.flagged]]
    .map(([label, value]) => `<div class="stat"><b>${value || 0}</b><span>${label}</span></div>`).join('');

  const table = !ratings ? '<button class="btn ghost" type="button" data-admin-ratings>Load ratings</button>' : `
    <table class="admintable">
      <tr><th>Player</th><th>Panel</th><th>Date</th><th>Scores</th><th>Flagged</th></tr>
      ${ratings.map(row => `<tr>
        <td>${esc(row.name)}</td><td>${esc(row.panel)}</td><td>${esc(row.created_at)}</td>
        <td>${CATEGORIES.map(c => row[c]).join(' / ')}</td>
        <td>${row.flagged ? 'yes' : 'no'}</td>
      </tr>`).join('')}
    </table>`;

  return `<section aria-label="Admin"><div class="stats">${cards}</div>${table}</section>`;
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
      Every rating on this site is an opinion submitted by an anonymous visitor about a
      named real person. Ratings are not checked, not verified, and not statements of fact.
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
        Anyone with a browser can rate on the community panel. The professional panel is for
        invited players rating their own field, and a rating there counts for twice as much,
        so the Combined score leans towards them.
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
        Signing in with Discord is planned, and that is what will open the panel up.
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
 * Every claim here is checkable against `migrations/0001_init.sql`, `src/worker.js` and
 * `public/index.html`. If you change what is stored, this page is part of the change —
 * see `.scratch/content-pages/03-privacy-statement.md`.
 *
 * The § 5 DDG exemption on the legal notice does NOT extend to this page: that provision
 * scopes on commercial purpose, the GDPR does not.
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
      What is written to the database is: which player, which panel, five scores from 0 to
      100, the time, and a <em>voter hash</em>. No name, no email address, no IP address.
    </p>
    <p>
      The voter hash is a one-way hash of a random token your browser generated. It cannot
      be turned back into you.
    </p>

    <h2>What stays in your browser</h2>
    <p>
      No cookies, no analytics, no advertising, no tracking pixels. Three values in your
      browser's own storage, none of which leaves it except as described above: the rating
      token, a professional access token if you have one (30 days), and an administrator
      token if you are one (until the tab closes).
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

    <h2 data-planned="1">Signing in with Discord ${plannedTag}</h2>
    <p>
      <strong>None of this happens yet.</strong>
    </p>
    <p>
      Accounts are planned. When they arrive, signing in with Discord means this site
      receives your Discord account id, your username and your avatar, and a rating stops
      being attached to a throwaway browser token: it becomes attached to <em>you</em>.
      Every rating you have cast would then be attributable to one identifiable person and
      linkable across every player you have rated, permanently.
    </p>
    <p>
      What happens to ratings cast before that point is not yet decided.
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

export const plannedPage = (title, detail) =>
  `<div class="block"><b>${esc(title)}${plannedTag}</b><span>${esc(detail)}</span></div>`;
