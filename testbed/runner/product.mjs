// Starts one unchanged server.mjs per worker and calls /api/chat on it.
// One worker = one server process = one free key = one call at a time, so each product
// call owns the Attempts that capture.mjs writes while it runs.
import { spawn } from 'node:child_process';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { KEYS } from './env.mjs';

export const repo = fileURLToPath(new URL('../../', import.meta.url));
export const DEFAULT_CHAIN = ['gemini-2.5-flash-lite', 'gemini-2.5-flash']; // server.mjs:25 default

// arm: 'head' = deploy settings (default chain, 45 s, hub decision 2026-11-22);
//      'model:<id>' = one-model chain for model comparisons.
export function productSettings(arm) {
  if (arm.startsWith('model:')) {
    const id = arm.slice(6);
    return { requested_model: id, fallback_chain: [], timeout_ms: 45000 };
  }
  return { requested_model: 'gemini-3.5-flash', fallback_chain: DEFAULT_CHAIN, timeout_ms: 45000 };
}

export async function startProduct({ arm, keyIndex, attemptsFile }) {
  const s = productSettings(arm);
  const k = KEYS[keyIndex];
  if (!k) throw new Error(`no free key at index ${keyIndex}`);
  const port = 8790 + Math.floor(Math.random() * 900);
  // Only this worker's key. A blank-but-set value stops server.mjs from loading the others from .env.
  const env = {
    ...process.env, PORT: String(port), CAPTURE_LOG: attemptsFile,
    GEMINI_API_KEY: k.key, GEMINI_API_KEY_1: ' ', GEMINI_API_KEY_2: ' ',
    GEMINI_MODEL: s.requested_model, GEMINI_TIMEOUT_MS: String(s.timeout_ms),
    GEMINI_FALLBACK: s.fallback_chain.length ? s.fallback_chain.join(',') : s.requested_model,
  };
  const proc = spawn(process.execPath, ['--import', './testbed/runner/capture.mjs', 'server.mjs'], { cwd: repo, env, stdio: ['ignore', 'pipe', 'pipe'] });
  await new Promise((ok, fail) => {
    const t = setTimeout(() => fail(new Error('server did not start')), 10000);
    proc.stdout.on('data', (d) => { if (String(d).includes(`localhost:${port}`)) { clearTimeout(t); ok(); } });
  });
  proc.stderr.on('data', () => {});
  let seen = 0;
  const newAttempts = () => {
    if (!existsSync(attemptsFile)) return [];
    const lines = readFileSync(attemptsFile, 'utf8').trim().split('\n').filter(Boolean).map((l) => JSON.parse(l));
    const fresh = lines.slice(seen); // the file belongs to this worker only
    seen = lines.length;
    return fresh;
  };
  async function call(kind, summary, history) {
    newAttempts();
    const t0 = Date.now();
    const res = await fetch(`http://localhost:${port}/api/chat`, {
      method: 'POST', headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ kind, summary, history }),
    }).catch((e) => ({ ok: false, status: 0, json: async () => ({ error: String(e) }) }));
    const body = await res.json().catch(() => ({}));
    const att = newAttempts();
    const ok = att.filter((a) => a.status === 200);
    return {
      body, ok: res.ok && !body.error, status: res.status, latency_ms: Date.now() - t0,
      requested_model: s.requested_model, model: body.model ?? null,
      model_version: ok.length ? ok[ok.length - 1].modelVersion ?? null : null,
      calls: Math.max(att.length, 1), attempts: att,
      error: res.ok && !body.error ? null : body.error || `HTTP ${res.status}`,
    };
  }
  return { settings: s, key: k.name, call, stop: () => proc.kill() };
}
