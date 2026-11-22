// Preload for server.mjs (node --import): records every Gemini attempt without changing server.mjs.
// One JSONL line per attempt: requested model (from the URL), key slot, status, latency,
// response modelVersion, and the reply text so replay.mjs can match it to its sample.
import { appendFileSync } from 'node:fs';

const LOG = process.env.CAPTURE_LOG;
const realFetch = globalThis.fetch;
globalThis.fetch = async (url, init = {}) => {
  const u = String(url);
  const m = u.match(/generativelanguage\.googleapis\.com\/v1beta\/models\/([^:]+):generateContent/);
  if (!m || !LOG) return realFetch(url, init);
  const key = init.headers?.['x-goog-api-key'];
  const slot = ['GEMINI_API_KEY', 'GEMINI_API_KEY_1', 'GEMINI_API_KEY_2'].find((n) => process.env[n] === key) ?? 'other';
  const t0 = Date.now();
  const rec = { at: new Date().toISOString(), requested_model: m[1], key: slot };
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
