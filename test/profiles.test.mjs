import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { indicators } from '../public/js/indicators.js';

// Sample-person starting ranks are a demo setting from weak body-record evidence:
// every prior stays between 30등 and 70등, and the clinical rows never closer than 35등.
const clinical = new Set(['mood', 'worry', 'ptsd']);
const personas = JSON.parse(readFileSync(new URL('../public/sample/personas.json', import.meta.url)));

for (const { id } of personas) {
  test(`${id} profile ranks all 24 indicators inside the demo bounds`, () => {
    const profile = JSON.parse(readFileSync(new URL(`../public/sample/${id}/profile.json`, import.meta.url)));
    assert.equal(profile.persona, id);
    assert.deepEqual(Object.keys(profile.indicators).sort(), indicators.map((row) => row.id).sort());
    for (const [row, { rank, basis }] of Object.entries(profile.indicators)) {
      assert.ok(Number.isInteger(rank), row + ' rank is an integer');
      assert.ok(rank >= (clinical.has(row) ? 35 : 30) && rank <= 70, row + ' rank ' + rank + ' is inside the bounds');
      assert.ok(typeof basis === 'string' && basis.trim(), row + ' has a basis line');
    }
  });
}
