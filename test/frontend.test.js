import test from 'node:test';
import assert from 'node:assert/strict';

import { CATEGORIES, panelScores, hasScores, ratingCount, vertex, polygonPoints } from '../public/app/scores.js';
import { buildRanking, filterPlayers, pageOf, resolveSelection } from '../public/app/ranking.js';
import { navigation, isReachable, FOOTER_LINKS, VISIBILITY } from '../public/app/nav.js';
import { stateFromSearch, searchFromState, update, DEFAULT_STATE } from '../public/app/state.js';
import {
  header, footer, playersPage, playerDetail, leaderboardPage, ratePage, adminPage,
  helpPage, legalPage, privacyPage, termsPage, authNotice,
  TERMS_UPDATED, CONTACT_CARD, CLOUDFLARE_PRIVACY, AUTH_NOTICES, DISCORD_START,
} from '../public/app/views.js';
import { canDelete, deletePrompt, formMode, formValues, resultFor } from '../public/app/playerForm.js';

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


// ---- the signed-in shell ----

const SIGNED_OUT = { accountsEnabled: true, role: null, account: null };
const BOXER = { username: 'boxer', global_name: 'BoxeR', avatar: 'a_0123456789abcdef', role: 'community' };
const SIGNED_IN = { accountsEnabled: true, role: 'community', account: BOXER };
const shell = session => header(navigation(session), 'rate', DEFAULT_STATE, session);

// An anchor, and it has to be one. The authorize step is a 302 to discord.com and only a
// top-level navigation can perform it: a button wired to fetch() would follow that redirect
// inside the request and the visitor would never leave the page.
test('signed out, the header offers a full-page link to the start route', () => {
  const html = shell(SIGNED_OUT);
  assert.match(html, new RegExp(`<a class="discord signin" href="${DISCORD_START}">`));
  assert.equal(DISCORD_START, '/api/auth/discord/start');
  assert.doesNotMatch(html, /<button[^>]*class="discord"/, 'a fetch cannot do a top-level redirect');
  // data-page and data-slug are what main.js intercepts; this must fall through to the browser.
  assert.doesNotMatch(html, new RegExp(`href="${DISCORD_START}"[^>]*data-(?:page|slug)`));
});

// Naming Discord is the point: a control that silently jumps to another company's domain
// is the shape a phish has. And there is exactly one of them — the first sign-in is the
// registration, so a Register button starting the identical redirect would be two names
// for one thing.
test('the sign-in control names Discord, and there is only one of it', () => {
  const html = shell(SIGNED_OUT);
  assert.match(html, /Sign in with Discord/);
  assert.equal((html.match(new RegExp(DISCORD_START, 'g')) || []).length, 1);
});

test('signed in, the header shows the person and a way out, and no avatar at all', () => {
  const html = shell(SIGNED_IN);
  assert.match(html, /BoxeR/);
  assert.match(html, /data-signout/);
  assert.doesNotMatch(html, /Sign in with Discord/);
  assert.doesNotMatch(html, new RegExp(DISCORD_START));
  // The hash is stored and never rendered: an <img> built from it loads from
  // cdn.discordapp.com, and the privacy page says nothing here loads from anywhere else.
  assert.doesNotMatch(html, /a_0123456789abcdef/, 'the avatar hash reached the markup');
  assert.doesNotMatch(html, /discordapp/i);
});

test('an account with no display name is shown by its handle rather than blank', () => {
  const session = { accountsEnabled: true, role: 'community', account: { username: 'boxer', global_name: null } };
  assert.match(shell(session), /boxer/);
});

// Until 08 flips ACCOUNTS_ENABLED, nothing built here is reachable by a visitor: the
// control still reads as planned and points nowhere.
test('with accounts off the header still says planned and links nothing', () => {
  const html = header(navigation({}), 'players', DEFAULT_STATE, { accountsEnabled: false });
  assert.match(html, /planned/);
  assert.doesNotMatch(html, /\/api\/auth/);
  assert.doesNotMatch(html, /data-signout/);
});

// The Account page is in RETURN_PAGES (src/auth.js) on purpose, although it renders as
// `planned` — the value only becomes producible once that page exists. What keeps it
// harmless today is this: signed out, the key is not navigable at all, so render() bounces
// a typed ?page=account before a sign-in could ever be started from there.
test('account is unreachable to a signed-out visitor even with accounts on', () => {
  assert.equal(isReachable('account', { accountsEnabled: true }), false);
  assert.equal(isReachable('account', { accountsEnabled: true, role: 'community' }), true);
});

const RATED = { ...profile(), real_name: 'Lim Yo Hwan', game: 'StarCraft: Brood War' };

// Shown, not replaced. A visitor cannot weigh signing in against what is being asked of
// them without seeing the five sliders and the panel choice they are signing in to use.
test('signed out with accounts on, the rate form renders disabled behind a prompt', () => {
  const html = ratePage(RATED, null, SIGNED_OUT);
  assert.match(html, /Sign in with Discord to rate/);
  assert.match(html, new RegExp(`href="${DISCORD_START}"`));
  for (const category of CATEGORIES) {
    assert.match(html, new RegExp(`id="r-${category}"[^>]*disabled`), `${category} is still live`);
  }
  assert.match(html, /id="ratepanel"[^>]*disabled/);
  assert.match(html, /type="submit"[^>]*disabled/);
});

test('signed in, the rate form is live and asks for nothing', () => {
  const html = ratePage(RATED, null, SIGNED_IN);
  assert.doesNotMatch(html, /disabled/);
  assert.doesNotMatch(html, /Sign in with Discord/);
});

test('with accounts off the rate form is exactly what it was', () => {
  assert.doesNotMatch(ratePage(RATED, null, { accountsEnabled: false }), /disabled|Sign in with Discord/);
  assert.doesNotMatch(ratePage(RATED, null), /disabled/, 'the session argument is optional');
});

// Two reasons, two lines. The limiter in 04 sits in front of the token exchange, so it
// counts successful sign-ins too and a whole office behind one address can trip it while
// doing nothing wrong — "wait a minute" is actionable, "sign-in failed" would send them
// straight back to retry, which is the one thing that keeps it shut.
test('each OAuth return reason renders its own single line', () => {
  assert.match(authNotice('failed'), /Sign-in did not complete/);
  assert.match(authNotice('busy'), /in the last minute/);
  assert.notEqual(AUTH_NOTICES.failed, AUTH_NOTICES.busy);
  assert.equal((authNotice('failed').match(/<p/g) || []).length, 1, 'one line, not a page');
});

test('a reason nobody sent renders nothing, inherited keys included', () => {
  assert.equal(authNotice(''), '');
  assert.equal(authNotice(undefined), '');
  assert.equal(authNotice('nope'), '');
  assert.equal(authNotice('constructor'), '', '?auth= is attacker-chosen; the lookup is own-keys only');
  assert.equal(authNotice('toString'), '');
});

// render() rewrites the address bar from searchFromState(), which has never heard of
// `auth`. That is the whole of "it does not survive a reload": the parameter is read once
// at startup and is gone from the URL by the end of the first paint.
test('the sign-in notice cannot come back on a reload', () => {
  const state = stateFromSearch('?page=rate&auth=failed');
  assert.equal(state.page, 'rate', 'the return leg still lands on Rate');
  assert.doesNotMatch(searchFromState(state), /auth/);
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
  assert.deepEqual(FOOTER_LINKS.map(link => link.key), ['help', 'legal', 'privacy', 'terms']);
  assert.ok(FOOTER_LINKS.every(link => link.visibility === VISIBILITY.visible));
});

test('a footer route survives a typed URL, in every session', () => {
  for (const key of ['help', 'legal', 'privacy', 'terms']) {
    assert.equal(isReachable(key, {}), true);
    assert.equal(isReachable(key, { adminKey: true }), true);
    assert.equal(stateFromSearch(`?page=${key}`).page, key);
  }
});

test('the footer renders every link as an openable anchor', () => {
  const html = footer(DEFAULT_STATE, {});
  for (const key of ['help', 'legal', 'privacy', 'terms']) {
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

// Prose wraps across source lines, so match against collapsed whitespace rather than
// contorting the page to keep an assertion on one line. Up here because the privacy,
// help and terms pages all want it.
const flat = html => html.replace(/\s+/g, ' ');

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

// Discord joins the list because signing in is a round trip through discord.com: a visitor
// who signs in reaches it, which is the same test Cloudflare passes. Nothing is loaded from
// either — these are links a reader follows.
test('the only third parties disclosed are the only ones linked', () => {
  const hosts = new Set((privacyPage(DEFAULT_STATE).match(/href="https:\/\/[^/"]+/g) || [])
    .map(href => href.slice('href="https://'.length)));
  assert.deepEqual([...hosts].sort(),
    ['discord.com', 'www.cloudflare.com', 'www.falkenstein-harz.de']);
});

test('the rating section answers the reader, then stops', () => {
  const html = privacyPage(DEFAULT_STATE);
  assert.match(html, /No name, no email address, no IP address/);
  assert.match(html, /one-way hash/);
  // "It cannot be turned back into you" was true of everybody while the hash was made from
  // a token the browser minted. It is made from a Discord account id now and this site
  // holds that id, so the page has to say who can and who cannot — the sentence that was
  // reassuring is the sentence that went false.
  assert.doesNotMatch(html, /cannot\s+be turned back into you/);
  assert.match(html, /attached to your account/);
  // How the one-rating-per-panel rule is enforced is the operator's mechanism, not the
  // reader's exposure. It belongs in 03, not on the page.
  assert.doesNotMatch(html, /clearing browser storage|rate the same player again/i);
});

// The page said "No cookies" and a session cookie ships, which is the plainest kind of
// false a privacy page can be. What replaces it is a sentence, not a banner: § 25(2) TDDDG
// exempts storage strictly necessary for a service the visitor asked for, and a cookie
// that does nothing but keep them signed in is that. The citation stays off the page — see
// the test above that keeps "DDG" off it.
test('the privacy page names the session cookie and asks for no consent', () => {
  const html = flat(privacyPage(DEFAULT_STATE));
  assert.doesNotMatch(html, /No cookies/i, 'a session cookie ships; that sentence was false');
  assert.match(html, /One cookie, set when you sign in/);
  assert.match(html, /30 days or until you sign out/, 'the lifetime matches SESSION_MAX_AGE_SECONDS');
  assert.match(html, /no banner asking you to accept it/);
  assert.match(html, /no analytics, no advertising, no tracking pixels/);
  // The rating token is gone: nothing in the browser identifies a rater any more.
  assert.doesNotMatch(html, /rating token/i);
});

test('the privacy page does not claim the legal notice exemption covers it', () => {
  assert.doesNotMatch(privacyPage(DEFAULT_STATE), /DDG/, '§ 5 DDG scopes on commerce; the GDPR does not');
});

// It shipped marked `planned` so that it would read as an obvious lie the moment sign-in
// landed. Sign-in has landed, so it is a description now: present tense, no tag, and the
// question it left open — what becomes of ratings cast before accounts — is answered,
// because migrations/0007_accounts.sql answered it by deleting them.
test('the Discord section describes what happens, and nothing is marked planned', () => {
  const html = flat(privacyPage(DEFAULT_STATE));
  assert.doesNotMatch(html, /planned|data-planned/, 'sign-in exists; a planned tag here would be the lie');
  assert.doesNotMatch(html, /None of this happens yet|not yet decided/);
  assert.match(html, /<h2>Signing in with Discord<\/h2>/);
  assert.match(html, /Never your email address/);
  assert.match(html, /attributable to one identifiable person/);
  assert.match(html, /Every rating cast before accounts existed has been deleted/);
  // The avatar is stored and nothing renders it, which is what keeps the claim below true.
  assert.match(html, /never shown here/);
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

// The privacy page now states, live on the site, that the resettable rating token is gone
// and that a rating belongs to an account. Nothing else checks that. A single
// `localStorage.voterAtlas = …` put back anywhere under public/app/ makes that page false
// about what sits in the reader's browser, and it would be put back by anyone restoring a
// "works signed out" rating path without reading why it went. Same shape as the grep
// above, and for the same reason: a published claim with no other guard.
test('nothing in the front end mints a browser-local rating identity', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  // Comments are stripped first: the rule is written down in views.js, beside the sentence
  // on the privacy page that depends on it, and a guard that forbids explaining itself
  // would be removed by the next person who needed to say why.
  const code = source => source.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/^\s*\/\/.*$/gm, '');
  const appFiles = await readdir(new URL('../public/app', import.meta.url));

  for (const name of appFiles.filter(f => f.endsWith('.js'))) {
    const source = code(await readFile(new URL(`../public/app/${name}`, import.meta.url), 'utf8'));
    assert.doesNotMatch(source, /voterAtlas/, `${name} mints the rating token the privacy page says is gone`);
    assert.doesNotMatch(source, /\bvoterId\b/, `${name} still has the function that minted it`);
    assert.doesNotMatch(source, /\bvoter\s*[:=]/, `${name} still names a rater of its own choosing`);
  }
});

// The grep above reads source files, so a URL assembled at runtime from a database value
// walks straight past it — and the stored Discord avatar is the first value that could:
// `<img src="https://cdn.discordapp.com/avatars/${id}/${avatar}.png">` is a remote load
// with no remote URL anywhere in src/. The views are pure string functions, so the honest
// check is to render them with that value in every field and read the output.
//
// Anchors are not loads. The privacy page links Cloudflare and Discord on purpose; a link
// a reader may follow is a disclosure, a resource the browser fetches is the thing this
// forbids.
test('nothing a rendered view fetches comes from another origin', () => {
  const avatar = 'a_0123456789abcdef0123456789abcdef';
  const player = {
    ...profile(),
    slug: 'p', name: avatar, real_name: avatar, game: avatar, faction: avatar,
    style: avatar, form: avatar, notes: avatar, ratings: 1, value: 50, rank: 1,
    avatar, image: avatar,
  };
  const session = {
    accountsEnabled: true, adminKey: true, role: 'community',
    account: { id: '1', discord_id: '1', username: avatar, global_name: avatar, avatar },
  };
  const state = { ...DEFAULT_STATE, query: avatar, player: 'p' };
  const ctx = {
    stats: { totals: {} }, ratings: null, roster: [player], filtered: [player],
    selected: player, draft: null, games: [{ game: avatar }], guard: null, query: '',
    saving: false,
  };

  const html = [
    header(navigation(session), 'players', state, session),
    footer(state, session),
    playersPage([player], player, state),
    playerDetail(player, state),
    leaderboardPage([player], state),
    ratePage(player, { tone: 'ok', text: avatar }),
    adminPage(ctx),
    helpPage(state), legalPage(), privacyPage(state), termsPage(state),
  ].join('\n');

  const fetched = [
    ...(html.match(/\b(?:src|srcset|poster|data|formaction|action)\s*=\s*"[^"]*"/gi) || []),
    ...(html.match(/<link\b[^>]*>/gi) || []),
    ...(html.match(/url\(\s*['"]?[^)]*/gi) || []),
  ];
  for (const ref of fetched) {
    assert.doesNotMatch(ref, /(?:https?:)?\/\//i, `a view renders a remote fetch: ${ref}`);
  }
  assert.doesNotMatch(html, /discordapp/i, 'a Discord CDN URL reached the rendered page');
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

// A favicon that 404s is invisible: the browser falls back to a blank page icon and
// nothing warns you. Same for og:image — the card renders without a picture.
test('every icon and preview image the page points at is actually in the repo', async () => {
  const { readFile, access } = await import('node:fs/promises');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');

  const linked = [...html.matchAll(/<link[^>]+href="(\/[^"]+)"/g)].map(m => m[1]);
  const images = [...html.matchAll(/property="og:image" content="[^"]*?(\/[^/"]+)"/g)].map(m => m[1]);
  const referenced = [...linked, ...images].filter(href => !href.startsWith('/app/'));

  assert.ok(referenced.includes('/favicon.ico'), 'index.html links a favicon');
  assert.ok(referenced.includes('/og.png'), 'index.html points og:image at an image');

  for (const href of referenced) {
    await access(new URL(`../public${href}`, import.meta.url));
  }

  // The manifest names its own icons, and nothing else checks those.
  const manifest = JSON.parse(await readFile(new URL('../public/site.webmanifest', import.meta.url), 'utf8'));
  assert.ok(manifest.icons.length, 'the manifest declares at least one icon');
  for (const icon of manifest.icons) {
    await access(new URL(`../public${icon.src}`, import.meta.url));
  }
});

// Facebook, Slack and the rest size the card from these before they have the file, and a
// wrong number crops the image. They are the one part of the markup that silently drifts
// when og.png is regenerated at another size.
test('the declared og:image dimensions match the file on disk', async () => {
  const { readFile } = await import('node:fs/promises');
  const html = await readFile(new URL('../public/index.html', import.meta.url), 'utf8');
  const declared = key => Number(html.match(new RegExp(`property="og:image:${key}" content="(\\d+)"`))[1]);

  // A PNG header is fixed-width: the IHDR width and height are two big-endian 32-bit
  // integers at byte 16, so this needs no image library.
  const png = await readFile(new URL('../public/og.png', import.meta.url));
  assert.equal(png.readUInt32BE(16), declared('width'));
  assert.equal(png.readUInt32BE(20), declared('height'));

  // Under 600x315 and most platforms drop to a small thumbnail instead of a wide card.
  assert.ok(png.readUInt32BE(16) >= 600 && png.readUInt32BE(20) >= 315);
});

// ---- help ----

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
  // What changed when sign-in landed is the reason the panel is shut. It was "signing in
  // is planned"; it is now "nobody has built the promotion", and promotion is
  // .scratch/accounts/04-promote-account-to-professional.md. Sign-in is not the answer to
  // this question any more, and saying it is planned is simply false.
  assert.doesNotMatch(html, /planned/i, 'sign-in exists; the Help page may not say otherwise');
  assert.match(html, /Signing in with Discord is not that route/);
});

// ---- the admin player form ----

test('with no Selection the form is in create mode', () => {
  assert.equal(formMode(null), 'create');
});

test('with a Selection the form is in edit mode', () => {
  assert.equal(formMode({ slug: 'boxer', name: 'BoxeR' }), 'edit');
});

const boxer = {
  slug: 'boxer', name: 'BoxeR', real_name: 'Lim Yo Hwan', game: 'StarCraft: Brood War',
  faction: 'Terran', style: 'Mind games', form: 'Retired', notes: 'The Emperor', ratings: 12,
};

test('the create form starts empty', () => {
  const values = formValues(null, null);
  assert.deepEqual(Object.values(values).filter(Boolean), []);
  assert.equal(values.name, '');
});

test('the edit form loads the Selection', () => {
  const values = formValues(boxer, null);
  assert.equal(values.name, 'BoxeR');
  assert.equal(values.form, 'Retired');
});

test('the form carries no column the admin may not edit', () => {
  const values = formValues(boxer, null);
  for (const key of ['slug', 'id', 'active', 'created_at', 'updated_at', 'ratings']) {
    assert.equal(values[key], undefined, `${key} is not an editable field`);
  }
});

test('a draft beats the Selection, so what was typed survives a re-render', () => {
  const values = formValues(boxer, { slug: 'boxer', name: 'BoxeR II' });
  assert.equal(values.name, 'BoxeR II');
  assert.equal(values.form, 'Retired', 'untouched fields still come from the Selection');
});

test('a field cleared in the draft stays cleared', () => {
  // `||` would quietly put the stored value back and undo the deletion.
  const values = formValues(boxer, { slug: 'boxer', notes: '' });
  assert.equal(values.notes, '');
});

test('a draft belonging to another Player is ignored', () => {
  // Switching Selection discards the draft; this is what makes that true even if the
  // caller forgets to clear it.
  const values = formValues(boxer, { slug: 'flash', name: 'Flash' });
  assert.equal(values.name, 'BoxeR');
});

test('Delete is unreachable without the slug typed exactly', () => {
  for (const typed of ['', ' ', 'boxe', 'boxer ', ' boxer', 'BoxeR', 'BOXER', 'boxer-2', 'Lim Yo Hwan']) {
    assert.equal(canDelete(typed, 'boxer'), false, `"${typed}" must not arm the delete`);
  }
  assert.equal(canDelete('boxer', 'boxer'), true);
});

test('the Player name is not the confirmation; only the slug is', () => {
  assert.equal(canDelete(boxer.name, boxer.slug), false);
});

test('nothing arms a delete against a Player that is not there', () => {
  assert.equal(canDelete('', null), false);
  assert.equal(canDelete('boxer', null), false);
  assert.equal(canDelete('', ''), false);
});

test('the guard names the Player and the exact number of Ratings it destroys', () => {
  const prompt = deletePrompt(boxer);
  assert.equal(prompt.heading, 'Delete BoxeR?');
  assert.match(prompt.lead, /12 ratings/);
  assert.equal(prompt.confirm, 'Delete BoxeR and 12 ratings');
  assert.equal(prompt.cancel, 'Keep BoxeR');
});

test('one Rating is one rating, not 1 ratings', () => {
  const prompt = deletePrompt({ ...boxer, ratings: 1 });
  assert.match(prompt.lead, /1 rating\b/);
  assert.equal(prompt.confirm, 'Delete BoxeR and 1 rating');
});

test('a Player with no Ratings gets a sentence of their own', () => {
  // 31 of 38 Players have none, so without this the guard is a lie most of the time.
  const prompt = deletePrompt({ ...boxer, ratings: 0 });
  assert.match(prompt.lead, /no ratings yet/);
  assert.doesNotMatch(prompt.lead, /0 ratings/);
  assert.equal(prompt.confirm, 'Delete BoxeR');
});

test('the button never reads Confirm', () => {
  for (const n of [0, 1, 12]) {
    assert.doesNotMatch(deletePrompt({ ...boxer, ratings: n }).confirm, /confirm/i);
  }
});

// Every row of the spec's "What each answer does" table.

test('a created Player is reported with the slug the server minted', () => {
  const r = resultFor({ status: 201, action: 'create', name: 'BoxeR', slug: 'boxer' });
  assert.equal(r.tone, 'ok');
  assert.equal(r.text, 'Created BoxeR at /boxer');
  assert.equal(r.select, 'boxer', 'the Selection jumps to the new Player');
  assert.equal(r.reload, true);
});

test('a save stays on the Player', () => {
  const r = resultFor({ status: 200, action: 'save', name: 'BoxeR', slug: 'boxer' });
  assert.equal(r.tone, 'ok');
  assert.equal(r.text, 'Saved.');
  assert.equal(r.select, undefined);
  assert.equal(r.reload, true, 'a renamed Player has to reappear in the rail');
});

test('a delete clears the Selection and says what went with it', () => {
  const r = resultFor({ status: 200, action: 'delete', name: 'BoxeR', slug: 'boxer', ratings: 12 });
  assert.equal(r.tone, 'ok');
  assert.equal(r.text, 'Deleted BoxeR and 12 ratings.');
  assert.equal(r.select, null);
  assert.equal(r.reload, true);
});

test('deleting a Player with no Ratings does not claim it deleted any', () => {
  const r = resultFor({ status: 200, action: 'delete', name: 'BoxeR', slug: 'boxer', ratings: 0 });
  assert.equal(r.text, 'Deleted BoxeR.');
});

test('a 400 shows the server\'s own reason and leaves the form alone', () => {
  const r = resultFor({ status: 400, action: 'save', error: 'notes must be 250 characters or fewer' });
  assert.equal(r.tone, 'bad');
  assert.equal(r.text, 'notes must be 250 characters or fewer');
  assert.equal(r.select, undefined, 'the Selection must not move');
  assert.ok(!r.reload, 'nothing changed, so nothing is refetched');
  assert.ok(!r.signOut);
});

test('a duplicate handle names the handle that is taken', () => {
  const r = resultFor({ status: 409, action: 'create', name: 'Flash' });
  assert.equal(r.tone, 'bad');
  assert.equal(r.text, 'A player called Flash already exists.');
  assert.equal(r.select, undefined);
});

test('a 404 lands exactly where a successful delete lands', () => {
  const r = resultFor({ status: 404, action: 'save', name: 'BoxeR', slug: 'boxer' });
  assert.equal(r.text, 'That player no longer exists. The roster has been reloaded.');
  assert.equal(r.select, null);
  assert.equal(r.reload, true);
});

test('a 401 signs the admin out rather than reporting into a form that is about to go', () => {
  const r = resultFor({ status: 401, action: 'save' });
  assert.equal(r.signOut, true);
});

test('an unrecognised failure still says something', () => {
  const r = resultFor({ status: 500, action: 'save', error: 'Server error' });
  assert.equal(r.tone, 'bad');
  assert.equal(r.text, 'Server error');
});

// ---- the Selection round-trips from the URL into the form ----

test('?page=admin&player=boxer opens the edit form holding BoxeR', () => {
  const state = stateFromSearch('?page=admin&player=boxer');
  const roster = [boxer, { slug: 'flash', name: 'Flash' }];
  const selected = resolveSelection(roster, filterPlayers(roster, state.query), state.player);

  assert.equal(state.page, 'admin');
  assert.equal(formMode(selected), 'edit');
  assert.equal(formValues(selected, null).name, 'BoxeR');
});

test('?page=admin with no player opens the create form, empty', () => {
  const state = stateFromSearch('?page=admin');
  assert.equal(state.player, null);
  assert.equal(formMode(null), 'create');
  assert.equal(formValues(null, null).name, '');
});

test('the edit link survives a round trip through the query string', () => {
  const state = stateFromSearch('?page=admin&player=boxer');
  assert.equal(searchFromState(state), '?page=admin&player=boxer');
});

test('a Player created now is selectable at once, with no ratings and no rank', () => {
  // The ranked strip drops unrated Players, so the admin roster lists from /api/players.
  // Without this a Player is unselectable the moment an admin creates one.
  const created = { slug: 'newcomer', name: 'Newcomer', ratings: 0 };
  const ranking = buildRanking([boxer], [boxer, created]);

  const found = resolveSelection(ranking, filterPlayers(ranking, 'newcomer'), 'newcomer');
  assert.equal(found.slug, 'newcomer');
  assert.equal(found.rank, null);
  assert.equal(formMode(found), 'edit');
  assert.equal(formValues(found, null).name, 'Newcomer');
});

test('a request that never reached the server is not a success', () => {
  // api.js throws ApiError(0, 'Cannot reach the server.') when fetch itself fails. Status
  // 0 is below every error branch, so it used to fall through to the success tail and
  // report "Saved." in green over a save that never happened.
  for (const action of ['create', 'save', 'delete']) {
    const r = resultFor({ status: 0, action, name: 'BoxeR', error: 'Cannot reach the server.' });
    assert.equal(r.tone, 'bad', `${action} must not report success`);
    assert.equal(r.text, 'Cannot reach the server.');
    assert.equal(r.select, undefined, 'the Selection must not move on a request that never landed');
    assert.ok(!r.reload);
  }
});

test('only 200 and 201 are success', () => {
  for (const status of [0, 302, 418, 500, 502, 503]) {
    assert.equal(resultFor({ status, action: 'save', error: 'nope' }).tone, 'bad');
  }
});

// ---- terms of service ----

// House rules published before the conduct they govern. These pin the three things that
// would go stale without anyone noticing: the footer link, the register, and the one claim
// on the page that a change elsewhere in the repo could silently falsify.

test('Terms of service is a real footer link beside Privacy', () => {
  assert.equal(footerLink('terms').visibility, VISIBILITY.visible);
  assert.equal(footerLink('terms').label, 'Terms of service');
  assert.equal(isReachable('terms', {}), true);
  assert.match(footer(DEFAULT_STATE, {}), /data-page="terms"/);
});

// The reader is owed the rules, not the machine that enforces them. Same rule the Help page
// is held to, and the same reason: a terms page that drifts into implementation stops being
// something a person can read and starts describing how to work around it.
test('Terms states rules, not mechanisms', () => {
  const html = flat(termsPage(DEFAULT_STATE));
  for (const jargon of ['voter hash', 'hashe?s?', 'snowflake', 'localStorage', 'sessionStorage',
                        'cookies?', 'databases?', 'tokens?', 'endpoints?', 'API', 'aggregates?',
                        'medians?', 'standard deviations?']) {
    assert.doesNotMatch(html, new RegExp(`\\b${jargon}\\b`, 'i'), `Terms should not say "${jargon}"`);
  }
});

// Rule 4 names no number on purpose, so there is nothing here to keep in step with
// PRO_WEIGHT — the Help page already guards that word and one copy is enough.
test('Terms says the professional panel counts for more without saying how much', () => {
  const html = flat(termsPage(DEFAULT_STATE));
  assert.match(html, /weights the professional panel above the community panel/);
  assert.doesNotMatch(html, /\b(twice|three times|four times)\b/i);
});

// The account rules are published ahead of the code, in the present tense and unhedged: a
// rule has to exist before the conduct it governs. Nothing on this page is marked planned.
test('the account rules are stated as rules, not as plans', () => {
  const html = flat(termsPage(DEFAULT_STATE));
  assert.doesNotMatch(html, /planned|data-planned/, 'nothing on this page is marked planned');

  // Scoped to the section: "you will be removed" is a promise to a rated person elsewhere
  // on the page, and perfectly fine. Hedging is only a defect where a rule is being stated.
  const section = html.match(/<h2>Your account<\/h2>[^]*?(?=<h2|<\/section>)/)[0];
  assert.doesNotMatch(section, /\b(will|would|when they arrive|not yet|once|coming soon)\b/i,
    'future tense turns a rule into a plan');
  assert.match(section, /Rating means signing in with Discord/);
  assert.match(section, /One account per person/);
  assert.match(section, /A blocked account cannot sign in/);
});

// The sign-in tripwire fired, the four claims were re-read against the code on
// 30 October 2026, and it is deleted — it had one job and did it. Three of the four are
// descriptions now: the scope is `identify` (src/auth.js, and the test below keeps it),
// the page names everything 0007_accounts.sql stores, and one account per person is a rule
// rather than a mechanism and always was.
//
// The fourth is still a promise: nothing in this repository can block an account, so
// "a blocked account cannot sign in, and the ratings it has cast are removed from the
// site" is a rule published ahead of its code, exactly as the account rules were. Same
// situation, so the same mechanism — this fails the moment blocking appears in src/, with
// what the page has already committed it to.
test('blocking has not landed yet — when it does, re-read rules 8 and 9', async () => {
  const { readFile, readdir } = await import('node:fs/promises');
  const files = (await readdir(new URL('../src', import.meta.url))).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    assert.doesNotMatch(source, /blocked_at|is_blocked|blockAccount|\bblockedAccount/i,
      `${file}: blocking has landed. The terms page already states, in the present tense, ` +
      'that a blocked account cannot sign in and that the ratings it has cast are removed ' +
      'from the site. "Removed" means excluded from the published scores, not deleted — ' +
      'content-pages/05 decision 2, so that an unblock can restore them and a strike rule ' +
      'stays possible. Confirm both, then delete this test.');
  }
});

// The one claim a change elsewhere could falsify without touching this page. Sign-in is
// specified to request `identify` only (accounts/01), which is what keeps an email address
// out of the database — and out of this promise.
test('the promise that no email address is stored survives sign-in landing', async () => {
  assert.match(flat(termsPage(DEFAULT_STATE)), /Never your email address/);

  const { readFile, readdir } = await import('node:fs/promises');
  const files = (await readdir(new URL('../src', import.meta.url))).filter(f => f.endsWith('.js'));
  for (const file of files) {
    const source = await readFile(new URL(`../src/${file}`, import.meta.url), 'utf8');
    for (const line of source.split('\n')) {
      if (!/scope/i.test(line)) continue;
      assert.doesNotMatch(line, /email/i,
        `${file}: an OAuth scope asking for email makes the terms page a lie`);
    }
  }
});

test('Terms carries a last-updated date and no change clause', () => {
  const html = flat(termsPage(DEFAULT_STATE));
  assert.match(html, new RegExp(`Last updated ${TERMS_UPDATED}`));
  // "We may update these terms at any time" tells the reader nothing about what happens to
  // them. The date does.
  assert.doesNotMatch(html, /at any time|without notice|by continuing to use/i);
});

// Rules 2 and 10 are repeated from the legal notice rather than linked: a reader on either
// page needs both facts, and half an answer plus a link is worse than two sentences twice.
test('Terms repeats the ratings-are-opinions rule and the removal route', () => {
  const html = flat(termsPage(DEFAULT_STATE));
  assert.match(html, /not checked, not verified, and not statements of fact/);
  assert.ok(html.includes(CONTACT_CARD), 'the removal route is reachable from this page');
  assert.match(html, /rel="nofollow noopener noreferrer"/);
});

// accounts/06 is needs-triage and the privacy page has already published that the question
// is open. Answering it here by accident would commit the project to something nobody chose.
test('Terms does not answer what happens to ratings cast before accounts existed', () => {
  assert.doesNotMatch(flat(termsPage(DEFAULT_STATE)), /existing ratings|ratings cast before|previous ratings/i);
});
