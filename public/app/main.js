// Wiring: owns the state object, listens for events, calls the API, paints the document.
// Everything it decides with lives in the pure modules beside it.

import * as api from './api.js';
import * as views from './views.js';
import { navigation, isReachable } from './nav.js';
import { buildRanking, filterPlayers, resolveSelection } from './ranking.js';
import { canDelete, formValues, resultFor } from './playerForm.js';
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
  roster: [],        // /api/players verbatim: unranked, with the editable columns and a ratings count
  board: [],         // the leaderboard page's own query, which has its own metric/category
  history: [],
  adminStats: null,
  adminRatings: null,
  games: [],
  rateResult: null,
  error: '',

  // The admin form's draft, and the delete guard.
  //
  // The draft lives here rather than in the DOM because render() replaces root.innerHTML
  // wholesale and #search calls go() on every keystroke — and that search is the only way
  // to pick the next player to edit. A draft held in the inputs would be destroyed by
  // typing three letters to find the next one: no error, no warning, nothing to undo.
  playerForm: null,  // { slug, ...fields, message, saving }
  guard: null,       // { player, typed, focused }
};

const root = document.getElementById('app');
const adminToken = () => sessionStorage.adminAtlas || '';

// ---- rendering ----

function currentPlayers() {
  const filtered = filterPlayers(data.ranking, state.query);
  return { filtered, selected: resolveSelection(data.ranking, filtered, state.player) };
}

/**
 * The admin page reads the unranked roster instead of data.ranking, for two reasons: the
 * ranked records carry no rating count, and a player with no ratings is not in the
 * leaderboard at all — so the admin who just created one could not select them.
 *
 * resolveSelection is not used here. On the public pages a search that excludes the
 * selected player usefully moves the detail to the top hit; on this page it would quietly
 * point the edit form at somebody the admin did not choose.
 */
function adminContext() {
  const filtered = filterPlayers(data.roster, state.query);
  const selected = state.player ? data.roster.find(player => player.slug === state.player) || null : null;
  return {
    stats: data.adminStats,
    ratings: data.adminRatings,
    roster: data.roster,
    filtered,
    selected,
    draft: data.playerForm,
    games: data.games,
    guard: data.guard,
    query: state.query,
    saving: Boolean(data.playerForm && data.playerForm.saving),
  };
}

function render() {
  const items = navigation(session);
  if (!isReachable(state.page, session)) state = update(state, { page: 'players' });

  const { filtered, selected } = currentPlayers();

  const body =
      state.page === 'players'     ? views.playersPage(filtered, selected, state)
    : state.page === 'leaderboard' ? views.leaderboardPage(data.board, state)
    : state.page === 'rate'        ? views.ratePage(selected, data.rateResult)
    : state.page === 'admin'       ? views.adminPage(adminContext())
    : state.page === 'legal'       ? views.legalPage()
    : state.page === 'privacy'     ? views.privacyPage(state)
    : state.page === 'help'        ? views.helpPage(state)
    : state.page === 'terms'       ? views.termsPage(state)
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
    ${views.footer(state, session)}`;

  if (restoreSearch) {
    const field = document.getElementById('search');
    field.focus();
    field.setSelectionRange(caret, caret);
  }

  // The server's answer is no use where it cannot be seen. At desktop widths it is
  // already beside the controls that caused it; once the rail stacks above the form it is
  // not, so a message that lands off screen is scrolled to.
  const message = root.querySelector('.admin .result');
  if (message && message.getBoundingClientRect().top > window.innerHeight) {
    message.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }

  // showModal() rather than a dialog rendered open: it is what makes the rest of the page
  // inert, traps the tab order inside the guard, and gives Escape its native meaning. The
  // element is new after every render, so it is re-shown rather than opened once.
  const guard = document.querySelector('dialog.guard');
  if (guard && !guard.open) {
    guard.showModal();
    // Keep holds the focus, so a reflexive Enter cancels rather than deletes. Only on the
    // way in: a later render must not pull the caret out of the confirmation field.
    if (!data.guard.focused) {
      data.guard.focused = true;
      const keep = guard.querySelector('[data-guard-cancel]');
      if (keep) keep.focus();
    }
    // Escape, and anything else that closes it natively, means "keep this player".
    guard.addEventListener('close', () => {
      if (!data.guard) return;
      data.guard = null;
      render();
    });
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
  // Switching player discards the draft silently. Clicking through the roster is the
  // common case, and a confirm dialog on every row would cost more than it saves.
  if ('player' in change && change.player !== state.player) data.playerForm = null;
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
    data.roster = all;
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
  // The datalist behind the game field. Public, so a failure here is not a lost session.
  api.getGames().then(games => { data.games = games; render(); }).catch(() => {});
  render();
}

function signOutAdmin() {
  delete sessionStorage.adminAtlas;
  session.adminKey = false;
  data.adminStats = data.adminRatings = null;
  data.playerForm = data.guard = null;   // the draft goes with the session, deliberately
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

  // "New player" has one job: clear the Selection. The mode follows from that. The draft
  // is dropped explicitly rather than left to go(), which only notices a change of
  // player — pressing it twice while already creating would otherwise keep the first
  // half-typed player in the fields.
  if (event.target.closest('[data-player-new]')) {
    data.playerForm = null;
    return go({ player: null });
  }

  if (event.target.closest('[data-player-delete]')) {
    const player = selectedPlayer();
    if (player) {
      data.guard = { player, typed: '' };
      render();
    }
    return;
  }

  if (event.target.closest('[data-guard-cancel]')) {
    return document.querySelector('dialog.guard').close();
  }

  if (event.target.closest('[data-guard-confirm]')) return destroyPlayer();

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
  // The draft is stored and nothing is rendered: a render here would replace the input
  // the admin is typing into, mid-keystroke.
  const field = event.target.dataset.playerField;
  if (field) {
    draftFor(selectedPlayer())[field] = event.target.value;
    return;
  }

  // Same reason, plus one more: the confirmation is the only thing standing in front of
  // an irreversible delete, so it toggles the button directly rather than re-rendering
  // the dialog out from under the caret.
  if (data.guard && event.target.dataset.confirmSlug !== undefined) {
    data.guard.typed = event.target.value;
    const confirm = document.querySelector('[data-guard-confirm]');
    if (confirm) confirm.disabled = !canDelete(data.guard.typed, data.guard.player.slug);
    return;
  }

  if (event.target.id === 'search') go({ query: event.target.value });
});

// Enter inside the confirmation does nothing. The guard is something you type, not a
// dialog you dismiss, and a reflexive Enter must never be the thing that deletes.
// Escape needs no branch here: showModal() already makes it close the dialog, and the
// close handler in render() reads that as "keep this player".
root.addEventListener('keydown', event => {
  if (data.guard && event.key === 'Enter' && event.target.dataset.confirmSlug !== undefined) {
    event.preventDefault();
  }
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

  if (event.target.matches('[data-player-form]')) return savePlayer();

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

// ---- the admin player form ----

const selectedPlayer = () =>
  (state.player ? data.roster.find(player => player.slug === state.player) || null : null);

/** The draft for whoever is selected now, created on demand and never shared between two. */
function draftFor(selected) {
  const slug = selected ? selected.slug : null;
  if (!data.playerForm || data.playerForm.slug !== slug) data.playerForm = { slug };
  return data.playerForm;
}

/** The server's row, into the roster, so the rail and the form show it before the refetch. */
function patchRoster(player) {
  const i = data.roster.findIndex(row => row.slug === player.slug);
  const row = { ratings: 0, ...(i > -1 ? data.roster[i] : {}), ...player };
  if (i > -1) data.roster[i] = row;
  else data.roster = [...data.roster, row].sort((a, b) => a.name.localeCompare(b.name));
}

/** What the answer from the server does to the page. The decisions are in playerForm.js. */
function settle(result) {
  if (result.signOut) return signOutAdmin();
  const message = { tone: result.tone, text: result.text };

  if ('select' in result) {
    state = update(state, { player: result.select });
    data.playerForm = { slug: result.select, message };
  } else if (result.tone === 'ok') {
    // Repaint from the row the server stored, not from what was typed at it.
    data.playerForm = { slug: state.player, message };
  } else {
    // A rejection leaves the form exactly as it is, so one field can be corrected and
    // saved again rather than seven retyped.
    const draft = draftFor(selectedPlayer());
    draft.saving = false;
    draft.message = message;
  }

  render();
  if (result.reload) loadRanking().then(loadAdmin);
}

async function savePlayer() {
  const selected = selectedPlayer();
  const creating = !selected;
  const body = formValues(selected, data.playerForm);
  const draft = draftFor(selected);
  if (draft.saving) return;

  // Disabled while in flight: a double-click on Create player would otherwise make BoxeR
  // and BoxeR-2 — the duplicate-player failure, arriving through the button.
  draft.saving = true;
  draft.message = null;
  render();

  const action = creating ? 'create' : 'save';
  try {
    const player = creating
      ? await api.createPlayer(adminToken(), body)
      : await api.updatePlayer(adminToken(), selected.slug, body);
    patchRoster(player);
    settle(resultFor({ status: creating ? 201 : 200, action, name: player.name, slug: player.slug }));
  } catch (error) {
    settle(resultFor({ status: error.status, action, name: body.name, error: error.message }));
  }
}

async function destroyPlayer() {
  const { player, typed } = data.guard;
  if (!canDelete(typed, player.slug)) return;   // the button is disabled; this is the second lock
  data.guard = null;
  document.querySelector('dialog.guard').close();

  try {
    const { ratings } = await api.deletePlayer(adminToken(), player.slug);
    data.roster = data.roster.filter(row => row.slug !== player.slug);
    settle(resultFor({ status: 200, action: 'delete', name: player.name, slug: player.slug, ratings }));
  } catch (error) {
    settle(resultFor({ status: error.status, action: 'delete', name: player.name, error: error.message }));
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
