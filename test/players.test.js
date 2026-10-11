import test from 'node:test';
import assert from 'node:assert/strict';

import { CAPS, FIELDS, validatePlayerInput } from '../src/players.js';
import { CAPS as FORM_CAPS } from '../public/app/playerForm.js';

// ---- required fields ----

test('a body with a name and a game is accepted', () => {
  const result = validatePlayerInput({ name: 'BoxeR', game: 'StarCraft: Brood War' });
  assert.equal(result.ok, true);
  assert.equal(result.values.name, 'BoxeR');
  assert.equal(result.values.game, 'StarCraft: Brood War');
});

test('a missing name is rejected, and so is a missing game', () => {
  for (const body of [{ game: 'StarCraft' }, { name: 'BoxeR' }, {}]) {
    const result = validatePlayerInput(body);
    assert.equal(result.ok, false);
    assert.equal(result.status, 400);
    assert.equal(result.error, 'name and game are required');
  }
});

test('whitespace is not a name: "   " is absent', () => {
  const result = validatePlayerInput({ name: '   ', game: 'StarCraft' });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'name and game are required');
});

// ---- caps ----
//
// The expected numbers are the spec's table, written out rather than read from CAPS, so
// the test disagrees with the code when the code changes.
// .scratch/admin-player-crud/spec.md, "Rejections".

test('every editable field has the cap the spec gives it', () => {
  assert.deepEqual(CAPS, {
    name: 80,
    real_name: 120,
    game: 80,
    faction: 80,
    style: 250,
    form: 250,
    notes: 250,
  });
});

test('a field at its cap is accepted', () => {
  for (const [field, cap] of Object.entries(CAPS)) {
    const result = validatePlayerInput({ name: 'BoxeR', game: 'StarCraft', [field]: 'x'.repeat(cap) });
    assert.equal(result.ok, true, `${field} at ${cap} should be accepted`);
    assert.equal(result.values[field].length, cap);
  }
});

test('one character over the cap is a 400 naming the field, never a truncation', () => {
  for (const [field, cap] of Object.entries(CAPS)) {
    const result = validatePlayerInput({ name: 'BoxeR', game: 'StarCraft', [field]: 'x'.repeat(cap + 1) });
    assert.equal(result.ok, false, `${field} at ${cap + 1} should be rejected`);
    assert.equal(result.status, 400);
    assert.equal(result.error, `${field} must be ${cap} characters or fewer`);
    assert.equal(result.values, undefined);
  }
});

test('the three editorial fields agree on 250', () => {
  assert.equal(CAPS.style, 250);
  assert.equal(CAPS.form, 250);
  assert.equal(CAPS.notes, 250);
});

// ---- what the client may not set ----

test('slug, id, active, created_at and updated_at are ignored, not written', () => {
  const result = validatePlayerInput({
    name: 'BoxeR', game: 'StarCraft',
    slug: 'not-your-slug', id: 99, active: 0,
    created_at: '1999-01-01', updated_at: '1999-01-01',
  });
  assert.equal(result.ok, true);
  assert.deepEqual(Object.keys(result.values).sort(), [...FIELDS].sort());
});

test('a body carrying nothing but noise still fails on the required fields', () => {
  const result = validatePlayerInput({ slug: 'boxer', id: 1 });
  assert.equal(result.ok, false);
  assert.equal(result.error, 'name and game are required');
});

test('an absent editable field becomes an empty string, never undefined', () => {
  const { values } = validatePlayerInput({ name: 'BoxeR', game: 'StarCraft' });
  for (const field of FIELDS) assert.equal(typeof values[field], 'string');
  assert.equal(values.notes, '');
});

// ---- the browser's copy of the caps ----

test('the form and the API agree on every cap', () => {
  // public/ is served on its own and cannot import from src/, so the caps exist twice —
  // the way CATEGORIES exists in both src/stats.js and public/app/scores.js. This is the
  // assertion that keeps the two copies the same object.
  assert.deepEqual({ ...FORM_CAPS }, { ...CAPS });
});
