import test from 'node:test';
import assert from 'node:assert/strict';
import { CATEGORIES, median, stdDev, summarize, outlierIds, combine, categoryScores, overall } from '../src/stats.js';

const rating = (id, v, extra = {}) => ({ id, ...Object.fromEntries(CATEGORIES.map(c => [c, v])), ...extra });

test('median handles empty, odd and even inputs', () => {
  assert.equal(median([]), null);
  assert.equal(median([3, 1, 2]), 2);
  assert.equal(median([4, 1, 3, 2]), 2.5);
});

test('stdDev is the sample standard deviation', () => {
  assert.equal(stdDev([5]), 0);
  assert.equal(stdDev([2, 4, 4, 4, 5, 5, 7, 9]).toFixed(4), '2.1381');
});

test('summarize returns nulls for an empty panel', () => {
  const s = summarize([]);
  assert.equal(s.n, 0);
  assert.deepEqual(s.strategy, { median: null, mean: null, sd: 0, ci95: null });
});

test('summarize clamps the confidence interval to 0..100', () => {
  const s = summarize([rating(1, 100), rating(2, 90)]);
  assert.equal(s.strategy.median, 95);
  assert.equal(s.strategy.ci95[1], 100);
});

test('outlierIds needs a minimum sample and skips reviewed rows', () => {
  const rows = Array.from({ length: 20 }, (_, i) => rating(i + 1, 70 + (i % 3)));
  rows.push(rating(99, 0));
  assert.deepEqual(outlierIds(rows), [99]);
  assert.deepEqual(outlierIds(rows.slice(-5)), []);
  rows[rows.length - 1].reviewed = 1;
  assert.deepEqual(outlierIds(rows), []);
});

test('combine weights professionals 2:1 and falls back to whichever panel exists', () => {
  const community = summarize([rating(1, 60)]), professional = summarize([rating(2, 90)]), empty = summarize([]);
  assert.equal(combine(community, professional).micro, 80);
  assert.equal(combine(empty, professional).micro, 90);
  assert.equal(combine(empty, empty).micro, null);
});

test('overall averages per-panel medians (leaderboard value)', () => {
  const community = summarize([rating(1, 60)]), professional = summarize([]);
  const profile = { community, professional, combined: combine(community, professional) };
  assert.equal(overall(categoryScores(profile, 'community')), 60);
  assert.equal(overall(categoryScores(profile, 'professional')), null);
  assert.equal(overall(categoryScores(profile, 'combined')), 60);
});
