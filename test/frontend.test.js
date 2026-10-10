import test from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORIES, panelScores, hasScores, ratingCount, vertex, polygonPoints } from '../public/app/scores.js';
import { buildRanking, filterPlayers, pageOf, resolveSelection } from '../public/app/ranking.js';
import { navigation, isReachable, VISIBILITY } from '../public/app/nav.js';
import { stateFromSearch, searchFromState, update, DEFAULT_STATE } from '../public/app/state.js';

const panel = (n, value) => ({
  n,
  ...Object.fromEntries(CATEGORIES.map(c => [c, { median: value, mean: value, sd: 0, ci95: null }])),
});

const profile = ({ community = panel(0, null), professional = panel(0, null), combined } = {}) => ({
  slug: 'p', name: 'P',
  community,
  professional,
  combined: combined ?? Object.fromEntries(CATEGORIES.map(c => [c, null])),
});

// ---- scores ----

test('panelScores reads medians from a rated panel', () => {
  const scores = panelScores(profile({ community: panel(2, 70) }), 'community');
  assert.deepEqual(scores, Object.fromEntries(CATEGORIES.map(c => [c, 70])));
});

test('panelScores reads combined as plain numbers', () => {
  const combined = Object.fromEntries(CATEGORIES.map(c => [c, 61.5]));
  assert.equal(panelScores(profile({ combined }), 'combined').micro, 61.5);
});

test('panelScores yields null, never NaN, for an unrated panel', () => {
  const scores = panelScores(profile(), 'professional');
  for (const c of CATEGORIES) {
    assert.equal(scores[c], null);
    assert.ok(!Number.isNaN(scores[c]));
  }
  assert.equal(hasScores(scores), false);
});

test('panelScores survives a missing profile', () => {
  assert.equal(hasScores(panelScores(null, 'combined')), false);
});

test('panelScores keeps a legitimate zero', () => {
  assert.equal(panelScores(profile({ community: panel(1, 0) }), 'community').macro, 0);
});

test('ratingCount sums both panels for combined', () => {
  const p = profile({ community: panel(3, 50), professional: panel(2, 80) });
  assert.equal(ratingCount(p, 'combined'), 5);
  assert.equal(ratingCount(p, 'professional'), 2);
  assert.equal(ratingCount(null, 'combined'), 0);
});

test('vertex puts category 0 at the top and runs clockwise', () => {
  const [topX, topY] = vertex(0, 100, 1, 0, 0);
  assert.ok(Math.abs(topX) < 1e-9);
  assert.equal(Math.round(topY), -100);
  assert.ok(vertex(1, 100, 1, 0, 0)[0] > 0, 'second category sits to the right');
});

test('polygonPoints scales each category independently', () => {
  const points = polygonPoints(100, [1, 0, 0, 0, 0], 0, 0).split(' ');
  assert.equal(points.length, CATEGORIES.length);
  assert.equal(points[1], '0.0,0.0');
});

// ---- ranking ----

const scored = [
  { slug: 'a', name: 'A', value: 90 },
  { slug: 'b', name: 'B', value: 80 },
];
const all = [...scored, { slug: 'c', name: 'C', faction: 'Zerg' }];

test('buildRanking numbers the scored players from one', () => {
  const ranked = buildRanking(scored, all);
  assert.equal(ranked[0].rank, 1);
  assert.equal(ranked[1].rank, 2);
});

test('buildRanking appends unrated players instead of dropping them', () => {
  const ranked = buildRanking(scored, all);
  const c = ranked.find(p => p.slug === 'c');
  assert.ok(c, 'a player absent from the leaderboard still appears');
  assert.equal(c.rank, null);
  assert.equal(c.value, null);
});

test('buildRanking copes with an empty leaderboard', () => {
  const ranked = buildRanking([], all);
  assert.equal(ranked.length, 3);
  assert.ok(ranked.every(p => p.rank === null));
});

test('rank survives filtering — it is not the row index', () => {
  const ranked = buildRanking(scored, all);
  const [onlyMatch] = filterPlayers(ranked, 'B');
  assert.equal(onlyMatch.slug, 'b');
  assert.equal(onlyMatch.rank, 2, 'second place stays second place in a search result');
});

test('filterPlayers matches name, real name, game and faction, case-insensitively', () => {
  const records = [
    { slug: 'x', name: 'Flash', real_name: 'Lee Young Ho', game: 'StarCraft: Brood War', faction: 'Terran' },
    { slug: 'y', name: 'Bisu', real_name: 'Kim Taek Yong', game: 'StarCraft: Brood War', faction: 'Protoss' },
  ];
  assert.equal(filterPlayers(records, 'terr').length, 1);
  assert.equal(filterPlayers(records, 'kim').length, 1);
  assert.equal(filterPlayers(records, 'brood').length, 2);
  assert.equal(filterPlayers(records, '   ').length, 2, 'blank query filters nothing');
  assert.equal(filterPlayers(records, 'zzz').length, 0);
});

test('pageOf clamps an out-of-range page instead of returning nothing', () => {
  const list = Array.from({ length: 7 }, (_, i) => i);
  assert.deepEqual(pageOf(list, 0, 5).items, [0, 1, 2, 3, 4]);
  assert.deepEqual(pageOf(list, 1, 5).items, [5, 6]);
  const past = pageOf(list, 99, 5);
  assert.equal(past.page, 1);
  assert.equal(past.pages, 2);
  assert.deepEqual(past.items, [5, 6]);
  assert.equal(pageOf([], 0, 5).pages, 1);
});

test('resolveSelection keeps the asked-for player when it survives the filter', () => {
  const ranked = buildRanking(scored, all);
  assert.equal(resolveSelection(ranked, ranked, 'b').slug, 'b');
});

test('resolveSelection falls to the top hit when a search excludes the selection', () => {
  const ranked = buildRanking(scored, all);
  const filtered = filterPlayers(ranked, 'A');
  assert.equal(resolveSelection(ranked, filtered, 'b').slug, 'a');
});

test('resolveSelection defaults to top-ranked when nothing is selected', () => {
  const ranked = buildRanking(scored, all);
  assert.equal(resolveSelection(ranked, ranked, null).slug, 'a');
});

// ---- navigation ----

const keys = session => navigation(session).map(i => i.key);
const look = (session, key) => navigation(session).find(i => i.key === key);

test('an anonymous visitor sees no Account and no Admin', () => {
  assert.deepEqual(keys({}), ['players', 'leaderboard', 'rate']);
});

test('a forbidden item is absent, not dimmed', () => {
  assert.equal(look({}, 'account'), undefined);
  assert.equal(look({}, 'admin'), undefined);
});

test('an accepted admin key reveals Admin without granting a role', () => {
  const session = { adminKey: true };
  assert.ok(keys(session).includes('admin'));
  assert.equal(look(session, 'account'), undefined, 'admin is not an account');
});

test('rating stays open while accounts do not exist', () => {
  assert.equal(look({}, 'rate').visibility, VISIBILITY.visible);
});

test('once accounts exist, rating prompts a signed-out visitor rather than hiding', () => {
  const item = look({ accountsEnabled: true }, 'rate');
  assert.equal(item.visibility, VISIBILITY.prompt);
});

test('a signed-in viewer rates without a prompt and gets a planned Account', () => {
  const session = { role: 'community', accountsEnabled: true };
  assert.equal(look(session, 'rate').visibility, VISIBILITY.visible);
  assert.equal(look(session, 'account').visibility, VISIBILITY.planned);
});

test('isReachable rejects a stale URL pointing at a hidden page', () => {
  assert.equal(isReachable('admin', {}), false);
  assert.equal(isReachable('admin', { adminKey: true }), true);
  assert.equal(isReachable('players', {}), true);
});

// ---- state ----

test('stateFromSearch falls back to defaults for junk values', () => {
  const state = stateFromSearch('?page=nope&lens=bogus&metric=&category=hair&strip=-4');
  assert.equal(state.page, DEFAULT_STATE.page);
  assert.equal(state.lens, DEFAULT_STATE.lens);
  assert.equal(state.metric, DEFAULT_STATE.metric);
  assert.equal(state.category, DEFAULT_STATE.category);
  assert.equal(state.strip, 0);
});

test('stateFromSearch reads the values it recognises', () => {
  const state = stateFromSearch('?page=leaderboard&player=flash&q=terr&lens=professional&category=micro&strip=2');
  assert.equal(state.page, 'leaderboard');
  assert.equal(state.player, 'flash');
  assert.equal(state.query, 'terr');
  assert.equal(state.lens, 'professional');
  assert.equal(state.category, 'micro');
  assert.equal(state.strip, 2);
});

test('searchFromState omits defaults so a shared link stays short', () => {
  assert.equal(searchFromState(DEFAULT_STATE), '');
  assert.equal(searchFromState({ ...DEFAULT_STATE, player: 'flash' }), '?player=flash');
});

test('state survives a round trip through the query string', () => {
  const state = stateFromSearch('?page=rate&player=bisu&lens=community&metric=professional&category=macro&strip=3');
  assert.deepEqual(stateFromSearch(searchFromState(state)), state);
});

test('update never mutates and resets paging when the list changes', () => {
  const state = { ...DEFAULT_STATE, strip: 4 };
  const searched = update(state, { query: 'flash' });
  assert.equal(state.strip, 4, 'the original is untouched');
  assert.equal(searched.strip, 0, 'a new result set starts at its first page');
  assert.equal(update(state, { lens: 'community' }).strip, 4, 'an unrelated change keeps the page');
});
