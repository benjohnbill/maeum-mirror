// Gemini relay shared by the local server (server.mjs) and the Vercel functions (api/).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT, REPORT_PROMPT, TURN_SCHEMA, REPORT_SCHEMA } from '../public/js/prompt.js';
import { mockTurn, mockReport } from '../mock.mjs';

// Local runs read .env; on Vercel the keys come from the project's environment variables.
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
// Extra keys are tried when one key's quota runs out (429).
const KEYS = ['GEMINI_API_KEY', 'GEMINI_API_KEY_1', 'GEMINI_API_KEY_2'].map((k) => process.env[k]).filter(Boolean);
export const KEY = KEYS[0];
export const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const TIMEOUT = +process.env.GEMINI_TIMEOUT_MS || 45000;
// Tried in order when a model is overloaded (503) or rate-limited (429).
export const MODELS = [MODEL, ...(process.env.GEMINI_FALLBACK || 'gemini-2.5-flash-lite,gemini-2.5-flash').split(',').map((m) => m.trim())].filter((m, i, a) => m && a.indexOf(m) === i);

async function gemini(system, history, schema) {
  const contents = history.length
    ? history.map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] }))
    : [{ role: 'user', parts: [{ text: '(대화 시작: 데이터 요약에서 가장 눈에 띄는 변화로 첫 인사와 첫 질문을 해 주세요)' }] }];
  if (contents[0].role !== 'user') contents.unshift({ role: 'user', parts: [{ text: '(대화 시작)' }] });
  const bodyFor = (model) => JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      responseMimeType: 'application/json', responseSchema: schema, temperature: 0.7,
      // Gemini 3 models think by default; minimal thinking measured 19s vs ~30s on 2026-11-22.
      ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
    },
  });
  let last;
  for (const model of MODELS) {
    for (const [ki, key] of KEYS.entries()) {
      const t0 = Date.now();
      const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
        body: bodyFor(model),
        signal: AbortSignal.timeout(TIMEOUT),
      }).catch((e) => ({ ok: false, status: 0, text: async () => String(e) }));
      const secs = ((Date.now() - t0) / 1000).toFixed(1);
      if (res.ok) {
        const out = await res.json();
        const text = out.candidates?.[0]?.content?.parts?.filter((p) => !p.thought).map((p) => p.text).join('') || '';
        console.log(`${new Date().toLocaleTimeString('ko-KR')} ${model} key${ki} ${secs}s`);
        return { ...JSON.parse(text), model };
      }
      last = `Gemini ${model} key${ki} ${res.status} after ${secs}s: ${(await res.text()).replace(/\s+/g, ' ').slice(0, 120)}`;
      console.error(last);
      if (![0, 404, 429, 500, 503].includes(res.status)) throw new Error(last);
      // Quota (429) and model access (404) depend on the key; a timeout or overload is about the model.
      if (res.status !== 429 && res.status !== 404) break;
    }
  }
  throw new Error(last);
}

// Takes the parsed POST /api/chat body; returns the HTTP status and the JSON payload.
export async function chat(body) {
  try {
    const { kind, summary, history = [] } = body || {};
    if (typeof summary !== 'string' || summary.length > 4000) throw new Error('summary가 올바르지 않아요');
    const clean = history.slice(-40).map((h) => ({ role: h.role, text: String(h.text).slice(0, 2000) }));
    let out;
    if (!KEY) out = kind === 'report' ? mockReport(clean) : mockTurn(clean);
    else if (kind === 'report') {
      const transcript = clean.map((h) => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.text}`).join('\n');
      out = await gemini(`${REPORT_PROMPT}\n\n[데이터 요약]\n${summary}`, [{ role: 'user', text: `[대화 기록]\n${transcript}` }], REPORT_SCHEMA);
    } else out = await gemini(`${SYSTEM_PROMPT}\n\n[데이터 요약]\n${summary}`, clean, TURN_SCHEMA);
    return [200, { ...out, mode: KEY ? 'gemini' : 'demo' }];
  } catch (err) {
    console.error(err);
    return [502, { error: 'AI 응답을 받지 못했어요. 잠시 뒤 다시 보내 주세요.' }];
  }
}

export const status = () => ({ mode: KEY ? 'gemini' : 'demo', model: KEY ? MODEL : null });
