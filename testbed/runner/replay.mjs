// Replay (FINAL.md Rollback, J10): one frozen Prefix, N samples, one product call per sample.
// Writes one contract run log (mode replay) with one turn line per sample.
// Run: node testbed/runner/replay.mjs <prefix.json> [--n=3] [--arm=head|model:<id>] [--context=no-summary|history:N]
//      [--keys=0] (one worker per entry) [--budget=30]
import { readFileSync } from 'node:fs';
import { startProduct, repo } from './product.mjs';
import { openRun, callLine, applyContext, armName, stamp } from './runlog.mjs';
import { summaryFromXml } from './summary.mjs';
import { isCrisis } from '../../public/js/safety.js';

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const prefixPath = args.find((a) => !a.startsWith('--'));
if (!prefixPath) { console.error('usage: replay.mjs <prefix.json> [--n=3] [--arm=head] [--context=..] [--keys=0] [--budget=30]'); process.exit(1); }
const N = +opt('n', 3), ARM = opt('arm', 'head'), CONTEXT = opt('context', ''), BUDGET = +opt('budget', 30);
const KEYS = opt('keys', ARM === 'head' ? '0' : '1,2').split(',').map(Number);
const prefix = JSON.parse(readFileSync(prefixPath, 'utf8'));
const summary = prefix.summary ?? summaryFromXml(repo + prefix.export).text;
const history = prefix.history ?? [];
const turnIndex = history.filter((h) => h.role === "model").length; // AI turns already in the prefix
const lastUser = [...history].reverse().find((h) => h.role === 'user')?.text ?? null;
const runId = `${prefix.id}-${armName(ARM, CONTEXT).replace(/[^a-z0-9.-]+/gi, '_')}-${stamp()}`;
const file = `${repo}testbed/runs/replay-${runId}.jsonl`;

const workers = await Promise.all(KEYS.map((k, i) => startProduct({ arm: ARM, keyIndex: k, attemptsFile: `${repo}testbed/runs/attempts-${runId}-w${i}.jsonl` })));
const w = openRun(file, {
  run_id: runId, mode: 'replay', persona_id: prefix.persona_id ?? null, arm: armName(ARM, CONTEXT), prefix_id: prefix.id,
  product: workers[0].settings, simulator: null, call_budget: { key_pool: 'free', planned_calls: Math.min(N, BUDGET), demo_reserve_calls: 0 },
});
let used = 0, lines = 0, next = 0, endedBy = 'done';
if (lastUser && isCrisis(lastUser)) {
  w({ kind: 'turn', turn_index: turnIndex, at: new Date().toISOString(), user_text: lastUser, crisis_rule_hit: true, requested_model: workers[0].settings.requested_model, model: null, model_version: null, fallback: false, calls: 0, latency_ms: 0, status: 0, error: null, raw_reply: null, shown_reply: null, output_rule_hit: false, focus: null, items: null, risk: null, offer_test: null, done: null, report: null, test_result: null });
  lines = 1; endedBy = 'crisis';
} else {
  const ctx = applyContext(CONTEXT, summary, history);
  await Promise.all(workers.map(async (p) => {
    while (next < N) {
      if (used >= BUDGET) { endedBy = 'budget'; return; }
      const i = next++;
      const r = await p.call('turn', ctx.summary, ctx.history);
      used += r.calls; lines++;
      w(callLine('turn', r, { turn_index: turnIndex, user_text: lastUser, sample: i }));
      console.log(`#${i} ${r.status} ${(r.latency_ms / 1000).toFixed(1)}s ${r.model}/${r.model_version} ${r.error ?? r.body.reply}`);
    }
  }));
}
w({ kind: 'end', turns: lines, ended_by: endedBy, excluded: false, exclude_reason: null, calls_used: used });
workers.forEach((p) => p.stop());
console.log(`log: ${file}`);
