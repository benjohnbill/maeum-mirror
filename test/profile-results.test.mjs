import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { clinicalResult, demoRank, midPercentile } from '../public/js/profile-results.js';
import { scoreForm } from '../public/js/screening-forms.js';

test('PHQ-9 ranks use the same descending direction at low and high scores, with ties', () => {
  const form = JSON.parse(readFileSync(new URL('../public/tests/phq9.json', import.meta.url)));
  form.items = form.items.map(item => ({ ...item, options: form.options }));
  const ranks = [];
  for (let total = 0; total <= 27; total++) {
    const answers = Object.fromEntries(form.items.map((item, index) => [item.id, Math.max(0, Math.min(3, total - 3 * index))]));
    const completed = new Map([['phq9', scoreForm(form, answers)]]);
    ranks.push(clinicalResult('mood', completed, 25).rank);
    assert.equal(clinicalResult('mood', completed, 17).rank, null);
    assert.equal(clinicalResult('worry', completed, 25), null);
  }
  assert.deepEqual(ranks, [...ranks].sort((a,b) => b - a));
  assert.deepEqual([ranks[0],ranks[10],ranks[26]], [83,6,1]);
  assert.equal(midPercentile([40,70,100], 1), 55);
});

test('combined and overlapping tests resolve independently per topic and in either completion order', () => {
  const combined = { id: 'phq4', subscores: { phq2: 5, gad2: 3 } };
  const anxiety = { id: 'gad2', score: 2, max: 6 };
  const full = { id: 'gad7', score: 14, max: 21 };
  const tests = [combined, anxiety, full];
  for (const order of [tests, [...tests].reverse()]) {
    const completed = new Map(order.map(t => [t.id, t]));
    const depression = clinicalResult('mood', completed, 25);
    assert.deepEqual([depression.score,depression.max,depression.rank], [5,6,2]);
    assert.equal(clinicalResult('worry', completed, 25).test, full);
    completed.delete('gad7');
    assert.equal(clinicalResult('worry', completed, 25).test, anxiety);
    completed.delete('gad2');
    assert.equal(clinicalResult('worry', completed, 25).score, 3);
  }
});

test('a prototype exercise compares actual values with the same 100 example scores including ties', () => {
  assert.equal(demoRank(null, 0, 3), null);
  assert.deepEqual([0,1,2,3].map(n => demoRank(n, 0, 3)), [88,63,38,13]);
});
