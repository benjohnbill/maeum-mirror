import { indicatorById } from './indicators.js';
import { testManifest } from './screening-router.js';

export function midPercentile(cumulative, score) {
  return ((cumulative[score - 1] ?? 0) + cumulative[score]) / 2;
}

function rankFromPercentile(percentile) {
  return Math.max(1, Math.min(100, Math.round(100.5 - percentile)));
}

const testName = (id) => testManifest[id]?.name ?? id.toUpperCase();

// The measured value for one profile card. The row's own test comes first, then its alt forms
// in the order indicators.js lists them. A combined form (PHQ-4) supplies the part whose key
// names one of the row's forms (phq2, gad2); a multi-trait form supplies the row's subscore.
// Only PHQ-9 has a Korean population table, so only PHQ-9 gets a rank ('등'). Every other
// test shows its raw score (or mean) and its band when the source publishes bands.
export function testResult(row, completed) {
  const forms = [row.test, ...(row.alt || [])].filter(Boolean);
  const related = forms.map((id) => completed.get(id)).filter(Boolean);
  const [test] = related;
  if (!test) return null;
  const key = test.id === row.test ? row.subscore : forms.find((id) => Object.hasOwn(test.subscores || {}, id));
  const score = key ? test.subscores[key] : test.score;
  const [min, max] = key ? test.subscoreRanges[key] : [test.min ?? 0, test.max];
  const instrument = key && key !== row.subscore ? testName(test.id) + ' 중 ' + testName(key) : testName(test.id);
  const measured = { test, related, instrument, score, min, max, method: (key ? test.subscoreMethods?.[key] : test.method) || 'sum', band: key ? null : test.band, rank: null };
  if (test.id === 'phq9' && !key) {
    if (Number.isFinite(test.populationPercentile)) measured.rank = rankFromPercentile(test.populationPercentile);
    Object.assign(measured, { group: '국내 성인', source: test.source, label: test.sourceLabel });
  }
  return measured;
}

// Kept for callers that name a card by its indicator id.
export function clinicalResult(topic, completed) {
  const row = indicatorById.get(topic);
  return row ? testResult(row, completed) : null;
}

// This comparison group exists only in the prototype. Its 100 example scores are
// spread evenly across the possible integer outcomes of the same exercise.
export function demoRank(score, min, max) {
  if (!Number.isFinite(score)) return null;
  let below = 0, tied = 0;
  for (let i = 0; i < 100; i++) {
    const other = min + Math.floor(i * (max - min + 1) / 100);
    if (other < score) below++;
    else if (other === score) tied++;
  }
  return rankFromPercentile(below + tied / 2);
}
