import test from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORIES, panelScores, hasScores, ratingCount, vertex, polygonPoints } from '../public/app/scores.js';
import { buildRanking, filterPlayers, pageOf, resolveSelection } from '../public/app/ranking.js';
import { navigation, isReachable, FOOTER_LINKS, VISIBILITY } from '../public/app/nav.js';
import { stateFromSearch, searchFromState, update, DEFAULT_STATE } from '../public/app/state.js';
import { footer, helpPage, legalPage, privacyPage, CONTACT_CARD, CLOUDFLARE_PRIVACY } from '../public/app/views.js';

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

// ---- footer and the legal notice ----

const footerLink = key => FOOTER_LINKS.find(link => link.key === key);

test('every footer link is built — nothing down there is planned any more', () => {
  assert.deepEqual(FOOTER_LINKS.map(link => link.key), ['help', 'legal', 'privacy']);
  assert.ok(FOOTER_LINKS.every(link => link.visibility === VISIBILITY.visible));
});

test('a footer route survives a typed URL, in every session', () => {
  for (const key of ['help', 'legal', 'privacy']) {
    assert.equal(isReachable(key, {}), true);
    assert.equal(isReachable(key, { adminKey: true }), true);
    assert.equal(stateFromSearch(`?page=${key}`).page, key);
  }
});

test('the footer renders every link as an openable anchor', () => {
  const html = footer(DEFAULT_STATE, {});
  for (const key of ['help', 'legal', 'privacy']) {
    assert.match(html, new RegExp(`<a class="footlink" href="\\?page=${key}"[^>]*data-page="${key}"`));
  }
  assert.doesNotMatch(html, /planned|aria-disabled/);
});

test('the current footer page is marked, like a nav item', () => {
  assert.match(footer({ ...DEFAULT_STATE, page: 'legal' }, {}), /aria-current="page"/);
  assert.doesNotMatch(footer(DEFAULT_STATE, {}), /aria-current="page"/);
});

test('the legal notice says why no provider information is published', () => {
  const html = legalPage();
  assert.match(html, /§ 5 DDG/, 'the exemption is named, not implied by an absence');
  assert.match(html, /private, non-commercial/);
});

test('the heading carries Impressum as well as Legal notice', () => {
  const html = legalPage();
  assert.match(html, /Legal notice/);
  assert.match(html, /<span class="alt" lang="de">Impressum<\/span>/);
});

test('contact is a nofollow link to the card, never a copy of it', () => {
  const html = legalPage();
  const anchor = html.match(/<a class="extlink"[^>]*>/)[0];
  assert.ok(anchor.includes(`href="${CONTACT_CARD}"`));
  for (const token of ['nofollow', 'noopener', 'noreferrer']) {
    assert.match(anchor, new RegExp(`rel="[^"]*\\b${token}\\b`), `rel is missing ${token}`);
  }
  assert.equal(CONTACT_CARD.startsWith('https://www.falkenstein-harz.de/'), true);
});

test('nothing from the contact card is mirrored into the page', () => {
  // The card holds a name, a postal address and a phone number. The whole point of linking
  // rather than copying is that none of them live here, so there is no stale second copy.
  // The link's own `mandat=21964` is the record id, not an address: it is the pointer the
  // page is allowed to hold. Everything else is checked for leaked details.
  const html = legalPage();
  const body = html.split(CONTACT_CARD).join('');
  assert.doesNotMatch(body, /\b\d{5}\b/, 'no German postal code');
  assert.doesNotMatch(body, /tel:|Telefon|\+49/, 'no phone number');
  assert.doesNotMatch(body, /mailto:/, 'no email address');
  const outbound = html.match(/href="https?:[^"]*"/g) || [];
  assert.deepEqual(outbound, [`href="${CONTACT_CARD}"`], 'exactly one outbound link');
});

// ---- privacy statement ----
//
// These pin the claims that go stale silently. A privacy page that quietly stops matching
// the code is worse than none, because it is a published statement rather than a gap.

test('Privacy is a real footer link beside Legal notice', () => {
  assert.equal(footerLink('privacy').visibility, VISIBILITY.visible);
  assert.equal(isReachable('privacy', {}), true);
  assert.match(footer(DEFAULT_STATE, {}), /data-page="privacy"/);
});

test('the privacy page names the third party a visitor actually contacts', () => {
  assert.ok(privacyPage(DEFAULT_STATE).includes(CLOUDFLARE_PRIVACY),
    'Cloudflare hosts it and therefore sees every request');
});

test('every outbound link on the privacy page is nofollow', () => {
  for (const anchor of privacyPage(DEFAULT_STATE).match(/<a [^>]*href="https:[^>]*>/g)) {
    assert.match(anchor, /rel="[^"]*\bnofollow\b/, `not nofollow: ${anchor}`);
  }
});

test('the only third parties disclosed are the only ones linked', () => {
  const hosts = new Set((privacyPage(DEFAULT_STATE).match(/href="https:\/\/[^/"]+/g) || [])
    .map(href => href.slice('href="https://'.length)));
  assert.deepEqual([...hosts].sort(), ['www.cloudflare.com', 'www.falkenstein-harz.de']);
});

test('the rating section answers the reader, then stops', () => {
  const html = privacyPage(DEFAULT_STATE);
  assert.match(html, /No name, no email address, no IP address/);
  assert.match(html, /one-way hash/);
  assert.match(html, /cannot\s+be turned back into you/);
  // How the one-rating-per-panel rule is enforced is the operator's mechanism, not the
  // reader's exposure. It belongs in 03, not on the page.
  assert.doesNotMatch(html, /clearing browser storage|rate the same player again/i);
});

test('the privacy page does not claim the legal notice exemption covers it', () => {
  assert.doesNotMatch(privacyPage(DEFAULT_STATE), /DDG/, '§ 5 DDG scopes on commerce; the GDPR does not');
});

test('the Discord section is marked planned and says nothing happens yet', () => {
  const html = privacyPage(DEFAULT_STATE);
  const heading = html.match(/<h2 data-planned="1">[^]*?<\/h2>/)[0];
  assert.match(heading, /Discord/);
  assert.match(heading, /<span class="tag">planned<\/span>/, 'planned means not built yet, and is said that way');
  assert.match(html, /None of this happens yet/);
});

// The page no longer discloses a third party because there no longer is one. Re-adding a
// CDN font, script or image would make that silently untrue, and the privacy page would
// not know. This is what notices it.
test('nothing in the shipped front end loads from another origin', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const read = name => readFile(new URL(`../public/${name}`, import.meta.url), 'utf8');

  const appFiles = await readdir(new URL('../public/app', import.meta.url));
  const sources = await Promise.all(['index.html', ...appFiles.map(f => `app/${f}`)].map(read));

  for (const [i, source] of sources.entries()) {
    const remote = source.match(/(?:src|href)\s*=\s*["']https?:\/\/[^"']+/gi) || [];
    const urls = source.match(/url\(\s*['"]?https?:/gi) || [];
    assert.deepEqual([...remote, ...urls], [], `remote reference in ${['index.html', ...appFiles][i]}`);
  }
});

test('every font face the stylesheet declares is actually in the repo', async () => {
  const { readFile, access } = await import('node:fs/promises');
  const css = await readFile(new URL('../public/app/fonts.css', import.meta.url), 'utf8');
  const faces = css.match(/url\('\/fonts\/([^']+)'\)/g) || [];
  assert.ok(faces.length, 'fonts.css declares at least one face');
  for (const face of faces) {
    const file = face.match(/\/fonts\/([^']+)/)[1];
    await access(new URL(`../public/fonts/${file}`, import.meta.url));
  }
  // The OFL requires the licence to travel with the files.
  await access(new URL('../public/fonts/OFL.txt', import.meta.url));
});

// ---- help ----

// Prose wraps across source lines, so match against collapsed whitespace rather than
// contorting the page to keep an assertion on one line.
const flat = html => html.replace(/\s+/g, ' ');

test('Help asks four questions, each visually separated', () => {
  const html = helpPage(DEFAULT_STATE);
  const blocks = html.match(/<div class="qa">/g) || [];
  assert.equal(blocks.length, 4, 'one card per question');
  assert.equal((html.match(/<h2>/g) || []).length, 4, 'every card leads with its question');
  for (const h2 of html.match(/<h2>[^<]*/g)) assert.match(h2, /\?$/, `not a question: ${h2}`);
});

test('Help links the legal notice for context', () => {
  assert.match(helpPage(DEFAULT_STATE),
    /<a class="inlink" href="\?page=legal" data-page="legal">legal notice<\/a>/);
});

// The page no longer prints the formula, but the weighting is still the answer to the first
// question, so a change to the maths still has to reach it.
test('Help states the weighting that src/stats.js actually applies', async () => {
  const { PRO_WEIGHT } = await import('../src/stats.js');
  const words = { 2: 'twice', 3: 'three times', 4: 'four times' };
  assert.match(flat(helpPage(DEFAULT_STATE)),
    new RegExp(`counts for ${words[PRO_WEIGHT]} as much`), 'the Combined answer is stale');
});

// What a reader is owed is what the scores mean, not how they are computed. This fails if
// the page drifts back towards describing the machine.
test('Help explains in a reader\'s terms, not the implementation\'s', () => {
  const html = flat(helpPage(DEFAULT_STATE));
  // Word boundaries: "mean" is deliberately absent as a statistic but unavoidable as a verb.
  for (const jargon of ['standard deviations?', 'medians?', 'databases?', 'tokens?',
                        'localStorage', 'endpoints?', 'API', 'hashe?s?', 'aggregate']) {
    assert.doesNotMatch(html, new RegExp(`\\b${jargon}\\b`, 'i'), `Help should not say "${jargon}"`);
  }
});

test('Help says becoming a professional is not currently possible', () => {
  // There is no invite flow a reader can reach: nothing writes localStorage.proAtlas, so
  // the honest answer is "nobody can", not a description of a route that does not exist.
  const html = flat(helpPage(DEFAULT_STATE));
  assert.match(html, /At the moment, nobody can/);
  assert.match(html, /no way to ask for an invite or to use one/);
});
