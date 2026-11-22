// Preload for server.mjs (node --import): records every Gemini attempt without changing server.mjs.
// One JSONL line per attempt: requested model (from the URL), key slot, status, latency,
// response modelVersion, and the reply text so replay.mjs can match it to its sample.
import { appendFileSync } from 'node:fs';

import { createHash } from 'node:crypto';

const LOG = process.env.CAPTURE_LOG;
// CAPTURE_STUB="503,200": no network; each Gemini call takes the next status (parity checks, zero quota).
const STUB = process.env.CAPTURE_STUB ? process.env.CAPTURE_STUB.split(',').map(Number) : null;
const STUB_REPLY = { reply: 'STUB', focus: null, items: [], risk: 'none', offer_test: false, done: false };
const realFetch = STUB
  ? async (url, init) => {
    const status = STUB.length > 1 ? STUB.shift() : STUB[0];
    const model = String(url).match(/models\/([^:]+):/)[1];
    const text = JSON.stringify(STUB_REPLY);
    const body = status === 200 ? { modelVersion: model, candidates: [{ content: { parts: [{ text }] } }] } : { error: { code: status } };
    return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
  }
  : globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const m = u.match(/generativelanguage\.googleapis\.com\/v1beta\/models\/([^:]+):generateContent/);
  if (!m || !LOG) return realFetch(url, init);
  const key = init.headers?.['x-goog-api-key'];
  const slot = ['GEMINI_API_KEY', 'GEMINI_API_KEY_1', 'GEMINI_API_KEY_2'].find((n) => process.env[n] === key) ?? 'other';
  const t0 = Date.now();
  const rec = { at: new Date().toISOString(), requested_model: m[1], key: slot, body_sha: createHash('sha256').update(String(init.body)).digest('hex').slice(0, 16) };
  try {
    const res = await realFetch(url, init);
    rec.status = res.status;
    rec.ms = Date.now() - t0;
    if (res.ok) {
      const j = await res.clone().json();
      rec.modelVersion = j.modelVersion;
      rec.usage = j.usageMetadata;
      const text = j.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text).join('') || '';
      try { rec.reply = JSON.parse(text).reply; } catch {}
    }
    appendFileSync(LOG, JSON.stringify(rec) + '\n');
    return res;
  } catch (e) {
    rec.status = 0; rec.ms = Date.now() - t0; rec.error = String(e.name || e);
    appendFileSync(LOG, JSON.stringify(rec) + '\n');
    throw e;
  }
};
