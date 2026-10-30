import test from 'node:test';
import assert from 'node:assert/strict';

import {
  SESSION_COOKIE,
  SESSION_MAX_AGE_SECONDS,
  SCOPE,
  RETURN_PAGES,
  DEFAULT_RETURN_PAGE,
  sessionCookie,
  expiredSessionCookie,
  readCookie,
  statePayload,
  returnPage,
  authorizeUrl,
  tokenRequestBody,
  accountAgeMs,
} from '../src/auth.js';
import { PAGES } from '../public/app/state.js';

// A stand-in for the authorize endpoint. The real one lives in configuration, never in
// src/, so every test here passes its own base and asserts the whole URL against it.
const BASE = 'https://example.test/oauth2/authorize';

// ---- reading a cookie ----

test('an absent Cookie header is not an error, it is no cookie', () => {
  assert.equal(readCookie(null, SESSION_COOKIE), null);
  assert.equal(readCookie(undefined, SESSION_COOKIE), null);
  assert.equal(readCookie('', SESSION_COOKIE), null);
});

test('one cookie, and several, read the same', () => {
  assert.equal(readCookie('epa_session=abc', SESSION_COOKIE), 'abc');
  assert.equal(readCookie('theme=dark; epa_session=abc; seen=1', SESSION_COOKIE), 'abc');
  assert.equal(readCookie('theme=dark; seen=1', SESSION_COOKIE), null);
});

test('the space after a semicolon is not part of the name or the value', () => {
  assert.equal(readCookie('theme=dark;   epa_session=abc   ; seen=1', SESSION_COOKIE), 'abc');
  assert.equal(readCookie('  epa_session = abc ', SESSION_COOKIE), 'abc');
});

// The one that matters. A substring match would hand the caller a value some other cookie
// set, and the caller is what decides whether you are signed in.
test('a name that merely ends with ours is a different cookie', () => {
  assert.equal(readCookie('other_epa_session=x', SESSION_COOKIE), null);
  assert.equal(readCookie('other_epa_session=x; epa_session=mine', SESSION_COOKIE), 'mine');
  assert.equal(readCookie('epa_session_backup=x', SESSION_COOKIE), null);
});

test('a token keeps its own punctuation', () => {
  // signToken produces base64url with a `.` between payload and signature.
  const token = 'eyJraW5kIjoic2Vzc2lvbiJ9.c2ln-bmF0dXJl_x';
  assert.equal(readCookie(`epa_session=${token}`, SESSION_COOKIE), token);
});

test('a valueless entry is skipped rather than matched', () => {
  assert.equal(readCookie('epa_session', SESSION_COOKIE), null);
  assert.equal(readCookie('epa_session; epa_session=abc', SESSION_COOKIE), 'abc');
});

// ---- writing it ----
//
// The attributes are written out rather than read from the module, so the test disagrees
// with the code when the code changes.
// .scratch/accounts/01-discord-oauth-sign-in/03-auth-seams-and-their-tests.md

test('the session cookie carries every attribute, and the TTL it was given', () => {
  assert.equal(
    sessionCookie('abc', 600),
    'epa_session=abc; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=600',
  );
});

test('30 days is the default, so the TTL lives in one place', () => {
  assert.equal(SESSION_MAX_AGE_SECONDS, 2592000);
  assert.equal(sessionCookie('abc'), 'epa_session=abc; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=2592000');
});

test('the expired cookie is the same cookie, emptied, with Max-Age=0', () => {
  assert.equal(
    expiredSessionCookie(),
    'epa_session=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0',
  );
});

test('HttpOnly and Secure are on both, or logout leaves a readable cookie behind', () => {
  for (const header of [sessionCookie('abc'), expiredSessionCookie()]) {
    assert.match(header, /; HttpOnly(;|$)/);
    assert.match(header, /; Secure(;|$)/);
    assert.match(header, /; SameSite=Lax(;|$)/);
    assert.match(header, /; Path=\/(;|$)/);
  }
});

test('no Domain, and no __Host- prefix', () => {
  // The prefix stops a sibling subdomain writing the cookie; workers.dev is on the Public
  // Suffix List, so a browser already refuses `Domain=workers.dev` from another Worker.
  // Leaving it off means one name under `wrangler dev` over HTTP and one in production.
  for (const header of [sessionCookie('abc'), expiredSessionCookie()]) {
    assert.doesNotMatch(header, /Domain=/i);
    assert.doesNotMatch(header, /__Host-|__Secure-/);
  }
  assert.equal(SESSION_COOKIE, 'epa_session');
});

test('what sessionCookie writes, readCookie reads back', () => {
  const [pair] = sessionCookie('abc').split(';');
  assert.equal(readCookie(pair, SESSION_COOKIE), 'abc');
});

// ---- where the visitor comes back to ----

test('every page the module allows is accepted unchanged', () => {
  for (const page of RETURN_PAGES) assert.equal(returnPage(page), page);
});

// This is what stops the return value being an open redirect: the answer is always a member
// of the allowed list, never something the caller handed in.
test('anything not on the list falls back to rate', () => {
  for (const value of [
    'nonsense',
    '',
    '../evil',
    '/../evil',
    'https://evil.example',
    '//evil.example',
    'https://evil.example/?page=rate',
    'rate ',
    'Rate',
    'admin',            // deliberately not a return target: a session is not an admin key
    null,
    undefined,
    0,
    ['rate'],
  ]) {
    assert.equal(returnPage(value), 'rate', `${String(value)} must not survive`);
  }
  assert.equal(DEFAULT_RETURN_PAGE, 'rate');
});

test('a caller may narrow the list, and gets the same fallback', () => {
  assert.equal(returnPage('rate', ['rate']), 'rate');
  assert.equal(returnPage('players', ['rate']), 'rate');
});

test('the return pages are pages the frontend actually has', () => {
  // public/ is served on its own and cannot be imported from src/, so the list exists
  // twice — the way CAPS does in src/players.js and public/app/playerForm.js. This is the
  // assertion that stops a redirect target drifting into a page that does not exist.
  for (const page of RETURN_PAGES) {
    assert.ok(PAGES.includes(page), `${page} is not a page in public/app/state.js`);
  }
  assert.ok(PAGES.includes(DEFAULT_RETURN_PAGE));
});

// ---- the state token's payload ----

test('the state payload carries its kind, its page and an absolute expiry', () => {
  assert.deepEqual(statePayload('account', 1000, 5000), {
    kind: 'state',
    page: 'account',
    exp: 6000,
  });
});

test('kind is state, because verifyToken is what tells a state from a session', () => {
  assert.equal(statePayload('rate', Date.now(), 300000).kind, 'state');
});

test('a page nobody could return to is never signed in the first place', () => {
  assert.equal(statePayload('https://evil.example', 0, 1).page, 'rate');
  assert.equal(statePayload(undefined, 0, 1).page, 'rate');
});

// ---- the authorize URL ----

test('the authorize URL is the base it was given, with the whole query', () => {
  assert.equal(
    authorizeUrl({
      base: BASE,
      clientId: '123',
      redirectUri: 'https://www.example.test/api/auth/callback',
      state: 'signed.state',
    }),
    `${BASE}?client_id=123&response_type=code` +
    '&redirect_uri=https%3A%2F%2Fwww.example.test%2Fapi%2Fauth%2Fcallback' +
    '&scope=identify&state=signed.state',
  );
});

test('the grant is the authorization code one, and the state passes through untouched', () => {
  const url = new URL(authorizeUrl({
    base: BASE,
    clientId: '123',
    redirectUri: 'https://www.example.test/cb',
    state: 'a.b+c/d=',
  }));
  assert.equal(url.searchParams.get('response_type'), 'code');
  assert.equal(url.searchParams.get('client_id'), '123');
  assert.equal(url.searchParams.get('redirect_uri'), 'https://www.example.test/cb');
  assert.equal(url.searchParams.get('state'), 'a.b+c/d=');
});

test('the default permission asked for is identify, and only identify', () => {
  const url = new URL(authorizeUrl({ base: BASE, clientId: '1', redirectUri: 'https://x.test/cb', state: 's' }));
  assert.equal(url.searchParams.get('scope'), 'identify');
  assert.equal(SCOPE, 'identify');
  // The terms page states in the present tense what this flow does and does not ask for;
  // test/frontend.test.js watches src/ for the word that would make it false.
  assert.equal(url.searchParams.getAll('scope').length, 1);
});

test('the endpoint is the caller\'s, so nothing here pins a host', () => {
  const url = authorizeUrl({
    base: 'https://somewhere.else.test/authorize',
    clientId: '1',
    redirectUri: 'https://x.test/cb',
    state: 's',
  });
  assert.ok(url.startsWith('https://somewhere.else.test/authorize?'), url);
});

// ---- the code exchange ----

test('the exchange body is form data, not JSON — the endpoint refuses JSON', () => {
  const body = tokenRequestBody({
    clientId: '123',
    clientSecret: 'shh',
    code: 'the code',
    redirectUri: 'https://www.example.test/api/auth/callback',
  });
  assert.ok(body instanceof URLSearchParams);
  assert.equal(body.get('grant_type'), 'authorization_code');
  assert.equal(body.get('client_id'), '123');
  assert.equal(body.get('client_secret'), 'shh');
  assert.equal(body.get('code'), 'the code');
  assert.equal(body.get('redirect_uri'), 'https://www.example.test/api/auth/callback');
});

test('the exchange body encodes itself', () => {
  const body = tokenRequestBody({
    clientId: '1', clientSecret: 's', code: 'a b&c', redirectUri: 'https://x.test/cb',
  });
  assert.equal(
    body.toString(),
    'client_id=1&client_secret=s&grant_type=authorization_code&code=a+b%26c&redirect_uri=https%3A%2F%2Fx.test%2Fcb',
  );
});

// ---- account age from the snowflake ----
//
// Discord's own documented example: snowflake 175928847299117063 was created at
// 1462015105796. https://docs.discord.com/developers/reference

const EXAMPLE_SNOWFLAKE = '175928847299117063';
const EXAMPLE_CREATED_AT = 1462015105796;

test('the age is measured from the timestamp the snowflake encodes', () => {
  const now = EXAMPLE_CREATED_AT + 86_400_000;
  assert.equal(now - accountAgeMs(EXAMPLE_SNOWFLAKE, now), EXAMPLE_CREATED_AT);
  assert.equal(accountAgeMs(EXAMPLE_SNOWFLAKE, now), 86_400_000);
});

test('a number is not good enough to shift: BigInt is load-bearing', () => {
  // `>>` coerces to a signed 32-bit integer, so the naive version reads -252 out of a
  // 19-digit id and dates the account before Discord existed — silently, with no error.
  const naive = (Number(EXAMPLE_SNOWFLAKE) >> 22) + 1420070400000;
  assert.notEqual(naive, EXAMPLE_CREATED_AT);
  const now = Date.now();
  assert.equal(now - accountAgeMs(EXAMPLE_SNOWFLAKE, now), EXAMPLE_CREATED_AT);
});

test('a snowflake survives as a string, whole', () => {
  // The id itself does not fit a JavaScript number; it is never turned into one.
  assert.notEqual(String(Number(EXAMPLE_SNOWFLAKE)), EXAMPLE_SNOWFLAKE);
  const now = EXAMPLE_CREATED_AT;
  assert.equal(accountAgeMs(EXAMPLE_SNOWFLAKE, now), 0);
});

test('an account created today is young, not negative', () => {
  const now = 1_700_000_000_000;
  const age = accountAgeMs(EXAMPLE_SNOWFLAKE, now);
  assert.ok(age > 0);
  assert.equal(age, now - EXAMPLE_CREATED_AT);
});

test('something that is not a snowflake is null, never a throw', () => {
  // Nothing gates on the age, so a surprise in the identity response must not take the
  // callback down for the sake of a signal no code reads.
  for (const value of ['', 'abc', '12a', null, undefined, {}, '-1', '1.5']) {
    assert.equal(accountAgeMs(value, Date.now()), null, `${String(value)} is not a snowflake`);
  }
});
