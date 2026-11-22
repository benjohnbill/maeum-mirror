// Gemini relay shared by the local server (server.mjs) and the Vercel functions (api/).
import { existsSync, readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT, REPORT_PROMPT, SIGNALS_PROMPT, WHY_PROMPT, TURN_SCHEMA, REPORT_SCHEMA, SIGNALS_SCHEMA, WHY_SCHEMA } from '../public/js/prompt.js';
import { groundedCues, cueWire } from '../public/js/trait-estimates.js';
import { mockTurn, mockReport, mockSignals } from '../mock.mjs';

// Local runs read .env; on Vercel the keys come from the project's environment variables.
const envFile = fileURLToPath(new URL('../.env', import.meta.url));
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    // A variable set in the shell wins, even when set to empty (GEMINI_API_KEY= runs the demo).
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
// Extra keys are tried when one key's quota runs out (429).
const KEYS = ['GEMINI_API_KEY', 'GEMINI_API_KEY_1', 'GEMINI_API_KEY_2'].map((k) => process.env[k]).filter(Boolean);
export const KEY = KEYS[0];
// Measured 2026-11-23 04:20 on all 3 keys: gemini-3-flash-preview 200 in ~2.7s; 3.5-flash-lite and
// flash-lite-latest 200 in ~1.5s; 3.5-flash and 3.6-flash 429 (quota); 2.5 models 404 on keys 1-2.
export const MODEL = process.env.GEMINI_MODEL || 'gemini-3-flash-preview';
const TIMEOUT = +process.env.GEMINI_TIMEOUT_MS || 45000;
// Tried in order when a model is overloaded (503) or rate-limited (429).
export const MODELS = [MODEL, ...(process.env.GEMINI_FALLBACK || 'gemini-3.5-flash-lite,gemini-flash-lite-latest,gemini-3.1-flash-lite,gemini-3.5-flash,gemini-2.5-flash').split(',').map((m) => m.trim())].filter((m, i, a) => m && a.indexOf(m) === i);
// Clue reading runs mid-conversation. Measured 2026-11-23: gemini-3.5-flash 34s, gemini-2.5-flash-lite about 1.1s (3 runs).
const SIGNALS_MODELS = [process.env.GEMINI_SIGNALS_MODEL || 'gemini-3.5-flash-lite', ...MODELS].filter((m, i, a) => a.indexOf(m) === i);

// Routes are (model, key) pairs. A route that worked is tried first next time, and a route
// that hit quota (429) or no access (404) rests, so a judge's turn goes straight to a model that answers.
const resting = new Map(); // "model|key" -> time it may be tried again
const REST_MS = { 404: Infinity, 429: 10 * 60_000 };
let lastGood = null;

function routes(models) {
  const all = models.flatMap((model) => KEYS.map((key, ki) => ({ model, key, ki })));
  const now = Date.now();
  const open = all.filter((r) => !(resting.get(`${r.model}|${r.ki}`) > now));
  const usable = open.length ? open : all; // everything resting: try anyway rather than fail
  const good = lastGood && usable.find((r) => r.model === lastGood.model && r.ki === lastGood.ki && models.includes(r.model));
  return good ? [good, ...usable.filter((r) => r !== good)] : usable;
}

async function gemini(system, history, schema, temperature = 0.7, models = MODELS) {
  const contents = history.length
    ? history.map((h) => ({ role: h.role === 'user' ? 'user' : 'model', parts: [{ text: h.text }] }))
    : [{ role: 'user', parts: [{ text: '(대화 시작: 데이터 요약에서 가장 눈에 띄는 변화로 첫 인사와 첫 질문을 해 주세요)' }] }];
  if (contents[0].role !== 'user') contents.unshift({ role: 'user', parts: [{ text: '(대화 시작)' }] });
  const bodyFor = (model) => JSON.stringify({
    systemInstruction: { parts: [{ text: system }] },
    contents,
    generationConfig: {
      responseMimeType: 'application/json', responseSchema: schema, temperature,
      // Gemini 3 models think by default; minimal thinking measured 19s vs ~30s on 2026-11-22.
      ...(model.startsWith('gemini-3') ? { thinkingConfig: { thinkingLevel: 'minimal' } } : {}),
    },
  });
  let last;
  const skip = new Set(); // models that timed out or are overloaded in this call
  for (const { model, key, ki } of routes(models)) {
    if (skip.has(model)) continue;
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
      lastGood = { model, ki };
      return { ...JSON.parse(text), model };
    }
    last = `Gemini ${model} key${ki} ${res.status} after ${secs}s: ${(await res.text()).replace(/\s+/g, ' ').slice(0, 120)}`;
    console.error(last);
    if (![0, 400, 404, 429, 500, 503].includes(res.status)) throw new Error(last);
    // Quota (429) and model access (404) depend on the key; a timeout, overload or a setting the
    // model rejects (400) is about the model.
    if (REST_MS[res.status]) resting.set(`${model}|${ki}`, Date.now() + REST_MS[res.status]);
    else skip.add(model);
  }
  throw new Error(last);
}

// Takes the parsed POST /api/chat body; returns the HTTP status and the JSON payload. Never throws.
export async function chat(input) {
  try {
    const { kind, summary, history = [], screeningAvailable = true, change = '' } = input || {};
    if (kind !== 'signals' && kind !== 'why' && (typeof summary !== 'string' || summary.length > 4000)) throw new Error('summary가 올바르지 않아요');
    const clean = history.slice(-40).map((h) => ({ role: h.role, text: String(h.text).slice(0, 2000) }));
    let out;
    if (kind === 'signals') {
      // Clues for the last user message only. The browser grounds them again before recording.
      const last = clean.at(-1);
      if (!KEY || last?.role !== 'user') out = mockSignals();
      else {
        const read = await gemini(SIGNALS_PROMPT, clean, SIGNALS_SCHEMA, 0.2, SIGNALS_MODELS);
        // The reaction is shown as is: one plain sentence, no question, short.
        const reaction = typeof read.reaction === 'string' ? read.reaction.trim() : '';
        out = {
          signals: groundedCues(read.traitSignals, last.text).map(cueWire),
          reaction: reaction && !reaction.includes('?') && reaction.length <= 60 ? reaction : '',
          model: read.model,
        };
      }
    } else if (kind === 'why') {
      // Stage 2's second question: why the user's first answer happened. Cues that name no
      // cue-table row are dropped; fewer than 2 choices is a failure and the browser uses its bank.
      const question = clean.findLast((h) => h.role !== 'user')?.text;
      const answer = clean.findLast((h) => h.role === 'user')?.text;
      if (!KEY || !question || !answer) throw new Error('why: needs a key, the first question and the answer');
      const asked = `[변화] ${String(change).slice(0, 200)}\n[첫 질문] ${question}\n[사용자의 첫 답] ${answer}`;
      const read = await gemini(WHY_PROMPT, [{ role: 'user', text: asked }], WHY_SCHEMA, 0.7, SIGNALS_MODELS);
      const choices = (Array.isArray(read.choices) ? read.choices : [])
        .filter((choice) => typeof choice?.text === 'string' && choice.text.trim()).slice(0, 4)
        .map((choice) => ({ text: choice.text.trim(), cues: groundedCues(choice.cues).map(cueWire) }));
      if (typeof read.question !== 'string' || !read.question.trim() || choices.length < 2) throw new Error('why: fewer than 2 usable choices');
      out = { question: read.question.trim(), choices, model: read.model };
    } else if (!KEY) out = kind === 'report' ? mockReport(clean) : mockTurn(clean, undefined, screeningAvailable);
    else if (kind === 'report') {
      const transcript = clean.map((h) => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.text}`).join('\n');
      out = await gemini(`${REPORT_PROMPT}\n\n[데이터 요약]\n${summary}`, [{ role: 'user', text: `[대화 기록]\n${transcript}` }], REPORT_SCHEMA);
    } else {
      const screeningRule = screeningAvailable ? '' : '\n이 세션에서는 검사 제안을 이미 다뤘어요. 다시 권하지 말고 원래 대화를 이어가요. screening은 none이에요.';
      out = await gemini(`${SYSTEM_PROMPT}${screeningRule}\n\n[데이터 요약]\n${summary}`, clean, TURN_SCHEMA);
      if (out.screening && out.screening !== 'none') {
        const quote = out.screeningEvidence?.trim();
        const grounded = quote && clean.slice(-5).some((turn) => turn.role === 'user' && turn.text.includes(quote));
        if (!grounded || !screeningAvailable) {
          out = { reply: '방금 이야기한 장면에서 조금 더 들려주고 싶은 게 있나요?', focus: 'none', choices: [], screening: 'none', done: false };
        }
      }
    }
    return [200, { ...out, mode: KEY ? 'gemini' : 'demo' }];
  } catch (err) {
    console.error(err);
    return [502, { error: 'AI 응답을 받지 못했어요. 잠시 뒤 다시 보내 주세요.' }];
  }
}

export const status = () => ({ mode: KEY ? 'gemini' : 'demo', model: KEY ? MODEL : null });
