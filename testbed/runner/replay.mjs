// Frozen-prefix replay (FINAL.md Rollback, J10): one prefix, N samples, one POST /api/chat per sample.
// The product path is reused as is: server.mjs runs unchanged on its own port, and the reply
// goes through checkReply like app.js aiTurn. A prefix whose last user line hits isCrisis
// makes no call (app.js:229).
// Arms (hub decision 2026-11-22):
//   model  - one-model chain (GEMINI_FALLBACK = GEMINI_MODEL, server.mjs:25), server default timeout.
//   deploy - the deploy settings: GEMINI_TIMEOUT_MS=20000, default fallback chain. Use it for latency and fallback.
// capture.mjs is preloaded into the server to log each Gemini attempt with its response modelVersion.
// Only the three free keys in .env are used; the paid key is for the deploy.
// Run: node testbed/runner/replay.mjs <prefix.json> [--n=3] [--c=2] [--arm=model|deploy] [--model=gemini-3.5-flash]
// Logs: testbed/runs/replay-<prefix id>-<arm>-<time>.jsonl and the same name with -attempts.jsonl.
import { spawn } from 'node:child_process';
import { appendFileSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { summaryFromXml } from './summary.mjs';
import { isCrisis, checkReply } from '../../public/js/safety.js';

const args = process.argv.slice(2);
const prefixPath = args.find((a) => !a.startsWith('--'));
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.split('=')[1] ?? d;
if (!prefixPath) { console.error('usage: replay.mjs <prefix.json> [--n=3] [--c=2] [--arm=model|deploy] [--model=...]'); process.exit(1); }
const N = +opt('n', 3), C = +opt('c', 2), ARM = opt('arm', 'model'), MODEL = opt('model', 'gemini-3.5-flash');
if (!['model', 'deploy'].includes(ARM)) throw new Error(`unknown arm: ${ARM}`);
const repo = fileURLToPath(new URL('../../', import.meta.url));
const prefix = JSON.parse(readFileSync(prefixPath, 'utf8'));
const summary = prefix.summary ?? summaryFromXml(repo + prefix.export).text;
const history = prefix.history ?? [];
const turnIndex = history.filter((h) => h.role === 'user').length; // app.js state.turns before this AI turn
const lastUser = [...history].reverse().find((h) => h.role === 'user');
const out = `${repo}testbed/runs/replay-${prefix.id}-${ARM}-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`;
const attempts = out.replace(/\.jsonl$/, '-attempts.jsonl');
const PORT = 8790 + Math.floor(Math.random() * 100);

function log(rec) { appendFileSync(out, JSON.stringify(rec) + '\n'); }

if (lastUser && isCrisis(lastUser.text)) {
  log({ prefix_id: prefix.id, turn_index: turnIndex, crisis_rule_hit: true, called: false });
  console.log('isCrisis hit on the last user line: no model call (app.js rule).', out);
  process.exit(0);
}

// One server per run, own port. server.mjs itself is not changed.
const armEnv = ARM === 'model'
  ? { GEMINI_MODEL: MODEL, GEMINI_FALLBACK: MODEL }
  : { GEMINI_MODEL: MODEL, GEMINI_TIMEOUT_MS: '20000' }; // GEMINI_FALLBACK unset = server default chain
const env = { ...process.env, PORT: String(PORT), CAPTURE_LOG: attempts, ...armEnv };
if (ARM === 'deploy') delete env.GEMINI_FALLBACK;
const server = spawn(process.execPath, ['--import', './testbed/runner/capture.mjs', 'server.mjs'], {
  cwd: repo, env,
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
    prefix_id: prefix.id, arm: ARM, sample: i, turn_index: turnIndex, at: new Date().toISOString(),
    requested_model: MODEL, model: body.model ?? null, modelVersion: null, latency_ms: Date.now() - t0,
    crisis_rule_hit: false, status: res.status,
  };
  if (!res.ok || body.error) rec.error = body.error || `HTTP ${res.status}`;
  else {
    rec.raw_reply = body.reply;
    rec.shown_reply = checkReply(body.reply);
    rec.output_rule_hit = rec.shown_reply !== rec.raw_reply;
    rec.risk = body.risk; rec.offer_test = body.offer_test; rec.done = body.done;
    rec.focus = body.focus; rec.items = body.items;
    rec.fallback = rec.model !== MODEL; // model arm: must be false, a true sample is dropped
    rec.modelVersion = matchVersion(body.reply, body.model);
  }
  log(rec);
  console.log(`#${i} ${rec.status} ${(rec.latency_ms / 1000).toFixed(1)}s ${rec.model ?? ''}/${rec.modelVersion ?? '?'} ${rec.error ?? rec.shown_reply}`);
}

// The attempt whose reply text equals this sample's reply carries its modelVersion.
function matchVersion(reply, model) {
  let lines = [];
  try { lines = readFileSync(attempts, 'utf8').trim().split('\n').map((l) => JSON.parse(l)); } catch {}
  const hit = lines.filter((a) => a.status === 200 && a.reply === reply && a.requested_model === model);
  return hit.length ? hit[hit.length - 1].modelVersion ?? null : null;
}

let next = 0;
await Promise.all(Array.from({ length: Math.min(C, N) }, async () => { while (next < N) await sample(next++); }));
server.kill();
console.log(`log: ${out}\nattempts: ${attempts}`);
console.log(serverLog.join('').trim().split('\n').filter((l) => /Gemini|key/.test(l)).join('\n'));
