import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indicatorById, indicators } from '../public/js/indicators.js';
import { clinicalResult, demoRank, midPercentile, testResult } from '../public/js/profile-results.js';
import { loadForm, scoreForm } from '../public/js/screening-forms.js';
import { screeners } from '../public/js/screening-router.js';

const options = (low, high) => Array.from({ length: high - low + 1 }, (_, i) => ({ value: low + i, label: String(low + i) }));
const withOptions = (form) => ({ ...form, items: form.items.map(item => ({ ...item, options: item.options || form.options })) });

test('PHQ-9 ranks use the same descending direction at low and high scores, with ties', () => {
  const form = withOptions(JSON.parse(readFileSync(new URL('../public/tests/phq9.json', import.meta.url))));
  const ranks = [];
  for (let total = 0; total <= 27; total++) {
    const answers = Object.fromEntries(form.items.map((item, index) => [item.id, Math.max(0, Math.min(3, total - 3 * index))]));
    const completed = new Map([['phq9', scoreForm(form, answers)]]);
    ranks.push(clinicalResult('mood', completed).rank);
    assert.equal(clinicalResult('mood', new Map([['phq9', { ...completed.get('phq9'), adult: false }]])).rank, null);
    assert.equal(clinicalResult('mood', new Map([['phq9', { ...completed.get('phq9'), adult: true }]])).rank, ranks.at(-1));
    assert.equal(clinicalResult('worry', completed), null);
  }
  assert.deepEqual(ranks, [...ranks].sort((a, b) => b - a));
  assert.deepEqual([ranks[0], ranks[10], ranks[26]], [83, 6, 1]);
  assert.equal(midPercentile([40, 70, 100], 1), 55);
});

test('only PHQ-9 gets a rank: GAD-7, GAD-2, PHQ-4 parts and other tests show raw scores', () => {
  const combined = { id: 'phq4', score: 8, max: 12, band: '중등도', subscores: { phq2: 5, gad2: 3 }, subscoreRanges: { phq2: [0, 6], gad2: [0, 6] } };
  const anxiety = { id: 'gad2', score: 2, max: 6, band: '추가 선별 제안 기준 미만', subscores: {} };
  const full = { id: 'gad7', score: 14, max: 21, band: '중등도', subscores: {} };
  const tests = [combined, anxiety, full];
  for (const order of [tests, [...tests].reverse()]) {
    const completed = new Map(order.map(t => [t.id, t]));
    const depression = clinicalResult('mood', completed);
    assert.deepEqual([depression.score, depression.min, depression.max, depression.rank], [5, 0, 6, null]);
    assert.match(depression.instrument, /^PHQ-4 중 PHQ-?2$/);
    assert.equal(clinicalResult('worry', completed).test, full);
    assert.equal(clinicalResult('worry', completed).rank, null);
    assert.equal(clinicalResult('worry', completed).band, '중등도');
    completed.delete('gad7');
    assert.equal(clinicalResult('worry', completed).test, anxiety);
    completed.delete('gad2');
    assert.equal(clinicalResult('worry', completed).score, 3);
    assert.equal(clinicalResult('worry', completed).band, null);
  }
});

test('generic scoring handles reverse items, mean method, subscores and a derived difference', () => {
  const form = {
    id: 'demo', options: options(1, 7),
    items: ['a', 'b', 'c', 'd'].map(id => ({ id: 'demo.' + id, text: id })),
    scoring: { method: 'mean', range: [1, 7], reverse_items: ['demo.b'], total_meaningful: false },
    subscores: { up: ['demo.a', 'demo.b'], down: ['demo.c', 'demo.d'], balance: ['demo.a', 'demo.b', 'demo.c', 'demo.d'] },
    subscore_rules: { up: { method: 'sum', range: [2, 14] }, down: { method: 'mean' }, balance: { method: 'difference', formula: 'up − down' } },
    summary: '균형 {balance}',
  };
  const result = scoreForm(withOptions(form), { 'demo.a': 7, 'demo.b': 2, 'demo.c': 3, 'demo.d': 4 });
  // b is reversed: 1 + 7 - 2 = 6.
  assert.equal(result.score, 5);
  assert.equal(result.method, 'mean');
  assert.equal(result.band, null);
  assert.equal(result.totalMeaningful, false);
  assert.deepEqual(result.subscores, { up: 13, down: 3.5, balance: 9.5 });
  assert.deepEqual(result.subscoreRanges, { up: [2, 14], down: [1, 7], balance: [-5, 13] });
  assert.equal(result.summary, '균형 9.5');

  const row = { id: 'x', test: 'demo', subscore: 'down' };
  const measured = testResult(row, new Map([['demo', result]]));
  assert.deepEqual([measured.score, measured.min, measured.max, measured.method, measured.rank, measured.band], [3.5, 1, 7, 'mean', null, null]);

  const plain = scoreForm(withOptions({ ...form, scoring: { method: 'sum', reverse_items: [] }, subscores: {}, subscore_rules: undefined }), { 'demo.a': 1, 'demo.b': 2, 'demo.c': 3, 'demo.d': 4 });
  assert.deepEqual([plain.score, plain.min, plain.max], [10, 4, 28]);
});

test('every available test file loads, scores at both ends inside its range, and fills its cards', async () => {
  for (const id of Object.keys(screeners)) {
    const form = await loadForm(id);
    assert.ok(form.items.every(item => item.text && item.options.every(option => option.label != null)), id);
    for (const pick of [Math.min, Math.max]) {
      const answers = Object.fromEntries(form.items.map(item => [item.id, pick(...item.options.map(o => o.value))]));
      const result = scoreForm(form, answers);
      assert.ok(result.score >= result.min && result.score <= result.max, id);
      for (const row of indicators.filter(r => r.test === id)) {
        const measured = testResult(row, new Map([[id, result]]));
        assert.ok(Number.isFinite(measured.score) && measured.score >= measured.min && measured.score <= measured.max, row.id);
        if (id !== 'phq9') assert.equal(measured.rank, null, row.id);
      }
    }
  }
  assert.ok(indicatorById.get('mood'));
});

test('a prototype exercise compares actual values with the same 100 example scores including ties', () => {
  assert.equal(demoRank(null, 0, 3), null);
  assert.deepEqual([0, 1, 2, 3].map(n => demoRank(n, 0, 3)), [88, 63, 38, 13]);
});
