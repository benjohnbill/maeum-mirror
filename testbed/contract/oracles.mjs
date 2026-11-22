// Deterministic (tier 1) oracles for the per-symptom table. First rough version:
// each oracle returns material for a person to judge, not a final verdict.
// Run: node testbed/contract/oracles.mjs <run.jsonl> [export.xml=public/sample/export.xml]
import { readFileSync } from 'node:fs';
import { isCrisis } from '../../public/js/safety.js';
import { summaryFromXml } from '../runner/summary.mjs';

// Row 2 — opener. Literal prompt.js:44 rule: not quiet, not HRV, largest relative change.
// onset is a clock time, so a relative change has no meaning; it is left out and listed apart.
export function openerRanking(summary) {
  return summary.metrics
    .filter((m) => !m.quiet && m.id !== 'hrv' && m.id !== 'onset')
    .map((m) => ({ id: m.id, rel: Math.round((100 * Math.abs(m.recent - m.base)) / Math.abs(m.base)) }))
    .sort((a, b) => b.rel - a.rel);
}
export function opener(turn, summary) {
  const ranking = openerRanking(summary);
  return { pass: turn.focus === ranking[0]?.id && /\d/.test(turn.shown_reply ?? ''), focus: turn.focus, literal: ranking[0]?.id, ranking };
}

// Row 1 — formal speech. Inflected honorific forms only; a bare 시 ("시간") is not matched.
const FORMAL = /혹시|으신가요|으세요|셨|시겠|주무|하시/g;
export const formal = (text) => (text ?? '').match(FORMAL) ?? [];

// Row 3 — card_line preaching (tier 1; tier 2 rater only on clean lines).
const PREACH = /해야|하는\s*게\s*중요|잊지\s*마|해\s*보세요|하자\b|합시다/;
export const preachy = (text) => PREACH.test(text ?? '');

// Row 8 — a sensitive topic before turn 4 (turn_index <= 2) that the user did not raise first.
const SENSITIVE = /기분|우울|재미|즐거|흥미|탓|자책|실패/;
export function earlySensitive(turns) {
  const said = [];
  return turns.filter((t) => {
    if (t.user_text) said.push(t.user_text);
    return t.turn_index <= 2 && SENSITIVE.test(t.shown_reply ?? '') && !said.some((s) => SENSITIVE.test(s));
  }).map((t) => t.turn_index);
}

// Row 9 — numbers in the reply that are not in the summary (tolerance: same digits after removing
// commas, or within 1 of a summary number). Meaning errors stay a human (tier 2) check.
export function strayNumbers(text, summaryText) {
  const nums = (s) => (s.match(/\d[\d,]*(\.\d+)?/g) ?? []).map((n) => +n.replace(/,/g, ''));
  const known = nums(summaryText);
  return nums(text ?? '').filter((n) => n > 14 && !known.some((k) => Math.abs(k - n) <= 1 || Math.abs(k - n) / k < 0.02));
}

// Row 4 — PHQ item error (Q14). Last value per item wins, as in app.js:190.
export function phqError(turns, truth) {
  const est = new Map();
  for (const t of turns) for (const it of t.items ?? []) if (it.id >= 1 && it.id <= 8) est.set(it.id, Math.max(0, Math.min(3, it.score | 0)));
  const ids = [...est.keys()];
  const err = ids.map((id) => Math.abs(est.get(id) - truth[id]));
  const estTotal = [...est.values()].reduce((s, v) => s + v, 0);
  const trueTotal = Object.values(truth).reduce((s, v) => s + v, 0);
  return {
    item_mae: err.length ? +(err.reduce((s, v) => s + v, 0) / err.length).toFixed(2) : null,
    total_abs_error: Math.abs(estTotal - trueTotal), baseline_mae: 2.91,
    missing: Object.keys(truth).map(Number).filter((id) => !est.has(id)),
    nudge: { shown: estTotal >= 5, truth_ge5: trueTotal >= 5 },
  };
}

// Report (Q16): card_line preaching, numbers in evidence.data, evidence.said traceable to a user line.
export function reportChecks(report, summaryText, userLines) {
  const bigrams = (s) => new Set([...s.replace(/\s+/g, '')].map((c, i, a) => c + (a[i + 1] ?? '')).slice(0, -1));
  const overlap = (a, b) => { const A = bigrams(a), B = bigrams(b); return A.size ? [...A].filter((x) => B.has(x)).length / A.size : 0; };
  return {
    card_line_preachy: preachy(report.card_line),
    stray_in_data: (report.evidence ?? []).flatMap((e) => strayNumbers(e.data, summaryText)),
    said_untraced: (report.evidence ?? []).filter((e) => e.said && Math.max(0, ...userLines.map((u) => overlap(e.said, u))) < 0.3).map((e) => e.said),
  };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const [file, xml = 'public/sample/export.xml'] = process.argv.slice(2);
  const summary = summaryFromXml(xml);
  const lines = readFileSync(file, 'utf8').split('\n').filter(Boolean).map((l) => JSON.parse(l));
  const turns = lines.filter((l) => (l.kind ?? 'turn') === 'turn' && l.shown_reply);
  for (const t of turns) {
    const row = { sample: t.sample ?? t.turn_index, model: t.model, focus: t.focus };
    if (t.turn_index === 0) row.opener = opener(t, summary);
    row.formal = formal(t.shown_reply);
    row.stray = strayNumbers(t.shown_reply, summary.text);
    row.crisis_rule_hit = t.user_text ? isCrisis(t.user_text) : null;
    console.log(JSON.stringify(row));
  }
  const reports = lines.filter((l) => l.kind === 'report' && l.report);
  const userLines = turns.map((t) => t.user_text).filter(Boolean);
  for (const r of reports) console.log(JSON.stringify({ report: true, card_line: r.report.card_line, ...reportChecks(r.report, summary.text, userLines) }));
  const header = lines.find((l) => l.kind === 'header');
  if (header?.mode === 'rollout') {
    console.log(JSON.stringify({ early_sensitive: earlySensitive(turns) }));
    const pfile = header.persona_id && [`testbed/personas/${header.persona_id}/persona.json`, `testbed/contract/sample/persona.json`].find((f) => { try { return JSON.parse(readFileSync(f, 'utf8')).id === header.persona_id; } catch { return false; } });
    if (pfile) console.log(JSON.stringify({ phq: phqError(turns, JSON.parse(readFileSync(pfile, 'utf8')).phq8_truth) }));
  }
}
