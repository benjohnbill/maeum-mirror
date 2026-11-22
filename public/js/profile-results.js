// Published whole-sample percentiles. PHQ-2 and GAD-2 already use midranks (Löwe et al., Table 5).
const shortFormSource = 'https://pubmed.ncbi.nlm.nih.gov/19616305/';
const shortForms = {
  phq2: [25.6, 60.8, 80.7, 93.4, 97.2, 99.0, 99.7],
  gad2: [26.3, 64.5, 84.8, 95.2, 98.0, 99.2, 99.8],
};
const gad7Cumulative = [47.8, 60.5, 70.1, 76.7, 81.3, 85.9, 89.4, 93.2, 94.7, 95.7, 96.7, 97.5, 98, 98.5, 99, 99.2, 99.4, 99.6, 99.7, 99.8, 99.8, 100];

export function midPercentile(cumulative, score) {
  return ((cumulative[score - 1] ?? 0) + cumulative[score]) / 2;
}

function rankFromPercentile(percentile) {
  return Math.max(1, Math.min(100, Math.round(100.5 - percentile)));
}

// One measurement per topic. The longer matching instrument takes precedence over a short form.
const instrumentsByTopic = {
  mood: ['phq9', 'phq2'],
  worry: ['gad7', 'gad2'],
};

export function clinicalResult(topic, completed, age) {
  if (!Object.hasOwn(instrumentsByTopic, topic)) return null;
  const ids = instrumentsByTopic[topic];
  const related = [...ids, 'phq4'].map(id => completed.get(id)).filter(Boolean);
  const [test] = related;
  if (!test) return null;
  const combined = test.id === 'phq4';
  const id = combined ? ids[1] : test.id;
  const name = id.toUpperCase().replace(/(\d)/, '-$1');
  const score = combined ? test.subscores[id] : test.score;
  const max = combined ? 6 : test.max;
  let percentile, group, source, label, minAge, maxAge;
  if (id === 'phq9') {
    percentile = test.populationPercentile;
    group = '국내 성인'; source = test.source; label = test.sourceLabel; minAge = 19;
  } else if (id === 'gad7') {
    percentile = midPercentile(gad7Cumulative, score);
    group = '독일 조사'; minAge = 16;
    source = 'https://doi.org/10.3389/fpsyg.2025.1526181';
    label = '독일 일반 인구 GAD-7 분포 · 표 3';
  } else {
    percentile = shortForms[id][score];
    group = '독일 조사'; minAge = 14; maxAge = 92;
    source = shortFormSource; label = '독일 일반 인구 PHQ-2·GAD-2 백분위 · 표 5';
  }
  const inRange = age == null || (age >= minAge && (maxAge == null || age <= maxAge));
  const rank = inRange && Number.isFinite(percentile) ? rankFromPercentile(percentile) : null;
  const instrument = combined ? 'PHQ-4 중 ' + name : name;
  return { test, related, instrument, score, max, rank, group, source, label };
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
