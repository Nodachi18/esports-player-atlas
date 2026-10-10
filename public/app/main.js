// Wiring: owns the state object, listens for events, calls the API, paints the document.
// Everything it decides with lives in the pure modules beside it.

import * as api from './api.js';
import * as views from './views.js';
import { navigation, isReachable } from './nav.js';
import { buildRanking, filterPlayers, resolveSelection } from './ranking.js';
import { stateFromSearch, searchFromState, update } from './state.js';

// Flip when Discord accounts exist: it turns on the spec's target-state visibility rules.
const ACCOUNTS_ENABLED = false;

let state = stateFromSearch(location.search);

const session = {
  role: null,
  adminKey: Boolean(sessionStorage.adminAtlas),
  accountsEnabled: ACCOUNTS_ENABLED,
  adminError: '',
};

const data = {
  ranking: [],       // every player, ranked ones first
  board: [],         // the leaderboard page's own query, which has its own metric/category
  history: [],
  adminStats: null,
  adminRatings: null,
  rateResult: null,
  error: '',
};

const root = document.getElementById('app');
const adminToken = () => sessionStorage.adminAtlas || '';

// ---- rendering ----

function currentPlayers() {
  const filtered = filterPlayers(data.ranking, state.query);
  return { filtered, selected: resolveSelection(data.ranking, filtered, state.player) };
}

function render() {
  const items = navigation(session);
  if (!isReachable(state.page, session)) state = update(state, { page: 'players' });

  const { filtered, selected } = currentPlayers();

  const body =
      state.page === 'players'     ? views.playersPage(filtered, selected, state)
    : state.page === 'leaderboard' ? views.leaderboardPage(data.board, state)
    : state.page === 'rate'        ? views.ratePage(selected, data.rateResult)
    : state.page === 'admin'       ? views.adminPage(data.adminStats, data.adminRatings)
    : views.plannedPage('Account', 'Your sign-in details, your own ratings, and editing them.');

  // Two tints, two meanings: the lens colours the data, the role colours the chrome.
  document.documentElement.dataset.lensActive = state.lens;
  document.documentElement.dataset.admin = session.adminKey ? '1' : '0';

  const active = document.activeElement;
  const restoreSearch = active && active.id === 'search';
  const caret = restoreSearch ? active.selectionStart : 0;

  root.innerHTML = `
    ${views.header(items, state.page, state, session)}
    <main class="wrap">
      ${data.error ? `<p class="result bad">${views.esc(data.error)}</p>` : ''}
      ${body}
    </main>
    ${views.footer(session)}`;

  if (restoreSearch) {
    const field = document.getElementById('search');
    field.focus();
    field.setSelectionRange(caret, caret);
  }

  // The player's history is a detail of the player, not of the page: fetch it lazily.
  if (state.page === 'players' && selected) paintHistory(selected.slug);

  history.replaceState(null, '', searchFromState(state) || location.pathname);
}

function paintHistory(slug) {
  const box = document.getElementById('history');
  if (!box) return;
  if (data.history.slug === slug) {
    box.innerHTML = views.historyTable(data.history.rows);
    return;
  }
  api.getHistory(slug)
    .then(rows => {
      data.history = { slug, rows };
      const target = document.getElementById('history');
      if (target) target.innerHTML = views.historyTable(rows);
    })
    .catch(() => {});
}

function go(change) {
  state = update(state, change);
  render();
}

// ---- loading ----

/**
 * Rank is global: it depends on every other player, so it can only come from the server.
 * Anything that changes a score must call this, not just patch the player it changed.
 */
async function loadRanking() {
  try {
    const [board, all] = await Promise.all([api.getLeaderboard(), api.getPlayers()]);
    data.ranking = buildRanking(board.players, all);
    data.error = '';
  } catch (error) {
    data.error = `${error.message} Is the Worker running?`;
  }
  render();
}

async function loadBoard() {
  try {
    const board = await api.getLeaderboard(state.metric, state.category);
    data.board = board.players;
  } catch (error) {
    data.error = error.message;
  }
  render();
}

async function loadAdmin() {
  if (!adminToken()) return;
  try {
    data.adminStats = await api.getAdminStats(adminToken());
  } catch {
    signOutAdmin();   // an expired or rejected token is not a session
    return;
  }
  render();
}

function signOutAdmin() {
  delete sessionStorage.adminAtlas;
  session.adminKey = false;
  data.adminStats = data.adminRatings = null;
  if (state.page === 'admin') state = update(state, { page: 'players' });
  render();
}

// ---- events ----

root.addEventListener('click', event => {
  const lens = event.target.closest('[data-lens]');
  if (lens) return go({ lens: lens.dataset.lens });

  const strip = event.target.closest('[data-strip]');
  if (strip) return go({ strip: state.strip + (strip.dataset.strip === 'next' ? 1 : -1) });

  if (event.target.closest('[data-admin-out]')) return signOutAdmin();

  if (event.target.closest('[data-admin-ratings]')) {
    return api.getAdminRatings(adminToken())
      .then(rows => { data.adminRatings = rows; render(); })
      .catch(signOutAdmin);
  }

  // A player link and a page link can be the same element: a leaderboard row sets the
  // player context and hands over to Players in one click.
  const link = event.target.closest('[data-slug], [data-page]');
  if (!link) return;
  if (link.getAttribute('aria-disabled') === 'true') return event.preventDefault();
  event.preventDefault();

  const change = {};
  if (link.dataset.slug) change.player = link.dataset.slug;
  if (link.dataset.page) change.page = link.dataset.page;
  if (change.page && change.page !== state.page) data.rateResult = null;
  go(change);

  if (change.page === 'leaderboard') loadBoard();
  if (change.page === 'admin') loadAdmin();
});

root.addEventListener('input', event => {
  // A slider updates its own readout: re-rendering mid-drag would fight the pointer.
  const slider = event.target.dataset.slider;
  if (slider) {
    document.getElementById(`out-${slider}`).value = event.target.value;
    return;
  }
  if (event.target.id === 'search') go({ query: event.target.value });
});

root.addEventListener('change', event => {
  const control = event.target.dataset.control;
  if (!control) return;
  go({ [control]: event.target.value });
  loadBoard();
});

root.addEventListener('submit', async event => {
  event.preventDefault();

  if (event.target.matches('[data-admin-form]')) {
    const field = document.getElementById('adminkey');
    try {
      const { token } = await api.adminLogin(field.value);
      sessionStorage.adminAtlas = token;   // the key itself is never stored
      session.adminKey = true;
      session.adminError = '';
      go({ page: 'admin' });
      return loadAdmin();
    } catch (error) {
      session.adminError = error.message;
      return render();
    }
  }

  if (event.target.matches('[data-rate-form]')) return submitRating();
});

async function submitRating() {
  const { selected } = currentPlayers();
  if (!selected) return;

  const panel = document.getElementById('ratepanel').value;
  const body = { player: selected.slug, panel };
  for (const category of ['strategy', 'tactics', 'micro', 'macro', 'decisions']) {
    body[category] = Number(document.getElementById(`r-${category}`).value);
  }
  if (panel === 'community') body.voter = api.voterId();
  if (panel === 'professional') body.token = localStorage.proAtlas || '';

  try {
    const result = await api.submitRating(body);
    data.rateResult = { tone: 'ok', text: `Rating recorded for ${selected.name}.` };

    // The response carries this player's new aggregates, so the radar is correct at once.
    // It cannot carry their new rank, which depends on every other player: reload that.
    if (result.player) {
      const i = data.ranking.findIndex(player => player.slug === result.player.slug);
      if (i > -1) data.ranking[i] = { ...data.ranking[i], ...result.player };
    }
    data.history = {};
    render();
    await loadRanking();
  } catch (error) {
    data.rateResult = { tone: error.status === 409 ? 'dupe' : 'bad', text: rateMessage(error, panel) };
    render();
  }
}

const rateMessage = (error, panel) => ({
  409: 'You have already rated this player on this panel.',
  401: panel === 'professional'
    ? 'Rating as a professional needs professional access.'
    : 'That rating was not accepted.',
  404: 'That player no longer exists.',
  400: `That rating was rejected: ${error.message}`,
}[error.status] || error.message);

// ---- start ----

render();
loadRanking().then(() => {
  if (state.page === 'leaderboard') loadBoard();
  if (state.page === 'admin') loadAdmin();
});
