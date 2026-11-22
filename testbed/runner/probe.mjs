// Quota probe: a few product-sized calls per free key and model.
// Logs status, latency, and the 429 quota message. Output: testbed/runs/probe-<time>.jsonl
// Run: node testbed/runner/probe.mjs [callsPerKeyForMainModel=3]
import { appendFileSync } from 'node:fs';
import { KEYS } from './env.mjs';
import { summaryFromXml } from './summary.mjs';
import { SYSTEM_PROMPT, TURN_SCHEMA } from '../../public/js/prompt.js';

const N = +process.argv[2] || 3;
const PLAN = [['gemini-3.5-flash', N], ['gemini-2.5-flash-lite', 1], ['gemini-2.5-flash', 1]];
const TIMEOUT = 45000;
const out = new URL(`../runs/probe-${new Date().toISOString().replace(/[:.]/g, '-')}.jsonl`, import.meta.url);
const summary = summaryFromXml(new URL('../../public/sample/export.xml', import.meta.url).pathname).text;

function body(model) {
  return JSON.stringify({
    systemInstruction: { parts: [{ text: `${SYSTEM_PROMPT}\n\n[데이터 요약]\n${summary}` }] },
    contents: [{ role: 'user', parts: [{ text: '(대화 시작: 데이터 요약에서 가장 눈에 띄는 변화로 첫 인사와 첫 질문을 해 주세요)' }] }],
    generationConfig: {
      responseMimeType: 'application/json', responseSchema: TURN_SCHEMA, temperature: 0.7,
      ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
    },
  });
}

async function call(k, model) {
  const t0 = Date.now();
  const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': k.key },
    body: body(model), signal: AbortSignal.timeout(TIMEOUT),
  }).catch((e) => ({ ok: false, status: 0, text: async () => String(e.name || e) }));
  const ms = Date.now() - t0;
  const rec = { at: new Date().toISOString(), key: k.name, model, status: res.status ?? 200, ms };
  if (res.ok) {
    const j = await res.json();
    rec.status = 200;
    rec.usage = j.usageMetadata;
    rec.modelVersion = j.modelVersion;
  } else {
    const t = (await res.text()).replace(/\s+/g, ' ');
    rec.error = t.slice(0, 600);
  }
  appendFileSync(out, JSON.stringify(rec) + '\n');
  console.log(`${rec.key.padEnd(17)} ${model.padEnd(22)} ${String(rec.status).padEnd(4)} ${(ms / 1000).toFixed(1)}s`);
  return rec;
}

// Keys in parallel, calls within one key in sequence.
await Promise.all(KEYS.map(async (k) => {
  for (const [model, n] of PLAN) for (let i = 0; i < n; i++) await call(k, model);
}));
console.log(`log: ${out.pathname}`);
