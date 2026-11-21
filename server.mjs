// Serves public/ and relays chat turns to Gemini so the API key stays on the server.
// Run: GEMINI_API_KEY=... node server.mjs   (no key -> scripted demo replies)
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { existsSync, readFileSync } from 'node:fs';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { SYSTEM_PROMPT, REPORT_PROMPT, TURN_SCHEMA, REPORT_SCHEMA } from './public/js/prompt.js';
import { mockTurn, mockReport } from './mock.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const envFile = fileURLToPath(new URL('./.env', import.meta.url));
if (existsSync(envFile)) {
  for (const line of readFileSync(envFile, 'utf8').split('\n')) {
    const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '');
  }
}
// Extra keys are tried when one key's quota runs out (429).
const KEYS = ['GEMINI_API_KEY', 'GEMINI_API_KEY_1', 'GEMINI_API_KEY_2'].map((k) => process.env[k]).filter(Boolean);
const KEY = KEYS[0];
const MODEL = process.env.GEMINI_MODEL || 'gemini-3.5-flash';
const TIMEOUT = +process.env.GEMINI_TIMEOUT_MS || 45000;
// Tried in order when a model is overloaded (503) or rate-limited (429).
const MODELS = [MODEL, ...(process.env.GEMINI_FALLBACK || 'gemini-2.5-flash,gemini-2.5-flash-lite').split(',').map((m) => m.trim())].filter((m, i, a) => m && a.indexOf(m) === i);
const PORT = +process.env.PORT || 8787;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.ico': 'image/x-icon' };

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
    const { kind, summary, history = [] } = await readJson(req);
    if (typeof summary !== 'string' || summary.length > 4000) throw new Error('summary가 올바르지 않아요');
    const clean = history.slice(-40).map((h) => ({ role: h.role, text: String(h.text).slice(0, 2000) }));
    let out;
    if (!KEY) out = kind === 'report' ? mockReport(clean) : mockTurn(clean);
    else if (kind === 'report') {
      const transcript = clean.map((h) => `${h.role === 'user' ? '사용자' : 'AI'}: ${h.text}`).join('\n');
      out = await gemini(`${REPORT_PROMPT}\n\n[데이터 요약]\n${summary}`, [{ role: 'user', text: `[대화 기록]\n${transcript}` }], REPORT_SCHEMA);
    } else out = await gemini(`${SYSTEM_PROMPT}\n\n[데이터 요약]\n${summary}`, clean, TURN_SCHEMA);
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
