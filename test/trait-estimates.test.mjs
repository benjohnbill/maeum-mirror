import test from 'node:test';
import assert from 'node:assert/strict';
import { indicators, MAX_SIGNALS_PER_REPLY } from '../public/js/indicators.js';
import { cueTable, estimateFor, groundedSignals, localTraitSignals, newEstimates, recordSignals, recordTraitReply } from '../public/js/trait-estimates.js';
import { caseAnswers, previewSession } from '../public/js/preview-report.js';

const offlineIndicators = ['mood', 'resilience', 'worry', 'delay', 'social', 'rumination', 'recognition', 'recovery', 'pressure'];

test('each relevant answer changes only its evidenced indicators and duplicate quotes count once', () => {
  const ledger = newEstimates();
  for (const { id } of indicators) assert.deepEqual(estimateFor(ledger, id), { direction: 0, score: 50, count: 0, evidence: [] });
  const reply = '시작해야 하는데 자꾸 내일로 미뤄버렸어요. 시간이 촉박하면 오히려 집중이 잘돼요.';
  recordTraitReply(ledger, reply);
  const first = estimateFor(ledger, 'delay');
  assert.equal(first.direction, 1);
  assert.equal(first.evidence[0].item, 'delay.3');
  assert.match(first.evidence[0].cue, /내일하면 되지/);
  assert.equal(estimateFor(ledger, 'pressure').direction, 1);
  assert.equal(estimateFor(ledger, 'social').count, 0);
  recordTraitReply(ledger, reply);
  assert.deepEqual(estimateFor(ledger, 'delay'), first);
  recordTraitReply(ledger, '마감 전에 미리 해둬요.', true);
  const corrected = estimateFor(ledger, 'delay');
  assert.equal(corrected.direction, -1);
  assert.equal(corrected.count, 1);
  assert.equal(corrected.evidence[0].correction, true);
  assert.equal(estimateFor(ledger, 'pressure').direction, 1);
});

test('skips, questions, unrelated replies and third-person examples supply no local evidence', () => {
  for (const message of ['이 이야기는 건너뛸게요.', '해야 할 일을 자꾸 미뤄요?', '동료가 할 일을 자꾸 미뤄요.', '기억이 안 나요.', '오늘 점심에 김밥을 먹었어요.']) {
    assert.deepEqual(localTraitSignals(message), []);
  }
});

test('groundedSignals rejects unknown items, invented quotes and bad deltas, one per indicator', () => {
  const text = '지금도 그때 화났던 일이 떠올라요.';
  const valid = { indicator: 'rumination', item: 'rumination.0', quote: '그때 화났던 일이 떠올라요', delta: 11 };
  assert.deepEqual(groundedSignals(text, [
    { ...valid, quote: '다른 사람이 한 말' }, { ...valid, delta: 16 }, { ...valid, delta: 1.5 }, { ...valid, delta: 0 },
    { ...valid, item: 'phq9.1' }, { ...valid, item: 'rumination.9' }, { ...valid, indicator: 'topic' },
    { ...valid, quote: '그때' }, valid, { ...valid, delta: 4 },
  ]), [valid]);
  assert.deepEqual(groundedSignals(text, 'nope'), []);
});

test('groundedSignals keeps at most MAX_SIGNALS_PER_REPLY signals with the largest |delta|', () => {
  const text = '미뤘어요. 곱씹었어요. 칭찬이 좋아요. 긴장이 풀렸어요.';
  const signals = [
    { indicator: 'delay', item: 'delay.4', delta: 3, quote: '미뤘어요' },
    { indicator: 'rumination', item: 'rumination.0', delta: 12, quote: '곱씹었어요' },
    { indicator: 'recognition', item: 'recognition.0', delta: -9, quote: '칭찬이 좋아요' },
    { indicator: 'recovery', item: 'recovery.2', delta: 7, quote: '긴장이 풀렸어요' },
  ];
  const kept = groundedSignals(text, signals);
  assert.equal(MAX_SIGNALS_PER_REPLY, 3);
  assert.deepEqual(kept.map(s => s.indicator), ['rumination', 'recognition', 'recovery']);
});

test('recordSignals feeds estimateFor with cue text and no rank', () => {
  const ledger = newEstimates();
  const text = '짧은 답장을 보면 나를 피하나 싶어요';
  const signals = groundedSignals(text, [{ indicator: 'social', item: 'social.2', delta: 8, quote: '나를 피하나 싶어요' }]);
  const entry = recordSignals(ledger, text, signals, 'AI 대화 해석');
  assert.equal(ledger.last, entry);
  const estimate = estimateFor(ledger, 'social');
  assert.equal(estimate.rank, undefined);
  assert.deepEqual(estimate.evidence, [{ indicator: 'social', item: 'social.2', cue: '길게 보낸 메시지에 짧은 답장 하나가 왔어요.',
    delta: 8, quote: '나를 피하나 싶어요', source: 'AI 대화 해석', correction: false }]);
});

test('estimates saturate at 0 and 100, including after an opposing answer', () => {
  for (const sign of [1, -1]) {
    const ledger = newEstimates();
    for (let i = 0; i < 8; i++) {
      const text = '이번에 들려준 상황 ' + i;
      recordSignals(ledger, text, groundedSignals(text, [{ indicator: 'recognition', item: 'recognition.0', delta: sign * 15, quote: text }]), 'AI');
    }
    assert.equal(estimateFor(ledger, 'recognition').score, sign === 1 ? 100 : 0);
    const text = '반대 방향의 새로운 경험';
    recordSignals(ledger, text, groundedSignals(text, [{ indicator: 'recognition', item: 'recognition.0', delta: -sign * 10, quote: text }]), 'AI');
    assert.equal(estimateFor(ledger, 'recognition').score, sign === 1 ? 90 : 10);
  }
});

test('cue table covers every everyday question and only cue ids of the row', () => {
  const table = cueTable();
  for (const id of ['delay', 'social', 'rumination', 'recognition', 'recovery', 'pressure', 'resilience']) {
    assert.ok(table.some(row => row.indicator === id && row.item === id + '.0'), id);
  }
  assert.ok(table.every(row => row.cue && row.title));
  // PHQ-4 is an alt form of mood, but its GAD-7 items belong to worry.
  assert.ok(!table.some(row => row.indicator === 'mood' && row.item.startsWith('gad7.')));
  const keys = table.map(row => row.indicator + '|' + row.item);
  assert.equal(new Set(keys).size, keys.length);
});

test('both published examples produce offline evidence for every offline indicator from actual scripted replies', () => {
  for (const index of [0, 1]) {
    const ledger = newEstimates();
    const replies = caseAnswers(previewSession([{ id: 'workout' }]), index);
    for (const text of replies) recordTraitReply(ledger, text);
    for (const id of offlineIndicators) {
      const { evidence } = estimateFor(ledger, id);
      assert.ok(evidence.length, id);
      assert.ok(evidence.every(s => replies.some(text => text.includes(s.quote)) && s.item));
    }
  }
});
