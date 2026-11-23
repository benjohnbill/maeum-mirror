// Turns the testbed persona exports into phone-preview fixtures, one folder per persona.
// Run: node scripts/make-persona-samples.mjs <personas dir>
// (the personas live in the maeum-mirror checkout: testbed/personas)
import { readFileSync, readdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { createCollector } from '../public/js/parse.js';
import { computeSummary } from '../public/js/metrics.js';
import { writeReadFixtures } from './read-fixtures.mjs';

// The personas the demo offers, each with one line written from the printed baseline -> recent values.
const LINES = {
  p1: '최근 2주 잠이 2시간 넘게 줄고, 잠드는 시각이 40분쯤 늦어졌어요.',
  p2: '일주일에 세 번 하던 운동이 끊기고, 잠드는 시각이 한 시간쯤 늦어졌어요.',
  p3: '최근 2주 잠이 1시간 반쯤 줄었지만, 잠드는 시각은 평소와 비슷해요.',
};
// The phrases of each line that the picker underlines, in order, when that person is selected.
const MARKS = {
  p1: ['잠이 2시간 넘게 줄고', '40분쯤 늦어졌어요'],
  p2: ['운동이 끊기고', '한 시간쯤 늦어졌어요'],
  p3: ['잠이 1시간 반쯤 줄었지만', '평소와 비슷해요'],
};

const dir = process.argv[2];
if (!dir) throw new Error('usage: node scripts/make-persona-samples.mjs <personas dir>');
const sampleDir = new URL('../public/sample/', import.meta.url);
const personas = [];
for (const folder of readdirSync(dir).filter((name) => LINES[name.split('-')[0]]).sort()) {
  const id = folder.split('-')[0];
  const persona = JSON.parse(readFileSync(join(dir, folder, 'persona.json'), 'utf8'));
  const arg = (name) => persona.health.generator.match(new RegExp(`--${name} (\\S+)`))?.[1];
  const collector = createCollector();
  collector.feed(readFileSync(join(dir, folder, persona.health.export), 'utf8'));
  const summary = computeSummary(collector.data);
  const counts = writeReadFixtures(collector.data, summary.last, new URL(id + '/read/', sampleDir));
  const birth = arg('birth');
  const age = +summary.last.slice(0, 4) - +birth.slice(0, 4) - (summary.last.slice(5) < birth.slice(5) ? 1 : 0);
  personas.push({ id, name: arg('name'), age, line: LINES[id], marks: MARKS[id] });
  console.log(id, folder, summary.last, JSON.stringify(counts));
  for (const m of summary.metrics) console.log(`  ${m.label}: ${m.baseText} -> ${m.recentText}`);
}
writeFileSync(new URL('personas.json', sampleDir), JSON.stringify(personas, null, 2) + '\n');
