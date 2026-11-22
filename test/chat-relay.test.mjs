import test from 'node:test';
import assert from 'node:assert/strict';

// The relay as the browser sees it, in demo mode (no Gemini key). A shell variable set to empty
// wins over .env, so these runs never call Gemini.
for (const k of ['GEMINI_API_KEY', 'GEMINI_API_KEY_1', 'GEMINI_API_KEY_2']) process.env[k] = '';
const { chat, status } = await import('../lib/chat.mjs');
const { default: chatHandler } = await import('../api/chat.js');
const { default: statusHandler } = await import('../api/status.js');

const summary = '걸음 수: 평소 8000보 → 최근 2주 4000보';
const history = [{ role: 'model', text: '요즘 어떠세요?' }, { role: 'user', text: '야근이 많았어요' }];

test('demo turn answers 200 with a reply and mode demo', async () => {
  const [code, body] = await chat({ kind: 'turn', summary, history });
  assert.equal(code, 200);
  assert.equal(body.mode, 'demo');
  assert.ok(typeof body.reply === 'string' && body.reply.trim());
});

test('demo report answers 200 in mode demo', async () => {
  const [code, body] = await chat({ kind: 'report', summary, history });
  assert.equal(code, 200);
  assert.equal(body.mode, 'demo');
});

test('demo signals answers 200 with a signals list, so the browser falls back to the cue table', async () => {
  const [code, body] = await chat({ kind: 'signals', history });
  assert.equal(code, 200);
  assert.ok(Array.isArray(body.signals));
});

test('demo why answers 502, so the browser uses its scripted question', async () => {
  const [code, body] = await chat({ kind: 'why', history, change: '걸음 수' });
  assert.equal(code, 502);
  assert.ok(body.error);
});

test('a turn without a usable summary answers 502 instead of throwing', async () => {
  for (const bad of [undefined, 5, 'x'.repeat(4001)]) {
    const [code] = await chat({ kind: 'turn', summary: bad, history: [] });
    assert.equal(code, 502);
  }
  assert.equal((await chat(null))[0], 502);
});

test('status reports demo mode with no model', () => {
  assert.deepEqual(status(), { mode: 'demo', model: null });
});

// Vercel's req and res, reduced to what the handlers use.
function fakeRes() {
  const res = { code: null, body: undefined };
  res.status = (code) => { res.code = code; return res; };
  res.json = (body) => { res.body = body; return res; };
  res.end = () => res;
  return res;
}

test('POST /api/chat on Vercel returns the relay answer', async () => {
  const res = fakeRes();
  await chatHandler({ method: 'POST', body: { kind: 'turn', summary, history } }, res);
  assert.equal(res.code, 200);
  assert.equal(res.body.mode, 'demo');
});

test('GET /api/chat on Vercel answers 405', async () => {
  const res = fakeRes();
  await chatHandler({ method: 'GET' }, res);
  assert.equal(res.code, 405);
});

test('GET /api/status on Vercel returns the status', () => {
  const res = fakeRes();
  statusHandler({ method: 'GET' }, res);
  assert.equal(res.code, 200);
  assert.deepEqual(res.body, { mode: 'demo', model: null });
});
