import test from 'node:test';
import assert from 'node:assert/strict';
import { estimateFor, groundedSignals, localTraitSignals, newEstimates, recordTraitReply, traitAxes } from '../public/js/trait-estimates.js';
import { caseAnswers, previewSession } from '../public/js/preview-report.js';

test('each relevant answer changes only its evidenced axes and duplicate quotes count once', () => {
  const ledger = newEstimates();
  for (const id of Object.keys(traitAxes)) assert.equal(estimateFor(ledger, id).rank, 50);
  const reply = '시작해야 하는데 자꾸 내일로 미뤄버렸어요. 시간이 촉박하면 오히려 집중이 잘돼요.';
  recordTraitReply(ledger, reply);
  const first = estimateFor(ledger, 'delay');
  assert.ok(first.rank < 50);
  assert.ok(estimateFor(ledger, 'pressure').rank < 50);
  assert.equal(estimateFor(ledger, 'social').rank, 50);
  recordTraitReply(ledger, reply);
  assert.deepEqual(estimateFor(ledger, 'delay'), first);
  recordTraitReply(ledger, '마감 전에 미리 해둬요.', true);
  const corrected = estimateFor(ledger, 'delay');
  assert.ok(corrected.rank > 50);
  assert.equal(corrected.evidence.length, 1);
  assert.equal(corrected.evidence[0].correction, true);
  assert.ok(estimateFor(ledger, 'pressure').rank < 50);
});

test('skips, questions, unrelated replies and third-person examples supply no local evidence', () => {
  for (const message of ['이 이야기는 건너뛸게요.', '해야 할 일을 자꾸 미뤄요?', '동료가 할 일을 자꾸 미뤄요.', '기억이 안 나요.', '오늘 점심에 김밥을 먹었어요.']) {
    assert.deepEqual(localTraitSignals(message), []);
  }
});

test('AI changes require a genuine quote, known topic and bounded integer adjustment', () => {
  const text = '지금도 그때 화났던 일이 떠올라요.';
  const valid = { topic: 'rumination', quote: '그때 화났던 일이 떠올라요', delta: 11 };
  assert.deepEqual(groundedSignals(text, [
    {...valid, quote:'다른 사람이 한 말'}, {...valid, delta:16}, {...valid, delta:1.5},
    {...valid, topic:'phq9'}, valid, valid,
  ]), [valid]);
});

test('internal ranks saturate at 1 and 100, including after an opposing answer', () => {
  for (const sign of [1, -1]) {
    const ledger = newEstimates();
    for (let i = 0; i < 8; i++) {
      const text = '이번에 들려준 상황 ' + i;
      const entry = recordTraitReply(ledger, text);
      entry.signals = groundedSignals(text, [{ topic: 'recognition', delta: sign * 15, quote: text }]);
    }
    assert.equal(estimateFor(ledger, 'recognition').rank, sign === 1 ? 1 : 100);
    const entry = recordTraitReply(ledger, '반대 방향의 새로운 경험');
    entry.signals = groundedSignals(entry.text, [{ topic:'recognition', delta: -sign * 10, quote:entry.text }]);
    assert.equal(estimateFor(ledger, 'recognition').rank, sign === 1 ? 10 : 90);
  }
});

test('both published examples produce evidence for every topic from actual scripted replies', () => {
  for (const index of [0, 1]) {
    const ledger = newEstimates();
    const replies = caseAnswers(previewSession([{ id: 'workout' }]), index);
    for (const text of replies) recordTraitReply(ledger, text);
    for (const topic of Object.keys(traitAxes)) {
      const { evidence } = estimateFor(ledger, topic);
      assert.ok(evidence.length, topic);
      assert.ok(evidence.every(s => replies.some(text => text.includes(s.quote))));
    }
  }
});
