// Serves public/ and relays chat turns to Gemini so the API key stays on the server.
// Run: GEMINI_API_KEY=... node server.mjs   (no key -> scripted demo replies)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT, REPORT_PROMPT, SIGNALS_PROMPT, WHY_PROMPT, TURN_SCHEMA, REPORT_SCHEMA, SIGNALS_SCHEMA, WHY_SCHEMA } from './public/js/prompt.js';
import { groundedCues, cueWire } from './public/js/trait-estimates.js';
import { mockTurn, mockReport, mockSignals } from './mock.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const envFile = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    // A variable set in the shell wins, even when set to empty (GEMINI_API_KEY= runs the demo).
    if (m && !(m[1] in process.env)) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
// Extra keys are tried when one key's quota runs out (429).
const KEYS = ['GEMINI_API_KEY', 'GEMINI_API_KEY_1', 'GEMINI_API_KEY_2'].map((k) => process.env[k]).filter(Boolean);
const KEY = KEYS[0];
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const TIMEOUT = +process.env.GEMINI_TIMEOUT_MS || 45000;
// Tried in order when a model is overloaded (503) or rate-limited (429).
const MODELS = [MODEL, ...(process.env.GEMINI_FALLBACK || 'gemini-2.5-flash-lite,gemini-2.5-flash').split(',').map((m) => m.trim())].filter((m, i, a) => m && a.indexOf(m) === i);
// Clue reading runs mid-conversation. Measured 2026-11-23: gemini-3.5-flash 34s, gemini-2.5-flash-lite about 1.1s (3 runs).
const SIGNALS_MODELS = [process.env.GEMINI_SIGNALS_MODEL || 'gemini-2.5-flash-lite', ...MODELS].filter((m, i, a) => a.indexOf(m) === i);
const PORT = +process.env.PORT || 8787;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon' };

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
  for (const model of models) {
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

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200_000) throw new Error('요청이 너무 커요');
  }
  return JSON.parse(raw);
}

async function handleChat(req, res) {
  try {
    const { kind, summary, history = [], screeningAvailable = true, change = '' } = await readJson(req);
    if (kind !== 'signals' && kind !== 'why' && (typeof summary !== 'string' || summary.length > 4000)) throw new Error('summary가 올바르지 않아요');
    const clean = history.slice(-40).map((h) => ({ role: h.role, text: String(h.text).slice(0, 2000) }));
    let out;
    if (kind === 'signals') {
      // Clues for the last user message only. The browser grounds them again before recording.
      const last = clean.at(-1);
      if (!KEY || last?.role !== 'user') out = mockSignals();
      else {
        const read = await gemini(SIGNALS_PROMPT, clean, SIGNALS_SCHEMA, 0.2, SIGNALS_MODELS);
        out = { signals: groundedCues(read.traitSignals, last.text).map(cueWire), model: read.model };
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
    res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ ...out, mode: KEY ? 'gemini' : 'demo' }));
  } catch (err) {
    console.error(err);
    res.writeHead(502, { 'content-type': 'application/json; charset=utf-8' });
    res.end(JSON.stringify({ error: 'AI 응답을 받지 못했어요. 잠시 뒤 다시 보내 주세요.' }));
  }
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/api/chat') return handleChat(req, res);
  if (req.method === 'GET' && url.pathname === '/api/status') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify({ mode: KEY ? 'gemini' : 'demo', model: KEY ? MODEL : null }));
  }
  const path = normalize(join(root, decodeURIComponent(url.pathname === '/' ? '/index.html' : url.pathname)));
  if (!path.startsWith(root)) { res.writeHead(403); return res.end(); }
  try {
    if (!(await stat(path)).isFile()) throw 0;
    res.writeHead(200, { 'content-type': TYPES[extname(path)] || 'application/octet-stream' });
    res.end(await readFile(path));
  } catch {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('찾을 수 없어요');
  }
}).listen(PORT, () => console.log(`마음 시간표: http://localhost:${PORT}  (${KEY ? `Gemini ${MODELS.join(' → ')}` : '데모 응답 모드, GEMINI_API_KEY 없음'})`));
