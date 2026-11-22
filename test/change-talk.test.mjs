import test from 'node:test';
import assert from 'node:assert/strict';
import { BANK, WHY, whyKeyFor, whyQuestion } from '../public/js/change-talk.js';
import { cueFor, cueSignals, localCues } from '../public/js/trait-estimates.js';

const allChoices = () => [
  ...Object.values(BANK).flatMap((byDirection) => Object.values(byDirection)).flatMap((entry) => entry.choices),
  ...Object.values(WHY).flatMap((entry) => entry.choices),
];

test('every scripted cue names a cue-table row and a direction, never a size', () => {
  for (const choice of allChoices()) {
    for (const cue of choice.cues) {
      assert.ok(cueFor(cue.indicator, cue.item), cue.indicator + ' ' + cue.item);
      assert.deepEqual(Object.keys(cue).sort(), ['dir', 'indicator', 'item']);
      assert.ok(cue.dir === 1 || cue.dir === -1);
    }
  }
});

test('every Q1 reason names a WHY entry, and every WHY entry asks why with 3-4 reasons', () => {
  for (const entry of Object.values(BANK).flatMap((byDirection) => Object.values(byDirection))) {
    for (const choice of entry.choices) assert.ok(WHY[choice.why], choice.text);
  }
  for (const [key, entry] of Object.entries(WHY)) {
    assert.ok(entry.asks.length >= 1 && entry.asks.length <= 2, key);
    assert.ok(entry.choices.length >= 3 && entry.choices.length <= 4, key);
    assert.ok(!entry.choices.some((choice) => /^(네|아니요)/.test(choice.text)), key + ' is not a yes/no confirmation');
  }
  assert.equal(whyQuestion('nope').text, WHY.life.asks[0]);
});

test('free text picks its WHY entry by its first cue, and no cue means life', () => {
  assert.equal(whyKeyFor([]), 'life');
  assert.equal(whyKeyFor([{ indicator: 'worry', item: 'gad7.2', dir: 1 }]), 'worry');
  assert.equal(whyKeyFor([{ indicator: 'worry', item: 'gad7.2', dir: -1 }]), 'calm');
  assert.equal(whyKeyFor([{ indicator: 'mood', item: 'phq9.1', dir: -1 }]), 'life');
  assert.equal(whyKeyFor([{ indicator: 'rumination', item: 'rumination.0', dir: 1 }]), 'life');
});

test('cueSignals: answer 1 moves 6, answer 2 moves 12 on the same indicator and direction, else 8', () => {
  const first = [{ indicator: 'burnout', item: 'cbi.1', dir: 1 }, { indicator: 'worry', item: 'gad7.2', dir: 1 }];
  assert.deepEqual(cueSignals(first, 'A1').map((s) => s.delta), [6, 6]);
  const second = [{ indicator: 'burnout', item: 'cbi.3', dir: 1 }, { indicator: 'worry', item: 'gad7.3', dir: -1 }, { indicator: 'delay', item: 'delay.2', dir: 1 }];
  assert.deepEqual(cueSignals(second, 'A2', first), [
    { indicator: 'burnout', item: 'cbi.3', delta: 12, quote: 'A2' },
    { indicator: 'worry', item: 'gad7.3', delta: -8, quote: 'A2' },
    { indicator: 'delay', item: 'delay.2', delta: 8, quote: 'A2' },
  ]);
  // Unknown cues, sizes in place of a direction, and a second cue on one indicator are dropped.
  assert.deepEqual(cueSignals([{ indicator: 'burnout', item: 'nope', dir: 1 }, { indicator: 'burnout', item: 'cbi.1', dir: 5 },
    { indicator: 'mood', item: 'phq9.1', dir: -1, quote: '내 말' }, { indicator: 'mood', item: 'phq9.2', dir: 1 }], 'A1'),
  [{ indicator: 'mood', item: 'phq9.1', delta: -6, quote: '내 말' }]);
});

test('on-device free text becomes cues with the user\'s own quote', () => {
  const text = '해야 할 일을 자꾸 미뤄요.';
  const cues = localCues(text);
  assert.ok(cues.length);
  for (const cue of cues) {
    assert.ok(cue.dir === 1 || cue.dir === -1);
    assert.ok(text.includes(cue.quote));
  }
});
