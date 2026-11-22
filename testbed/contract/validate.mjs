// Checks a persona file or a run log against the lane C contract.
// Run: node testbed/contract/validate.mjs persona <persona.json>
//      node testbed/contract/validate.mjs runlog <run.jsonl>
import { readFileSync } from 'node:fs';
import { METRICS } from '../../public/spec/metrics.js';

const ARCHETYPES = ['Concordant low mood', 'Discordant', 'Benign change', 'Stable healthy'];
const GATES = ['direct', 'indirect', 'never'];
const TAGS = ['minimising', 'avoidance', 'short_answers', 'contradicts_data', 'over_disclosure'];
const ITEMS = ['1', '2', '3', '4', '5', '6', '7', '8'];

const errs = [];
const need = (ok, msg) => { if (!ok) errs.push(msg); };
const isInt = (v, lo, hi) => Number.isInteger(v) && v >= lo && v <= hi;

function persona(p) {
  need(/^[a-z0-9-]+$/.test(p.id ?? ''), 'id');
  need(ARCHETYPES.includes(p.archetype), 'archetype');
  for (const k of ITEMS) {
    need(isInt(p.phq8_truth?.[k], 0, 3), `phq8_truth.${k}`);
    need(GATES.includes(p.disclosure_gate?.[k]), `disclosure_gate.${k}`);
  }
  need(Object.keys(p.phq8_truth ?? {}).length === 8, 'phq8_truth has exactly 8 keys');
  need(Array.isArray(p.behavior_tags) && p.behavior_tags.every((t) => TAGS.includes(t)), 'behavior_tags');
  need(['accept', 'decline', 'ignore'].includes(p.offer_test), 'offer_test');
  need(p.expected_opener === null || p.expected_opener in METRICS, 'expected_opener');
  need(typeof p.health?.export === 'string' && typeof p.health?.generator === 'string', 'health');
  need(Array.isArray(p.provenance) && p.provenance.every((s) => typeof s === 'string'), 'provenance');
  need(typeof p.surface_style === 'string', 'surface_style');
}

function runlog(lines) {
  const [h, ...rest] = lines;
  const end = rest.pop();
  need(h?.kind === 'header', 'line 1 is the header');
  need(typeof h?.run_id === 'string', 'header.run_id');
  need(['rollout', 'replay'].includes(h?.mode), 'header.mode');
  need(h?.mode !== 'replay' || typeof h.prefix_id === 'string', 'header.prefix_id for replay');
  need(typeof h?.product?.requested_model === 'string' && Array.isArray(h.product.fallback_chain) && isInt(h.product.timeout_ms, 1, 1e6), 'header.product');
  need(h?.human === true || h?.mode === 'replay' ? h.simulator == null : h?.simulator?.model && h.simulator.model !== h.product?.requested_model, 'header.simulator differs from product model (J9); null for human or replay');
  need(['free', 'paid'].includes(h?.call_budget?.key_pool) && isInt(h.call_budget.planned_calls, 0, 1e6) && isInt(h.call_budget.demo_reserve_calls, 0, 1e6), 'header.call_budget');
  rest.forEach((l, i) => {
    const at = `line ${i + 2}`;
    need(['turn', 'report'].includes(l.kind), `${at}.kind`);
    need(isInt(l.turn_index, 0, 99), `${at}.turn_index`);
    need(typeof l.crisis_rule_hit === 'boolean', `${at}.crisis_rule_hit`);
    need(typeof l.requested_model === 'string', `${at}.requested_model`);
    need(l.model_version !== undefined && (l.model_version !== null || l.model_version_note), `${at}.model_version`);
    need(typeof l.fallback === 'boolean' && l.fallback === (l.model != null && l.model !== l.requested_model), `${at}.fallback`);
    need(isInt(l.calls, 0, 99), `${at}.calls`);
    need(l.output_rule_hit === (l.raw_reply != null && l.raw_reply !== l.shown_reply), `${at}.output_rule_hit`);
    if (l.kind === 'turn' && !l.crisis_rule_hit && !l.error) {
      need(l.focus === 'none' || l.focus in METRICS, `${at}.focus`);
      need(Array.isArray(l.items), `${at}.items`);
      need(['none', 'unclear', 'high'].includes(l.risk), `${at}.risk`);
    }
    if (l.kind === 'report' && !l.error) need(typeof l.report?.card_line === 'string', `${at}.report`);
  });
  need(end?.kind === 'end', 'last line is the end record');
  need(['done', 'max_turns', 'crisis', 'error', 'budget'].includes(end?.ended_by), 'end.ended_by');
  need(typeof end?.excluded === 'boolean' && (!end.excluded || end.exclude_reason), 'end.excluded');
  need(end?.calls_used === rest.reduce((s, l) => s + l.calls, 0), 'end.calls_used = sum of calls');
}

const [what, file] = process.argv.slice(2);
const text = readFileSync(file, 'utf8');
if (what === 'persona') persona(JSON.parse(text));
else if (what === 'runlog') runlog(text.split('\n').filter(Boolean).map((l) => JSON.parse(l)));
else { console.error('usage: validate.mjs persona|runlog <file>'); process.exit(2); }
console.log(errs.length ? `FAIL ${file}\n- ${errs.join('\n- ')}` : `OK ${file}`);
process.exit(errs.length ? 1 : 0);
