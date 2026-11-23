// Drives the phone segment: real OS cursor and keys through input.ahk, page reads through CDP,
// recording through the Openscreen CLI. Usage: node phone.mjs dry|rec
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const DIR = 'C:\\Users\\benjohnbill\\Videos\\herz-demo';
const AHK = 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe';
const OPENSCREEN = 'C:\\Users\\benjohnbill\\AppData\\Local\\Programs\\Openscreen\\Openscreen.exe';
const WIN = 'about:blank - Chrome';
const URL_TEXT = 'maeum-mirror.vercel.app';
const mode = process.argv[2] || 'dry';
const sleep = ms => new Promise(r => setTimeout(r, ms));

// --- input.ahk ---------------------------------------------------------------
const ahk = spawn(AHK, [DIR + '\\input.ahk'], { stdio: ['pipe', 'pipe', 'inherit'] });
const ahkLines = createInterface({ input: ahk.stdout });
const ahkQueue = [];
ahkLines.on('line', line => ahkQueue.shift()?.(line.trim()));
function cmd(...parts) {
  return new Promise(resolve => { ahkQueue.push(resolve); ahk.stdin.write(parts.join('\t') + '\n'); });
}

// --- CDP ---------------------------------------------------------------------
const targets = await (await fetch('http://127.0.0.1:9333/json')).json();
const ws = new WebSocket(targets.find(t => t.type === 'page').webSocketDebuggerUrl);
await new Promise(r => ws.addEventListener('open', r, { once: true }));
let nextId = 1;
const pending = new Map();
ws.addEventListener('message', e => {
  const msg = JSON.parse(e.data);
  if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
});
function cdp(method, params = {}) {
  const id = nextId++;
  return new Promise(resolve => { pending.set(id, resolve); ws.send(JSON.stringify({ id, method, params })); });
}
async function js(expression) {
  const r = await cdp('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true });
  if (r.result?.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description || 'eval failed');
  return r.result?.result?.value;
}
async function waitFor(expression, timeout = 20000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    try { if (await js(expression)) return; } catch {}
    await sleep(150);
  }
  throw new Error('timeout: ' + expression);
}

// --- geometry ------------------------------------------------------------------
let area;
async function calibrate() {
  const [, x, y, w, h, wx, wy, ww, wh] = (await cmd('client', HWND)).split(' ').map(Number);
  area = { x, y, w, h, wx, wy, ww, wh };
}
// The element expression must evaluate to a DOM element.
async function point(elementExpr) {
  const r = await js(`(() => { const el = ${elementExpr}; if (!el) return null;
    const b = el.getBoundingClientRect(); return { x: b.x + b.width / 2, y: b.y + b.height / 2, dpr: devicePixelRatio }; })()`);
  if (!r) throw new Error('no element: ' + elementExpr);
  return { x: Math.round(area.x + r.x * r.dpr), y: Math.round(area.y + r.y * r.dpr) };
}
async function pointBy(elementExpr, fx, dy = 0) {
  const r = await js(`(() => { const b = (${elementExpr}).getBoundingClientRect(); return { x: b.x + b.width * ${fx}, y: b.y + b.height / 2 + ${dy}, dpr: devicePixelRatio }; })()`);
  return { x: Math.round(area.x + r.x * r.dpr), y: Math.round(area.y + r.y * r.dpr) };
}
const zooms = [];
// Keep the zoomed view inside the window: past 0.38..0.62 the wallpaper shows at the edge.
const clamp = v => Math.min(0.62, Math.max(0.38, v));
// Zoom on an element's centre, as a fraction of the cropped window frame.
async function zoomOn(elementExpr, startMs, endMs, depth) {
  const p = await point(elementExpr);
  zooms.push({ id: 'z' + zooms.length, startMs, endMs, depth, focus: { cx: clamp((p.x - area.wx) / area.ww), cy: clamp((p.y - area.wy) / area.wh) }, focusMode: 'manual', source: 'manual' });
}
// Zoom on a screen point at a custom scale. The focus is held far enough from the
// edges that the zoomed view never leaves the window (0.06 = padding margin).
// Openscreen's CLI export reads only `depth` (customScale is ignored there), so the scale
// is snapped to the nearest depth. Depth 3 fits the phone to the frame height.
const DEPTH = { 1: 1.25, 2: 1.5, 3: 1.8, 4: 2.2, 5: 3.5, 6: 5 };
function zoomAt(x, y, startMs, endMs, scale) {
  const depth = Number(Object.keys(DEPTH).reduce((a, b) => Math.abs(DEPTH[b] - scale) < Math.abs(DEPTH[a] - scale) ? b : a));
  const lo = 0.5 / DEPTH[depth] + 0.03, edge = v => Math.min(1 - lo, Math.max(lo, v));
  zooms.push({ id: 'z' + zooms.length, startMs, endMs, depth,
    focus: { cx: edge((x - area.wx) / area.ww), cy: edge((y - area.wy) / area.wh) }, focusMode: 'manual', source: 'manual' });
}
const trims = [];
const speeds = [];
// Cursor: fast start, gentle arrival; duration grows with distance (input.ahk glide).
async function moveTo(elementExpr) { const p = await point(elementExpr); await cmd('glide', p.x, p.y); }
async function clickOn(elementExpr) { await moveTo(elementExpr); await sleep(140); await cmd('click'); }
function smoothScroll(targetExpr, ms, offset = 0) {
  return js(`new Promise(done => {
    const to = ${targetExpr}; const start = scrollY; const dest = Math.max(0, to + ${offset});
    const t0 = performance.now(); const ease = t => t < .5 ? 4*t*t*t : 1 - Math.pow(-2*t + 2, 3) / 2;
    const step = now => { const t = Math.min(1, (now - t0) / ${ms}); scrollTo(0, start + (dest - start) * ease(t));
      t < 1 ? requestAnimationFrame(step) : done(true); };
    requestAnimationFrame(step); })`);
}

// --- timeline log ---------------------------------------------------------------
let t0 = Date.now();
const marks = [];
const mark = (name) => { marks.push({ name, ms: Date.now() - t0 }); console.log(`[${((Date.now() - t0) / 1000).toFixed(2)}s] ${name}`); };

// --- recording ------------------------------------------------------------------
let rec;
async function startRecording() {
  rec = spawn(OPENSCREEN, ['record', '--display', '0', '--project', DIR + '\\phone.openscreen', '--json'], { stdio: ['pipe', 'pipe', 'ignore'] });
  const lines = createInterface({ input: rec.stdout });
  await new Promise((resolve, reject) => {
    rec.on('exit', code => reject(new Error('openscreen exited before recording: ' + code)));
    lines.on('line', l => {
      if (!l.startsWith('{')) return;
      const ev = JSON.parse(l);
      if (ev.event === 'log' && ev.message === 'Recording started') resolve();
      if (ev.event === 'error') reject(new Error(ev.message));
      if (ev.event === 'done') rec.done = ev;
    });
  });
}
async function stopRecording() {
  rec.stdin.write('stop\n');
  await new Promise(r => rec.on('exit', r));
  return rec.done;
}

// --- scene: phone login → quiz → talk → report → GAD-7 -----------------------------
const NAME = 'phone';
const SEED = `(() => { let a = 20261123; Math.random = () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; })();`;
const HWND = 'ahk_id ' + (await cmd('activate', WIN)).split(' ')[1];
// Openscreen scales zooms against the whole display, so this scene fills the display
// with the window and records it uncropped. The window goes back at the end.
await cmd('winmove', HWND, 0, 0, 3840, 2160);
await cdp('Page.enable');
await cdp('Network.enable');
await cdp('Network.setCacheDisabled', { cacheDisabled: true });   // always the deployed build
await cdp('Page.addScriptToEvaluateOnNewDocument', { source: SEED });
for (const u of ['https://maeum-mirror.vercel.app/', 'https://maeum-mirror.vercel.app/?view=phone']) await fetch(u).catch(() => {});
await cdp('Page.navigate', { url: 'https://maeum-mirror.vercel.app/?view=phone' });
await waitFor(`!!document.querySelector('#appleContinue') && document.querySelector('#appleContinue').getBoundingClientRect().width > 0`);
await sleep(800);
await calibrate();
console.log('area', area);

const V = `document.querySelector('#phoneViewport')`;
// Bring an element into the phone viewport before the cursor goes to it.
async function ensureVisible(expr) {
  const out = await js(`(() => { const el = ${expr}; const v = ${V}.getBoundingClientRect(); const b = el.getBoundingClientRect();
    if (b.top >= v.top + 40 && b.bottom <= v.bottom - 40) return false; el.scrollIntoView({ block: 'center', behavior: 'smooth' }); return true; })()`);
  if (out) await sleep(700);
}
async function tap(expr, ms = 450) { await ensureVisible(expr); await clickOn(expr, ms); }
const now = () => Date.now() - t0;
const aiCount = () => js(`document.querySelectorAll('#chat > li.ai:not(.thinking)').length`);
const thinkingOn = () => js(`!!document.querySelector('#chat > li.thinking')`);
// Wait for a new AI bubble. The wait itself (minus a short visible part) becomes a trim.
async function waitAi(n0, keepMs = 900) {
  const from = now();
  const end = Date.now() + 45000;
  while (Date.now() < end) {
    if ((await aiCount()) > n0 && !(await thinkingOn())) break;
    await sleep(150);
  }
  const to = now();
  if (to - from > keepMs + 400) trims.push({ id: 't' + trims.length, startMs: from + keepMs, endMs: to - 150 });
  await sleep(250);
}
// Hold long enough to read the newest AI bubble. Key beats pass a higher floor.
const lastAi = `[...document.querySelectorAll('#chat > li.ai:not(.thinking)')].pop()`;
async function readHold(minMs = 1300, perChar = 45, maxMs = 3200) {
  const len = await js(`(${lastAi}?.innerText || '').length`);
  await sleep(Math.min(maxMs, Math.max(minMs, len * perChar)));
}
// Pacing. Low-information stretches play faster (speedRegions); key beats hold and zoom.
async function fast(speed, fn) {
  const a0 = now();
  await fn();
  const a1 = now();
  if (a1 - a0 > 300) speeds.push({ id: 's' + speeds.length, startMs: a0, endMs: a1, speed });
}
// Zoom on an element for as long as fn runs.
async function focusOn(expr, scale, fn) {
  const p = await point(expr);
  const a0 = now();
  await fn();
  specials.push({ p, startMs: a0, endMs: now(), scale });
}
const lastBtn = (i) => `[...document.querySelectorAll('#chat > li:last-child button')][${i}]`;
// The script lines: typed at a readable pace, sent at once, the bubble held a moment.
// The script lines: typed at a readable pace, zoomed on the question and the input box
// (depth 4) from the first keystroke until the sent bubble has been seen. The AI's
// thinking dots afterwards play at normal speed.
const typingArea = `(() => { const q = ${lastAi}, c = document.querySelector('#composer');
  const a = (q || c).getBoundingClientRect(), b = c.getBoundingClientRect();
  return { getBoundingClientRect: () => ({ x: b.x, y: a.y, width: b.width, height: b.bottom - a.y }) }; })()`;
async function say(text) {
  const n0 = await aiCount();
  await focusOn(typingArea, 2.2, async () => {
    await tap(`document.querySelector('#msg')`);
    await sleep(150);
    await cmd('type', text, 70, 110);
    await sleep(200);
    await tap(`document.querySelector('#composer button[type=submit]')`);
    await sleep(1000);
  });
  await waitAi(n0, 1400);
}
// A click that may play fast: only the cursor travel and the click itself.
async function tapFast(expr, speed) {
  const a0 = now();
  await tap(expr);
  speeds.push({ id: 's' + speeds.length, startMs: a0, endMs: now(), speed });
}
// Quiz answers: only show that a quiz is happening, so short holds.
async function pick(i, speed = 1) {
  const n0 = await aiCount();
  if (speed > 1) await tapFast(lastBtn(i), speed); else await tap(lastBtn(i));
  await waitAi(n0, 200);
  await readHold(700, 15, 1100);
}
const specials = [];

const ph = await pointBy(V, 0.5, 0);
const vh = await js(`${V}.getBoundingClientRect().height * devicePixelRatio`);
// Unzoomed, the window sits in the padded frame at about 0.8 of its height; a zoom of s
// enlarges that by about s * 1.25. Aim for the phone at 0.9 of the frame height.
const PAD = 0.8, FILL = 1.25;
const base = 1.8;   // depth 3
// Neutral start: cursor beside the phone.
const phone0 = await pointBy(V, 1.6, 0);
await cmd('warp', phone0.x, phone0.y);
if (mode === 'rec') await startRecording();
t0 = Date.now();
mark('start');
await sleep(900);               // zoom into the phone plays here

// Login → health access: each new screen gets a moment to register; only the two taps
// inside the health sheet (모두 켜기 → 허용) play fast.
mark('login');
await tap(`document.querySelector('#appleContinue')`);
await waitFor(`!document.querySelector('#connectStep').hidden`);
await sleep(900);
await tap(`document.querySelector('#requestHealth')`);
await waitFor(`document.querySelector('#healthSheet').open`);
await sleep(900);
await fast(2, async () => {
  await tap(`document.querySelector('#toggleHealth')`);
  await sleep(250);
  await tap(`document.querySelector('#confirmHealth')`);
});
await waitFor(`!document.querySelector('#personaOverlay').hidden`);
await sleep(300);

// Who 민준 is: slow, zoomed.
mark('persona');
const persona = `document.querySelector('#personaChoices input[value=p1]').closest('label')`;
await sleep(700);   // let the sheet finish sliding in before measuring the card
await tap(persona);
if (!(await js(`document.querySelector('#personaChoices input[value=p1]').checked`))) {
  await sleep(400);
  await tap(persona);
}
if (!(await js(`document.querySelector('#personaChoices input[value=p1]').checked`))) throw new Error('민준 (p1) not selected');
// Picking 민준 underlines two phrases on the card, 0.35 s apart (about 1 s). Hold just long
// enough to see both lines drawn, then start.
await sleep(1150);
await tap(`document.querySelector('#personaStart')`);
await waitFor(`document.querySelectorAll('#chat > li.ai').length > 0`);
await readHold();

mark('opening');
await say('글쎄요, 그냥 평범한 편이에요. 딱히 문제는 없어요');
await readHold();
mark('quiz');
// First question at normal speed so the quiz reads as a quiz; after the first click it races.
await pick(1);
await pick(0, 3);
mark('quiz last');
await tapFast(lastBtn(0), 3);
{
  // Score bubble, then the agent's "reading the records" dots at normal speed.
  const from = now();
  await waitFor(`[...document.querySelectorAll('#chat > li:last-child button')].some(b => b.innerText.includes('잘 모르겠어요')) && !document.querySelector('#chat > li.thinking')`, 45000);
  const to = now();
  if (to - from > 3600) trims.push({ id: 't' + trims.length, startMs: from + 3000, endMs: to - 500 });
}

// The change the records found: the message of the video. Slow, zoomed.
mark('talk');
await focusOn(lastAi, 3.5, () => readHold(2600, 55, 4000));
await say('그때부터 프로젝트 마감이라 늦게까지 일했어요. 다들 그 정도는 하잖아요');
// The second "why": slow, zoomed.
await focusOn(lastAi, 3.5, () => readHold(2200, 55, 3800));
await say('할 일이 계속 밀려서요. 누워도 내일 할 일이 계속 떠올라서 잠이 안 와요');
await readHold();

// 'Making the report' card and the notice: speed through.
mark('report');
const notice = `[...document.querySelectorAll('.phone-notice')].find(n => n.getBoundingClientRect().height > 0)`;
await waitFor(`!!(${notice})`, 20000);
await sleep(700);   // the notice fades in over 520 ms; tap after it settles
await clickOn(notice);
await waitFor(`!document.querySelector('#resultPanel').hidden`);
await sleep(900);
const anxiety = `[...document.querySelectorAll('#resultPanel summary')].find(x => x.innerText.includes('불안'))`;
const anxietyCard = anxiety + `.closest('details')`;
await tap(anxiety, 350);
await sleep(300);
const off = await pointBy(V, 1.15, 0);
// '45등 → 37등': slow, zoomed.
await focusOn(anxiety, 2.2, async () => { await cmd('glide', off.x, off.y); await sleep(2300); });
const evidence = `[...${anxietyCard}.querySelectorAll('summary')].find(x => x.innerText.includes('어떤 답변'))`;
mark('evidence');
await tap(evidence, 300);
await sleep(250);
await focusOn(evidence + `.closest('details')`, 3.5, async () => { await cmd('glide', off.x, off.y); await sleep(2700); });

// GAD-7: shown as "a test is being taken", fast.
mark('test');
await fast(2, async () => {
  await tap(`[...${anxietyCard}.querySelectorAll('button')].find(b => b.innerText.includes('검사 시작'))`, 250);
  await waitFor(`document.querySelector('#screeningSheet')?.open`);
  await sleep(400);
  for (const a of [1, 2, 2, 1, 0, 1, 0]) {
    const at = await js(`document.querySelector('#screeningSheet').innerText.match(/(\\d) \\/ 7/)?.[1]`);
    await tap(`[...document.querySelectorAll('#screeningSheet button')].filter(b => /방해/.test(b.innerText))[${a}]`, 180);
    await waitFor(`!document.querySelector('#screeningSheet').open || document.querySelector('#screeningSheet').innerText.match(/(\\d) \\/ 7/)?.[1] !== '${at}'`, 5000).catch(() => {});
    await sleep(150);
  }
  await waitFor(`!document.querySelector('#screeningSheet').open`);
});
mark('result');
await sleep(300);
await ensureVisible(anxietyCard);
await focusOn(anxietyCard, 2.2, async () => { await cmd('glide', off.x, off.y); await sleep(2800); });
mark('end');

// Camera: the whole clip sits zoomed on the phone; key moments zoom deeper.
const endMs = now();
const cuts = [...specials];
cuts.sort((a, b) => a.startMs - b.startMs);
let from = 0;
for (const c of cuts) {
  if (c.startMs - from > 300) zoomAt(ph.x, ph.y, from, c.startMs, base);
  zoomAt(c.p.x, c.p.y, c.startMs, c.endMs, c.scale);
  from = c.endMs;
}
if (endMs - from > 300) zoomAt(ph.x, ph.y, from, endMs, base);
console.log('base zoom', base.toFixed(2), 'trims', trims.length);

let done = null;
if (mode === 'rec') {
  done = await stopRecording();
  // Display 0 is 3840x2160. Crop the project to the Chrome window.
  const { readFileSync } = await import('node:fs');
  const proj = JSON.parse(readFileSync(done.projectPath, 'utf8'));
  // The window fills the display. Crop 10 px inside its invisible resize border, as director.mjs does.
  const B = 10;
  proj.editor.cropRegion = { x: B / 3840, y: 0, width: (3840 - 2 * B) / 3840, height: (2160 - B) / 2160 };
  // Background B, same as the landing scene.
  proj.editor.wallpaper = 'linear-gradient(135deg, #e8d6c9 0%, #c8826a 100%)';
  proj.editor.shadowIntensity = 0.85;
  proj.editor.autoZoomEnabled = false;
  proj.editor.zoomRegions = zooms;
  proj.editor.trimRegions = trims;
  proj.editor.speedRegions = speeds;
  writeFileSync(done.projectPath, JSON.stringify(proj, null, 2));
}
await cmd('winmove', HWND, 480, 270, 2880, 1620);
writeFileSync(DIR + '\\' + NAME + '.marks.json', JSON.stringify({ area, marks, zooms, trims, speeds, done }, null, 2));
await cmd('quit');
ws.close();
console.log(done ? 'recorded ' + done.durationMs + 'ms → ' + done.projectPath : 'dry run done');
