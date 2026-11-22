// Parity check: same /api/chat inputs to two product versions, Gemini stubbed (zero quota).
// Compares, per scenario, the Gemini request bodies, the Attempt sequence (model, key, status),
// and the /api/chat status and body.
// Run: node testbed/runner/parity.mjs <old commit> [new = working tree]
import { spawn, execSync } from 'node:child_process';
import { existsSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { repo } from './product.mjs';
import { KEYS } from './env.mjs';
import { summaryFromXml } from './summary.mjs';

const [oldRef, newRoot = repo] = process.argv.slice(2); // newRoot: a directory, default the working tree
if (!oldRef) { console.error('usage: parity.mjs <old commit>'); process.exit(1); }
const wt = `${tmpdir()}/maeum-parity-${oldRef}`;
if (!existsSync(wt)) execSync(`git worktree add --detach ${wt} ${oldRef}`, { cwd: repo, stdio: 'ignore' });
const capture = `${repo}testbed/runner/capture.mjs`;
const summary = summaryFromXml(`${repo}public/sample/export.xml`).text;
const hist = [{ role: 'model', text: '최근 2주 걸음이 절반쯤 줄었네요. 요즘 어땠어요?' }, { role: 'user', text: '그냥 바빴어요' }];

const SCENARIOS = [
  ['opener 200', '200', { kind: 'turn', summary, history: [] }],
  ['turn 200', '200', { kind: 'turn', summary, history: hist }],
  ['report 200', '200', { kind: 'report', summary, history: hist }],
  ['503 -> next model', '503,200', { kind: 'turn', summary, history: hist }],
  ['429 -> next key', '429,200', { kind: 'turn', summary, history: hist }],
  ['404 x3 -> next model', '404,404,404,200', { kind: 'turn', summary, history: hist }],
  ['400 stops', '400', { kind: 'turn', summary, history: hist }],
  ['all fail', '503', { kind: 'turn', summary, history: hist }],
  ['bad summary', '200', { kind: 'turn', summary: 5, history: [] }],
];

async function runOn(root, stub, input, tag) {
  const log = `${tmpdir()}/parity-${tag}-${process.pid}.jsonl`;
  rmSync(log, { force: true });
  const port = nextPort++;
  const env = { ...process.env, PORT: String(port), CAPTURE_LOG: log, CAPTURE_STUB: stub };
  KEYS.forEach((k) => { env[k.name] = k.key; });
  delete env.GEMINI_MODEL; delete env.GEMINI_FALLBACK; delete env.GEMINI_TIMEOUT_MS;
  const p = spawn(process.execPath, ['--import', capture, 'server.mjs'], { cwd: root, env, stdio: ['ignore', 'pipe', 'pipe'] });
  let err = '';
  p.stderr.on('data', (d) => { err += d; });
  await new Promise((ok, no) => {
    p.stdout.on('data', (d) => { if (String(d).includes(`:${port}`)) ok(); });
    p.on('exit', (c) => no(new Error(`server exited ${c}: ${err.slice(0, 300)}`)));
  });
  const res = await fetch(`http://localhost:${port}/api/chat`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(input) });
  const body = await res.text();
  await new Promise((ok) => { p.removeAllListeners('exit'); p.on('exit', ok); p.kill(); });
  const att = existsSync(log) ? readFileSync(log, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l)).map((a) => `${a.requested_model}/${a.key}/${a.status}/${a.body_sha}`) : [];
  return { status: res.status, body, att };
}

let nextPort = 9700 + Math.floor(Math.random() * 100) * 20;
let fail = 0;
for (const [name, stub, input] of SCENARIOS) {
  const a = await runOn(wt, stub, input, 'old');
  const b = await runOn(newRoot, stub, input, 'new');
  const same = a.status === b.status && a.body === b.body && JSON.stringify(a.att) === JSON.stringify(b.att);
  if (!same) fail++;
  console.log(`${same ? 'SAME' : 'DIFF'}  ${name.padEnd(22)} ${b.status} attempts=${b.att.length}${same ? '' : `\n  old ${a.status} ${a.body.slice(0, 80)} ${a.att.join(' ')}\n  new ${b.status} ${b.body.slice(0, 80)} ${b.att.join(' ')}`}`);
}
execSync(`git worktree remove --force ${wt}`, { cwd: repo, stdio: 'ignore' });
console.log(fail ? `${fail} scenario(s) differ` : `all ${SCENARIOS.length} scenarios identical`);
process.exit(fail ? 1 : 0);
