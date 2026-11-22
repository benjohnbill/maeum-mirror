// Experiments for the card demo. Reads each persona's raw export.xml, finds moments at
// several thresholds, simulates answers from persona.json, and compares nudge thresholds.
// Writes public/proto/moments.json (the card demo's data) for the chosen threshold.
// Usage: node scripts/find-moments.mjs [k]

import { readFileSync, writeFileSync, readdirSync } from 'node:fs';
import { createCollector } from '../public/js/parse.js';
import { findMoments, dataFlags, hiddenScore } from '../public/js/moments.js';

const DIR = new URL('../testbed/personas/', import.meta.url);
const CHOSEN_K = +(process.argv[2] || 2);
const people = readdirSync(DIR).filter((d) => /^p\d/.test(d)).sort().map((id) => {
  const c = createCollector();
  c.feed(readFileSync(new URL(`${id}/export.xml`, DIR), 'utf8'));
  return { id, data: c.data, persona: JSON.parse(readFileSync(new URL(`${id}/persona.json`, DIR), 'utf8')) };
});

// Experiment 1: how many moment days each threshold finds.
console.log('## Moments per threshold k (days, by kind)');
for (const k of [1.5, 2, 2.5]) {
  for (const p of people) {
    const f = findMoments(p.data, k);
    const by = (kind) => f.moments.filter((m) => m.kind === kind).length;
    console.log(`k=${k} ${p.id.padEnd(14)} late=${by('late')} short=${by('short')} still=${by('still')} noWorkout=${by('noWorkout')} flags=${JSON.stringify(dataFlags(f))}`);
  }
}

// Experiment 2: simulated answers. Truth, except "never" items answered 0 and a
// "minimising" persona answering one step lower on the rest.
const simulate = (persona) => [1, 2, 3, 4, 5, 6, 7, 8].map((i) => {
  const v = persona.phq8_truth[i];
  if (persona.disclosure_gate[i] === 'never') return 0;
  return persona.behavior_tags?.includes('minimising') ? Math.max(0, v - 1) : v;
});
console.log(`\n## Nudge at the end, k=${CHOSEN_K} (expected: p1 yes, p2 yes, p4 no, p3 report)`);
console.log('persona         said body | T=3 T=4 T=5 T=6 (said+body) | T=3 T=4 T=5 T=6 (said only)');
for (const p of people) {
  const f = findMoments(p.data, CHOSEN_K), ans = simulate(p.persona);
  const a = hiddenScore(ans, dataFlags(f), true), b = hiddenScore(ans, dataFlags(f), false);
  const row = (s) => [3, 4, 5, 6].map((t) => (s.total >= t ? ' Y ' : ' . ')).join(' ');
  console.log(`${p.id.padEnd(15)} ${String(a.said).padStart(4)} ${String(a.body).padStart(4)} | ${row(a)}             | ${row(b)}`);
}

const out = Object.fromEntries(people.map((p) => [p.id.slice(0, 2), { id: p.id, ...findMoments(p.data, CHOSEN_K) }]));
writeFileSync(new URL('../public/proto/moments.json', import.meta.url), JSON.stringify(out));
console.log(`\nwrote public/proto/moments.json (k=${CHOSEN_K})`);
