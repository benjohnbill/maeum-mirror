// Serves public/ and relays chat turns to Gemini so the API key stays on the server.
// Run: GEMINI_API_KEY=... node server.mjs   (no key -> scripted demo replies)
// The Gemini relay lives in lib/chat.mjs; Vercel serves the same code through api/.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize } from 'node:path';
import { fileURLToPath } from 'node:url';
import { chat, status, KEY, MODELS } from './lib/chat.mjs';

const root = fileURLToPath(new URL('./public/', import.meta.url));
const PORT = +process.env.PORT || 8787;
const TYPES = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.css': 'text/css; charset=utf-8', '.xml': 'application/xml', '.svg': 'image/svg+xml', '.png': 'image/png', '.webp': 'image/webp', '.ico': 'image/x-icon' };

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) {
    raw += chunk;
    if (raw.length > 200_000) throw new Error('요청이 너무 커요');
  }
  return JSON.parse(raw);
}

async function handleChat(req, res) {
  let code, body;
  try {
    [code, body] = await chat(await readJson(req));
  } catch (err) { // a bad or oversized request body; chat() itself never throws
    console.error(err);
    [code, body] = [502, { error: 'AI 응답을 받지 못했어요. 잠시 뒤 다시 보내 주세요.' }];
  }
  res.writeHead(code, { 'content-type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(body));
}

createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  if (req.method === 'POST' && url.pathname === '/api/chat') return handleChat(req, res);
  if (req.method === 'GET' && url.pathname === '/api/status') {
    res.writeHead(200, { 'content-type': 'application/json' });
    return res.end(JSON.stringify(status()));
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
