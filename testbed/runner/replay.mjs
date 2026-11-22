// Frozen-prefix replay (FINAL.md Rollback, J10): one prefix, N samples, one POST /api/chat per sample.
// The product path is reused as is: server.mjs is started with a one-model chain
// (GEMINI_FALLBACK = GEMINI_MODEL, server.mjs:25), and the reply goes through checkReply
// like app.js aiTurn. A prefix whose last user line hits isCrisis makes no call (app.js:229).
// Run: node testbed/runner/replay.mjs <prefix.json> [samples=3] [concurrency=2] [model=gemini-3.5-flash]
// Log: testbed/runs/replay-<prefix id>-<time>.jsonl (raw; the lane C run-log schema replaces it later).
import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { summaryFromXml } from './summary.mjs';
import { isCrisis, checkReply } from '../../public/js/safety.js';

const [prefixPath, nArg, cArg, modelArg] = process.argv.slice(2);
if (!prefixPath) { console.error('usage: replay.mjs <prefix.json> [samples] [concurrency] [model]'); process.exit(1); }
const N = +nArg || 3, C = +cArg || 2, MODEL = modelArg || 'gemini-3.5-flash';
const repo = fileURLToPath(new URL('../../', import.meta.url));
const prefix = JSON.parse(readFileSync(prefixPath, 'utf8'));
const summary = prefix.summary ?? summaryFromXml(repo + prefix.export).text;
const history = prefix.history ?? [];
const turnIndex = history.filter((h) => h.role === 'user').length; // app.js state.turns before this AI turn
const lastUser = [...history].reverse().find((h) => h.role === 'user');
const out = `${repo}testbed/runs/replay-${prefix.id}-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
const PORT = 8790 + Math.floor(Math.random() * 100);

function log(rec) { appendFileSync(out, JSON.stringify(rec) + '\n'); }

if (lastUser && isCrisis(lastUser.text)) {
  log({ prefix_id: prefix.id, turn_index: turnIndex, crisis_rule_hit: true, called: false });
  console.log('isCrisis hit on the last user line: no model call (app.js rule).', out);
  process.exit(0);
}

// One server per run, pinned model, own port. server.mjs itself is not changed.
const server = spawn(process.execPath, ['server.mjs'], {
  cwd: repo, env: { ...process.env, PORT: String(PORT), GEMINI_MODEL: MODEL, GEMINI_FALLBACK: MODEL },
  stdio: ['ignore', 'pipe', 'pipe'],
});
const serverLog = [];
server.stdout.on('data', (d) => serverLog.push(String(d)));
server.stderr.on('data', (d) => serverLog.push(String(d)));
await new Promise((ok, fail) => {
  const t = setTimeout(() => fail(new Error('server did not start')), 10000);
  server.stdout.on('data', (d) => { if (String(d).includes(`localhost:${PORT}`)) { clearTimeout(t); ok(); } });
});
const status = await (await fetch(`http://localhost:${PORT}/api/status`)).json();
if (status.mode !== 'gemini') { server.kill(); throw new Error('server is in demo mode: no key'); }

async function sample(i) {
  const t0 = Date.now();
  const res = await fetch(`http://localhost:${PORT}/api/chat`, {
    method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind: 'turn', summary, history }),
  }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e) }) }));
  const body = await res.json().catch(() => ({}));
  const rec = {
    prefix_id: prefix.id, sample: i, turn_index: turnIndex, at: new Date().toISOString(),
    requested_model: MODEL, model: body.model ?? null, latency_ms: Date.now() - t0,
    crisis_rule_hit: false, status: res.status,
  };
  if (!res.ok || body.error) rec.error = body.error || `HTTP ${res.status}`;
  else {
    rec.raw_reply = body.reply;
    rec.shown_reply = checkReply(body.reply);
    rec.output_rule_hit = rec.shown_reply !== rec.raw_reply;
    rec.risk = body.risk; rec.offer_test = body.offer_test; rec.done = body.done;
    rec.focus = body.focus; rec.items = body.items;
    rec.fallback = rec.model !== MODEL; // must be false; a true sample is dropped from model arms
  }
  log(rec);
  console.log(`#${i} ${rec.status} ${(rec.latency_ms / 1000).toFixed(1)}s ${rec.model ?? ''} ${rec.error ?? rec.shown_reply}`);
}

let next = 0;
await Promise.all(Array.from({ length: Math.min(C, N) }, async () => { while (next < N) await sample(next++); }));
server.kill();
console.log(`log: ${out}`);
console.log(serverLog.join('').trim().split('\n').filter((l) => /Gemini|key/.test(l)).join('\n'));
