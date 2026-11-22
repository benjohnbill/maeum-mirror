// Validates every test that public/js/indicators.js names and writes public/tests/index.json.
// Run: node scripts/check-tests.mjs   (missing test files are listed as 'pending', not errors)
import { writeFileSync } from 'node:fs';
import { indicators } from '../public/js/indicators.js';
import { readForm } from '../public/js/screening-router.js';
import { ruleTerms, subscoreRule } from '../public/js/screening-forms.js';

// Topic labels the chat already uses for the original four tests.
const knownTopics = { phq9: '우울', gad2: '간단 불안', gad7: '불안', phq4: '우울·불안', phq2: '간단 우울' };

export function topicFor(id) {
  if (knownTopics[id]) return knownTopics[id];
  const rows = indicators.filter((row) => row.test === id);
  if (rows.length > 1) return rows[0].group;
  return (rows[0] || indicators.find((row) => row.alt?.includes(id)))?.title ?? id;
}

function optionValues(item) {
  return (item.options || []).map((option) => option.value).filter(Number.isFinite);
}

// Returns a list of problems. An empty list means the file is consistent.
export function checkForm(form) {
  const problems = [];
  const ids = form.items.map((item) => item.id);
  const seen = new Set();
  for (const id of ids) {
    if (seen.has(id)) problems.push('duplicate item id ' + id);
    seen.add(id);
  }
  for (const item of form.items) {
    if (item.missing) { problems.push('item ' + item.id + ' not found in ' + item.source); continue; }
    // Composed forms borrow items; their cues are checked in the source file.
    if (item.source === form.id && (typeof item.cue !== 'string' || !item.cue.trim())) problems.push('item ' + item.id + ' has no cue');
  }
  const scoring = form.scoring || {};
  if (!['sum', 'mean'].includes(scoring.method)) problems.push('scoring.method must be sum or mean');
  for (const id of scoring.reverse_items || []) if (!seen.has(id)) problems.push('reverse item ' + id + ' is not an item');
  const subscores = form.subscores || {};
  for (const [key, keys] of Object.entries(subscores)) {
    for (const id of keys) if (!seen.has(id)) problems.push('subscore ' + key + ' names unknown item ' + id);
  }
  for (const key of Object.keys(subscores)) {
    const rule = subscoreRule(form, key);
    if (!(rule.formula || rule.expr || rule.method === 'difference')) continue;
    const terms = ruleTerms(rule);
    if (!terms.length) problems.push('subscore ' + key + ' rule has an unknown shape');
    for (const [, term] of terms) if (!Object.hasOwn(subscores, term)) problems.push('subscore ' + key + ' rule names unknown ' + term);
  }
  const answerable = form.items.filter((item) => !item.missing && optionValues(item).length);
  if (answerable.length === form.items.length && form.items.length) {
    const lows = answerable.map((item) => Math.min(...optionValues(item)));
    const highs = answerable.map((item) => Math.max(...optionValues(item)));
    const add = (list) => list.reduce((a, b) => a + b, 0);
    const expected = scoring.method === 'mean'
      ? [add(lows) / lows.length, add(highs) / highs.length]
      : [add(lows), add(highs)];
    const range = scoring.range;
    if (!Array.isArray(range) || range.length !== 2) problems.push('scoring.range missing');
    else if (Math.abs(range[0] - expected[0]) > 1e-9 || Math.abs(range[1] - expected[1]) > 1e-9) {
      problems.push('scoring.range ' + JSON.stringify(range) + ' does not match options ' + JSON.stringify(expected));
    }
    for (const band of form.bands || []) {
      if (Array.isArray(range) && (band.min < range[0] || band.max > range[1])) problems.push('band ' + band.label + ' is outside the range');
    }
  } else if (form.korean_form_status !== 'pending') {
    problems.push('some items have no options');
  }
  return problems;
}

// Available when the Korean form is not pending and every item (including borrowed ones) has text.
function statusOf(form) {
  if (!form || form.korean_form_status === 'pending') return 'pending';
  const ready = form.items.length > 0 && form.items.every((item) => !item.missing && typeof item.text === 'string' && item.text.trim()
    && optionValues(item).length && item.form.korean_form_status !== 'pending');
  return ready ? 'available' : 'pending';
}

export async function buildManifest() {
  const ids = [...new Set(indicators.flatMap((row) => [row.test, ...(row.alt || [])]).filter(Boolean))];
  const entries = [];
  const problems = [];
  for (const id of ids) {
    const form = await readForm(id);
    if (form) for (const problem of checkForm(form)) problems.push(id + ': ' + problem);
    entries.push({ id, name: form?.name ?? id.toUpperCase(), topic: topicFor(id), length: form ? form.items.length : null, status: statusOf(form) });
  }
  return { entries, problems, missing: entries.filter((entry) => entry.length == null).map((entry) => entry.id) };
}

if (process.argv[1]?.endsWith('check-tests.mjs')) {
  const { entries, problems, missing } = await buildManifest();
  writeFileSync(new URL('../public/tests/index.json', import.meta.url), JSON.stringify(entries, null, 2) + '\n');
  for (const entry of entries) console.log(entry.status.padEnd(9) + ' ' + entry.id.padEnd(8) + ' ' + entry.name + ' · ' + entry.topic + ' · ' + (entry.length ?? '-') + '문항');
  if (missing.length) console.log('no file yet: ' + missing.join(', '));
  for (const problem of problems) console.error('problem: ' + problem);
  console.log('wrote public/tests/index.json (' + entries.length + ' tests, ' + problems.length + ' problems)');
  if (problems.length) process.exitCode = 1;
}
