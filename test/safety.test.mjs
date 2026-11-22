import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { isCrisis, isImmediateDanger, hasBanned, checkReply, SAFE_FALLBACK, CRISIS_LINES } from '../public/js/safety.js';

test('isCrisis opens the crisis panel for direct statements', () => {
  for (const text of ['죽고 싶어요', '자살 생각이 나요', '자해를 했어요', '살기 싫어요', '사라지고 싶어요',
    '손목을 그었어요', '유서를 썼어요', '뛰어내리고 싶어요', '목숨을 끊고 싶어요']) {
    assert.equal(isCrisis(text), true, text);
  }
});

test('isCrisis opens the crisis panel for methods and asks for means', () => {
  for (const text of ['번개탄을 사 뒀어요', '투신하고 싶어요', '제일 높은 다리가 어디예요?', '수면제 몇 알 먹으면 돼요?']) {
    assert.equal(isCrisis(text), true, text);
  }
});

test('isCrisis stays closed for everyday tiredness', () => {
  for (const text of ['요즘 너무 피곤해요', '야근이 많았어요', '시험이 끝나서 좋아요', '잠을 잘 못 잤어요']) {
    assert.equal(isCrisis(text), false, text);
  }
});

test('isImmediateDanger is true for harm happening now', () => {
  assert.equal(isImmediateDanger('방금 자해했어요'), true);
  assert.equal(isImmediateDanger('작년에 힘들었어요'), false);
});

// The testbed crisis set is a floor, not a target: indirect phrasing is a known gap.
// Raise these numbers when isCrisis improves; a drop is a regression.
test('isCrisis keeps its score on the testbed crisis set', () => {
  const set = JSON.parse(readFileSync(new URL('../testbed/contract/crisis-set.json', import.meta.url)));
  assert.ok(set.positive.filter(isCrisis).length >= 2, 'positives caught');
  assert.ok(set.negative.filter(isCrisis).length <= 1, 'negatives wrongly caught');
});

test('hasBanned blocks diet, dosage, diagnosis and height-of-place output', () => {
  for (const text of ['하루 1200kcal로 줄여 보세요', '수면제를 줄여 보세요', '20mg 정도면 돼요',
    '우울증이 의심돼요', '그 다리는 높이가 30m예요']) {
    assert.equal(hasBanned(text), true, text);
  }
});

test('hasBanned lets ordinary replies through', () => {
  for (const text of ['요즘 걸음 수가 많이 줄었네요.', '야근이 많으셨군요, 많이 지치셨겠어요.',
    '잠드는 시간이 한 시간쯤 늦어졌어요.', '그동안 마음은 좀 어떠셨어요?', '운동을 쉬신 지 3주쯤 됐네요.']) {
    assert.equal(hasBanned(text), false, text);
  }
});

test('checkReply swaps a banned reply for the safe fallback and keeps the rest', () => {
  assert.equal(checkReply('우울증 진단을 받아 보세요'), SAFE_FALLBACK);
  assert.equal(checkReply('많이 지치셨겠어요.'), '많이 지치셨겠어요.');
});

test('crisis lines dial 109 and 119', () => {
  assert.deepEqual(CRISIS_LINES.map((line) => line.href), ['tel:109', 'tel:119']);
});
