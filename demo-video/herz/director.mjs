// Drives the landing segment: real OS cursor and keys through input.ahk, page reads through CDP,
// recording through the Openscreen CLI. Usage: node director.mjs dry|rec
import { spawn } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { createInterface } from 'node:readline';

const WIN_USER = process.env.USERNAME || process.env.USER;
const DIR = process.env.DEMO_DIR_WIN || `C:\\Users\\${WIN_USER}\\Videos\\herz-demo`;
const AHK = 'C:\\Program Files\\AutoHotkey\\v2\\AutoHotkey64.exe';
const OPENSCREEN = `C:\\Users\\${WIN_USER}\\AppData\\Local\\Programs\\Openscreen\\Openscreen.exe`;
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
function zoomAt(x, y, startMs, endMs, scale) {
  const lo = 0.5 / scale + 0.06, edge = v => Math.min(1 - lo, Math.max(lo, v));
  zooms.push({ id: 'z' + zooms.length, startMs, endMs, depth: 3, customScale: scale,
    focus: { cx: edge((x - area.wx) / area.ww), cy: edge((y - area.wy) / area.wh) }, focusMode: 'manual', source: 'manual' });
}
const trims = [];
const speeds = [];
async function moveTo(elementExpr, ms = 700) { const p = await point(elementExpr); await cmd('move', p.x, p.y, ms); }
async function clickOn(elementExpr, ms = 700) { await moveTo(elementExpr, ms); await sleep(120); await cmd('click'); }
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
  rec = spawn(OPENSCREEN, ['record', '--display', '0', '--project', DIR + '\\landing.openscreen', '--json'], { stdio: ['pipe', 'pipe', 'ignore'] });
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

// --- scene: blank → landing → demo ----------------------------------------------
const HWND = 'ahk_id ' + (await cmd('activate', WIN)).split(' ')[1];
await calibrate();
console.log('area', area);
// Neutral start: cursor in the middle of the blank page.
await cmd('warp', Math.round(area.x + area.w * 0.55), Math.round(area.y + area.h * 0.45));

for (const u of ['https://maeum-mirror.vercel.app/', 'https://maeum-mirror.vercel.app/?view=phone']) await fetch(u).catch(() => {});
if (mode === 'rec') await startRecording();
t0 = Date.now();
mark('start');
await sleep(500);

// Pacing follows information density (plan agreed 2026-11-23):
//   fast   1 address bar (2x speed)  4 scroll to report  6 return and demo click (cut)
//   medium 2 hero title (cursor rests, title is read)
//   slow   3 preview answer (slow cursor, the rank counts up)  5 evidence (static, underline draws)
// Address bar: 30 px above the page area, near the left of the toolbar.
// The camera starts zoomed on the address bar and pulls out on Enter.
const bar = { x: area.wx + Math.round(area.ww * 0.25), y: area.y - 30 };
await cmd('move', bar.x, bar.y, 450);
await sleep(80);
await cmd('click');
await cmd('key', '^a');
await sleep(150);
mark('type');
await cmd('type', URL_TEXT, 35, 75);
await sleep(250);
await cmd('key', '{Enter}');
mark('enter');
const enterMs = Date.now() - t0;
zoomAt(area.wx + area.ww * 0.2, area.y - 30, 0, enterMs, 2.0);
speeds.push({ id: 's0', startMs: 0, endMs: enterMs, speed: 2 });

await waitFor(`location.host === '${URL_TEXT}' && document.querySelectorAll('#landingCases .case-grid > *').length > 20 && document.querySelector('#previewReplies label')`);
mark('landing ready');
const readyMs = Date.now() - t0;
// Cut the loading wait, keep 0.4 s after Enter so the pull-out still plays.
if (readyMs - enterMs > 700) trims.push({ id: 't0', startMs: enterMs + 400, endMs: readyMs - 100 });
await calibrate();
// 2 Hero: the cursor glides to the title and rests while it is read.
await moveTo(`document.querySelector('#heroTitle')`, 800);
await sleep(1200);

// 3 Hero preview: a slow approach, then hold while the rank counts up (650 ms) and settles.
mark('preview');
const previewStart = Date.now() - t0;
await clickOn(`document.querySelectorAll('#previewReplies label')[1]`, 1100);
await sleep(2200);
await zoomOn(`document.querySelector('.preview-paper')`, previewStart + 200, Date.now() - t0, 2);

// 4 Example report: a quick scroll.
mark('scroll to report');
await smoothScroll(`document.querySelector('#example').getBoundingClientRect().top + scrollY`, 600, -40);
await sleep(150);
const resilienceCard = `[...document.querySelectorAll('#landingCases .case-grid > *')].find(c => c.innerText.split('\\n')[0].trim() === '회복탄력성')`;
const resilience = resilienceCard + `.querySelector('summary')`;

// 5 Evidence: open it, park the cursor beside the card, hold a still frame while the underline draws.
mark('open evidence');
const evidenceStart = Date.now() - t0;
await clickOn(resilience, 700);
await sleep(150);
const aside = await pointBy(resilienceCard, 1.12, 0);
await cmd('move', aside.x, aside.y, 500);
await sleep(3000);
await zoomOn(resilienceCard, evidenceStart + 500, Date.now() - t0, 3);

// 6 Close, return to the top and park near the button: all of it is cut, so the take jumps
// from the evidence to the demo button and only the click plays.
const cutStart = Date.now() - t0;
mark('cut start');
await clickOn(resilience, 300);
await smoothScroll('0', 500);
const btn = await pointBy(`document.querySelector('#experienceBtn')`, 0.5, 60);
await cmd('move', btn.x, btn.y, 250);
await sleep(200);
trims.push({ id: 't1', startMs: cutStart, endMs: Date.now() - t0 });
mark('start demo');
await clickOn(`document.querySelector('#experienceBtn')`, 350);
await sleep(900);
mark('end');

let done = null;
if (mode === 'rec') {
  done = await stopRecording();
  // Display 0 is 3840x2160. Crop the project to the Chrome window.
  const { readFileSync } = await import('node:fs');
  const proj = JSON.parse(readFileSync(done.projectPath, 'utf8'));
  // The Windows window rect includes an invisible ~7px resize border on the left, right and bottom; crop inside it.
  const B = 10;
  proj.editor.cropRegion = { x: (area.wx + B) / 3840, y: area.wy / 2160, width: (area.ww - 2 * B) / 3840, height: (area.wh - B) / 2160 };
  proj.editor.autoZoomEnabled = false;
  // Warm terracotta-sand backdrop that matches the product's accent; a stronger shadow keeps the light window's edge visible on it.
  proj.editor.wallpaper = 'linear-gradient(135deg, #e8d6c9 0%, #c8826a 100%)';
  proj.editor.shadowIntensity = 0.85;
  proj.editor.zoomRegions = zooms;
  proj.editor.trimRegions = trims;
  proj.editor.speedRegions = speeds;
  writeFileSync(done.projectPath, JSON.stringify(proj, null, 2));
}
writeFileSync(DIR + '\\landing.marks.json', JSON.stringify({ area, marks, zooms, trims, speeds, done }, null, 2));
await cmd('quit');
ws.close();
console.log(done ? 'recorded ' + done.durationMs + 'ms → ' + done.projectPath : 'dry run done');
