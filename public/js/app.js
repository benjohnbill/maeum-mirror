import { parseHealthFile } from './parse.js';
import { computeSummary, hhmm } from './metrics.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { isCrisis, checkReply, CRISIS_LINES } from './safety.js';
import { METRICS, STRENGTH_LABEL } from '../spec/metrics.js';
import { TESTS, scoreOf } from '../spec/tests/index.js';

const MAX_TURNS = 10;
const START = -180; // timetable starts at 21:00 (minutes from midnight)
const SPAN = 14 * 60; // to 11:00
const $ = (id) => document.getElementById(id);

const state = { summary: null, history: [], items: new Map(), turns: 0, busy: false, finished: false, test: null, crisis: false, offered: false };

/* ---------- Timetable ---------- */

function renderTable(el, nights, normal, { labels = true } = {}) {
  el.textContent = '';
  el.append(Object.assign(document.createElement('div'), { className: 'tt-corner' }));
  for (const n of nights) {
    const h = document.createElement('div');
    h.className = 'tt-head';
    h.innerHTML = `${n.label}<small>${labels && n.key ? `${+n.key.slice(5, 7)}/${+n.key.slice(8, 10)}` : '&nbsp;'}</small>`;
    el.append(h);
  }
  const hours = document.createElement('div');
  hours.className = 'tt-hours';
  for (let i = 0; i <= 14; i += 2) {
    const s = document.createElement('span');
    s.style.top = `${(i / 14) * 100}%`;
    s.textContent = i === 0 || i === 14 ? '' : `${(21 + i) % 24}시`;
    hours.append(s);
  }
  el.append(hours);
  nights.forEach((n, i) => {
    const col = document.createElement('div');
    col.className = 'tt-col';
    const g = normal[n.wd];
    if (g) col.append(block('blk blk-ghost', g.onset, g.wake));
    if (n.onset != null) {
      const b = block('blk blk-ink', n.onset, n.wake);
      b.style.animationDelay = `${i * 70}ms`;
      b.textContent = `${hhmm(n.onset)}`;
      b.title = `${n.label}요일 밤: ${hhmm(n.onset)}에 잠들어 ${hhmm(n.wake)}에 깸`;
      if (g && n.onset - g.onset >= 60) b.classList.add('late');
      col.append(b);
    }
    el.append(col);
  });
}

function block(cls, from, to) {
  const b = document.createElement('div');
  b.className = cls;
  const top = Math.max(0, (from - START) / SPAN);
  const bottom = Math.min(1, (to - START) / SPAN);
  b.style.top = `${top * 100}%`;
  b.style.height = `${Math.max(0.02, bottom - top) * 100}%`;
  return b;
}

function introTable() {
  const wd = ['월', '화', '수', '목', '금', '토', '일'];
  const normal = [];
  const nights = wd.map((label, i) => {
    const w = (i + 1) % 7;
    const weekend = label === '금' || label === '토';
    normal[w] = { onset: weekend ? 40 : 10, wake: weekend ? 500 : 430 };
    const late = [20, 95, 150, 30, 160, 210, 70][i];
    return { label, wd: w, key: '', onset: late, wake: late + [380, 300, 330, 350, 290, 280, 360][i] };
  });
  renderTable($('introTable'), nights, normal, { labels: false });
}

/* ---------- Focus: the conversation points at the data ---------- */

const SLEEPY = new Set(['sleep', 'onset', 'regularity']);
function setFocus(metric) {
  const tt = $('sessionTable');
  tt.classList.toggle('focus', metric === 'onset' || metric === 'regularity');
  tt.classList.toggle('focus-all', metric === 'sleep');
  for (const tr of $('metricsBody').children) tr.classList.toggle('on', tr.dataset.id === metric || (metric === 'onset' && tr.dataset.id === 'regularity'));
  if (metric && metric !== 'none' && !SLEEPY.has(metric) && matchMedia('(max-width: 900px)').matches === false) {
    $('metricsBody').querySelector(`[data-id="${metric}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/* ---------- Start ---------- */

async function start(file, isSample) {
  $('introError').hidden = true;
  $('progress').hidden = false;
  for (const b of document.querySelectorAll('.actions .btn')) b.setAttribute('disabled', '');
  try {
    const data = await parseHealthFile(file, (p) => {
      $('progressFill').style.width = `${Math.round(p * 100)}%`;
      $('progressText').textContent = `기록을 읽는 중 · ${Math.round(p * 100)}%`;
    });
    $('progressText').textContent = `기록 ${data.records.toLocaleString('ko-KR')}개를 읽었어요. 평소와 비교하는 중`;
    const summary = computeSummary(data);
    if (!summary || summary.metrics.length < 2) throw new Error('비교할 만큼의 기록이 없어요. 최근 3개월 동안 수면이나 걸음 기록이 있어야 해요.');
    state.summary = summary;
    openSession(isSample);
  } catch (err) {
    $('introError').textContent = err.message || '파일을 읽지 못했어요.';
    $('introError').hidden = false;
    $('progress').hidden = true;
    for (const b of document.querySelectorAll('.actions .btn')) b.removeAttribute('disabled');
  }
}

function openSession(isSample) {
  const s = state.summary;
  $('intro').hidden = true;
  $('session').hidden = false;
  $('sampleTag').hidden = !isSample;
  renderTable($('sessionTable'), s.recentNights, s.normal);
  const body = $('metricsBody');
  body.textContent = '';
  for (const m of s.metrics) {
    const tr = document.createElement('tr');
    tr.dataset.id = m.id;
    for (const v of [m.label, m.baseText, m.recentText, m.change || '–']) tr.append(Object.assign(document.createElement('td'), { textContent: v }));
    body.append(tr);
  }
  $('sentSummary').textContent = s.text;
  $('sentPrompt').textContent = SYSTEM_PROMPT;
  window.scrollTo(0, 0);
  updateTurns();
  aiTurn();
}

/* ---------- Chat ---------- */

function addMsg(role, text) {
  const li = document.createElement('li');
  li.className = `msg ${role}`;
  if (role === 'ai') li.append(Object.assign(document.createElement('span'), { className: 'who', textContent: '마음 시간표' }));
  li.append(Object.assign(document.createElement('p'), { textContent: text }));
  $('chat').append(li);
  li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  return li;
}

function updateTurns() {
  $('turnCount').textContent = state.finished ? '대화 끝' : `${state.turns} / ${MAX_TURNS}`;
  $('finishBtn').hidden = state.finished || state.turns < 3;
}

async function api(kind) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, summary: state.summary.text, history: state.history }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error || 'AI 응답을 받지 못했어요.');
  return body;
}

function busy(on) {
  state.busy = on;
  $('composer').querySelector('button').toggleAttribute('disabled', on);
  $('finishBtn').toggleAttribute('disabled', on);
}

function showError(message, retry) {
  const li = document.createElement('li');
  li.className = 'inline-error';
  li.textContent = message;
  const b = Object.assign(document.createElement('button'), { type: 'button', textContent: '다시 시도' });
  b.onclick = () => { li.remove(); retry(); };
  li.append(b);
  $('chat').append(li);
}

async function aiTurn() {
  busy(true);
  const typing = addMsg('ai', '데이터를 보고 있어요');
  typing.classList.add('typing');
  try {
    const out = await api('turn');
    typing.remove();
    const reply = checkReply(out.reply);
    state.history.push({ role: 'model', text: reply });
    addMsg('ai', reply);
    if (out.risk === 'high') { state.crisis = true; showCrisis(); }
    if (out.offer_test && !out.done && !state.test && !state.offered) { state.offered = true; addTestChips(); }
    for (const it of out.items || []) {
      if (it.id >= 1 && it.id <= 8) state.items.set(it.id, { score: Math.max(0, Math.min(3, it.score | 0)), why: it.why });
    }
    setFocus(out.focus);
    busy(false);
    if (out.done || state.turns >= MAX_TURNS) return report();
    $('msg').focus();
  } catch (err) {
    typing.remove();
    busy(false);
    showError(err.message, aiTurn);
  }
}

function showCrisis() {
  const li = document.createElement('li');
  li.className = 'crisis';
  li.innerHTML = '<p><strong>지금 많이 힘든 마음을 말해 줘서 고마워요.</strong> 이 이야기는 AI보다 사람이 들어야 해요. 지금 바로 전화하면 이야기를 들어 줄 사람이 있어요.</p>';
  const ul = document.createElement('ul');
  for (const c of CRISIS_LINES) {
    const a = document.createElement('a');
    a.href = `tel:${c.number.replace(/-/g, '')}`;
    a.innerHTML = `<span>${c.name} <small>· ${c.note}</small></span><strong>${c.number}</strong>`;
    const item = document.createElement('li');
    item.append(a);
    ul.append(item);
  }
  li.append(ul);
  li.append(Object.assign(document.createElement('p'), { className: 'fine', textContent: '이 안내는 AI가 아니라 정해진 규칙으로 나와요. 대화를 이어 가고 싶으면 아래에 다시 써 주세요.' }));
  $('chat').append(li);
  li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.busy || state.finished) return;
  const text = $('msg').value.trim();
  if (!text) return;
  $('msg').value = '';
  addMsg('user', text);
  if (isCrisis(text)) {
    // Fixed rule: the model is not called for this message.
    state.history.push({ role: 'user', text: '(사용자가 매우 힘든 마음을 이야기했고, 앱이 위기 상담 번호를 안내했어요. 내용은 전달하지 않아요.)' });
    state.items.set(9, { score: 1, why: 'safety' });
    state.crisis = true;
    showCrisis();
    return;
  }
  state.history.push({ role: 'user', text });
  state.turns++;
  updateTurns();
  aiTurn();
});

$('msg').addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) {
    e.preventDefault();
    $('composer').requestSubmit();
  }
});

$('finishBtn').addEventListener('click', () => { if (!state.busy) report(); });

/* ---------- Test router: short validated tests in a sheet ---------- */

function addTestChips() {
  const li = el('li', 'chips');
  for (const t of TESTS) {
    const b = el('button', 'chip', `${t.name} 짧은 검사 해 보기`);
    b.type = 'button';
    b.onclick = () => openTest(t);
    li.append(b);
  }
  $('chat').append(li);
  li.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
}

function openTest(t) {
  if (state.busy) return;
  const d = $('testSheet');
  const form = $('testForm');
  form.textContent = '';
  form.append(el('h2', null, t.name), el('p', 'sheet-pitch', t.pitch), el('p', 'sheet-inst', t.instruction));
  const answers = new Array(t.items.length).fill(null);
  const count = el('span', 'sheet-count', `0 / ${t.items.length}`);
  const submit = el('button', 'btn primary', '결과 보기');
  submit.type = 'submit';
  submit.disabled = true;
  t.items.forEach((text, i) => {
    const fs = el('fieldset', 'q');
    fs.append(el('legend', null, `${i + 1}. ${text}`));
    const opts = el('div', 'opts');
    for (const o of t.options) {
      const lab = el('label');
      const r = Object.assign(document.createElement('input'), { type: 'radio', name: `q${i}`, value: o.value, required: true });
      r.onchange = () => {
        answers[i] = o.value;
        const n = answers.filter((a) => a != null).length;
        count.textContent = `${n} / ${t.items.length}`;
        submit.disabled = n < t.items.length;
        // Move to the next unanswered question, so a phone user can tap through.
        const next = form.querySelectorAll('.q')[answers.findIndex((x, j) => x == null && j > i)];
        if (next) next.scrollIntoView({ block: 'start', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
      };
      lab.append(r, el('span', null, o.label));
      opts.append(lab);
    }
    fs.append(opts);
    form.append(fs);
  });
  const foot = el('div', 'sheet-foot');
  const cancel = el('button', 'btn ghost-btn', '닫기');
  cancel.type = 'button';
  cancel.onclick = () => d.close();
  foot.append(count, cancel, submit);
  form.append(foot, el('p', 'fine', t.attribution));
  form.onsubmit = (e) => {
    e.preventDefault();
    if (answers.some((a) => a == null)) return;
    d.close();
    finishTest(t, answers);
  };
  d.showModal();
  form.scrollTop = 0;
}

function finishTest(t, answers) {
  const r = scoreOf(t, answers);
  state.test = { test: t, ...r };
  for (const c of document.querySelectorAll('.chips')) c.remove();
  const li = el('li', 'msg user test-result');
  li.append(el('p', null, `${t.name} 결과: ${r.total}점 / ${r.max}점 · ${r.band}`));
  $('chat').append(li);
  if (r.safety) {
    // Fixed rule: item 9 is answered in code, the AI is not called for it.
    state.crisis = true;
    state.items.set(9, { score: 1, why: 'safety' });
    state.history.push({ role: 'user', text: `[검사 결과] ${t.name} 총 ${r.total}/${r.max}점, ${r.band}. 앱이 위기 상담 번호를 안내했어요. 문항별 답은 전달하지 않아요.` });
    showCrisis();
    return;
  }
  state.history.push({ role: 'user', text: `[검사 결과] 사용자가 직접 ${t.name} 검사를 했어요. 총 ${r.total}/${r.max}점, ${r.band}. 문항별 답은 전달하지 않아요.` });
  if (!state.finished) aiTurn();
}

// "/" in an empty composer lists the tests (a shortcut; the main entry is the AI's chip).
$('msg').addEventListener('input', () => {
  const menu = $('slashMenu');
  if ($('msg').value === '/' && !state.finished) {
    menu.textContent = '';
    for (const t of TESTS) {
      const b = el('button', null);
      b.type = 'button';
      b.append(el('strong', null, `/${t.id}`), el('span', null, t.pitch));
      b.onclick = () => { $('msg').value = ''; menu.hidden = true; openTest(t); };
      menu.append(b);
    }
    menu.hidden = false;
  } else menu.hidden = true;
});

/* ---------- Report: stacked, collapsible cards ---------- */

const METRIC_LABEL = Object.fromEntries(Object.entries(METRICS).map(([id, m]) => [id, m.label]));

async function report() {
  state.finished = true;
  updateTurns();
  $('composer').hidden = true;
  for (const c of document.querySelectorAll('.chips')) c.remove();
  busy(true);
  const typing = addMsg('ai', '지난 2주를 정리하고 있어요');
  typing.classList.add('typing');
  try {
    const r = await api('report');
    typing.remove();
    renderReport(r);
  } catch (err) {
    typing.remove();
    showError(err.message, report);
  } finally {
    busy(false);
  }
}

function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function card(title, { open = false, tag = null, cls = '' } = {}) {
  const d = el('details', `rc ${cls}`.trim());
  d.open = open;
  const s = el('summary');
  s.append(el('span', 'rc-title', title));
  if (tag) s.append(tag);
  d.append(s);
  const body = el('div', 'rc-body');
  d.append(body);
  return { d, body };
}

function badge(strength) {
  return el('span', `badge ${strength}`, STRENGTH_LABEL[strength]);
}

// Two bars on one scale: the user's normal and the last 2 weeks.
function compareBars(m) {
  const wrap = el('div', 'bars');
  const max = Math.max(Math.abs(m.base), Math.abs(m.recent)) || 1;
  for (const [label, v, text, cls] of [['평소', m.base, m.baseText, ''], ['최근 2주', m.recent, m.recentText, 'now']]) {
    const row = el('div', `bar-row ${cls}`.trim());
    const track = el('div', 'bar-track');
    const fill = el('i');
    fill.style.width = `${Math.max(4, (Math.abs(v) / max) * 100)}%`;
    track.append(fill);
    row.append(el('span', null, label), track, el('b', null, text));
    wrap.append(row);
  }
  return wrap;
}

function renderReport(r) {
  const li = el('li', 'report');
  const metricById = new Map(state.summary.metrics.map((m) => [m.id, m]));

  // 1. Hero: name, one line, the 2–3 numbers that carry it.
  const hero = el('section', 'rc-hero');
  hero.append(el('span', 'rc-kicker', '최근 2주의 나'), el('h2', 'type', r.type_name), el('p', 'type-line', r.type_line));
  const nums = el('dl', 'hero-nums');
  const shown = (r.evidence || []).map((e) => metricById.get(e.metric)).filter((m) => m && m.change).slice(0, 2);
  for (const m of shown) nums.append(numCell(m.label, m.change));
  if (state.test) nums.append(numCell(state.test.test.name, `${state.test.total}점`));
  if (nums.children.length) hero.append(nums);
  hero.append(el('p', 'fine', '별명은 최근 2주 숫자와 대화로 붙였어요. 진단이 아니에요.'));
  li.append(hero);

  // 2. Evidence: one card per metric, data paired with what the user said.
  for (const e of r.evidence || []) {
    const spec = METRICS[e.metric];
    const m = metricById.get(e.metric);
    const { d, body } = card(METRIC_LABEL[e.metric] || '대화', { tag: spec ? badge(spec.strength) : null });
    if (m) body.append(compareBars(m));
    body.append(el('p', null, e.data));
    if (e.said) body.append(el('p', 'said', e.said));
    if (spec) body.append(el('p', 'fine', `연구: ${spec.evidence}. ${spec.source}`));
    d.querySelector('summary').onclick = () => setFocus(e.metric);
    li.append(d);
  }

  // 3. Test result (only from the sheet, never estimated from the chat).
  if (state.test) {
    const t = state.test;
    const { d, body } = card(`${t.test.name} 검사 결과`, { open: true });
    const scale = el('div', 'scale');
    for (const b of t.test.bands) {
      const seg = el('span', b.label === t.band ? 'on' : '', b.label);
      seg.style.flex = String(b.max - b.min + 1);
      scale.append(seg);
    }
    const mark = el('i', 'scale-mark');
    mark.style.left = `${(t.total / t.max) * 100}%`;
    scale.append(mark);
    body.append(el('p', 'score', `${t.total}점 / ${t.max}점 · ${t.band}`), scale, el('p', 'fine', t.test.context));
    li.append(d);
  }

  // 4. Reflection and one small step (single-session shape: action, obstacle, plan).
  li.append(el('p', 'reflection', r.reflection));
  const step = el('section', 'step');
  step.append(el('strong', null, '이번 주 작은 실험'));
  const ol = el('dl');
  for (const [k, v] of [['해 볼 것', r.step?.action], ['막힐 만한 것', r.step?.obstacle], ['그때는', r.step?.plan]]) {
    if (v) ol.append(el('dt', null, k), el('dd', null, v));
  }
  step.append(ol);
  li.append(step);

  // 5. Nudge. Based on the test when there is one; otherwise a gentle offer, no number.
  const covered = [...state.items.entries()].filter(([id]) => id <= 8);
  const convo = covered.reduce((s, [, v]) => s + v.score, 0);
  const note = el('p', 'screen-note');
  if (state.crisis || (state.test && state.test.total >= 10)) {
    note.classList.add('heavy');
    note.innerHTML = '지난 2주 마음이 꽤 무거웠던 것 같아요. 혼자 견디기보다 이야기할 사람을 만나 보면 좋겠어요. <a href="tel:15770199">정신건강위기상담 1577-0199</a>, 가까운 정신건강복지센터, 학교나 회사의 상담실은 무료로 시작할 수 있어요.';
  } else if (!state.test && convo >= 5) {
    note.textContent = '대화 속에 조금 지친 신호가 몇 가지 있었어요. 숫자로 확인해 보고 싶으면 2분짜리 검사를 해 볼 수 있어요.';
    const b = el('button', 'chip', 'PHQ-9 짧은 검사 해 보기');
    b.type = 'button';
    b.onclick = () => openTest(TESTS[0]);
    note.append(' ', b);
  } else {
    note.textContent = '몸의 리듬이 돌아오는지 한 달 뒤에 다시 비춰 봐요.';
  }
  li.append(note);

  // 6. Method: how this was measured and how far it can be trusted.
  const { d: md, body: mb } = card('어떻게 쟀나요');
  mb.append(el('p', null, `최근 2주(${state.summary.recentFrom.replaceAll('-', '.')}~${state.summary.last.replaceAll('-', '.')})를 그 전 약 11주의 나와 비교했어요. 다른 사람의 평균과 비교하지 않았어요.`));
  const ul = el('ul', 'method');
  for (const m of state.summary.metrics) {
    const row = el('li');
    row.append(el('span', null, m.label), badge(METRICS[m.id].strength));
    ul.append(row);
  }
  mb.append(ul, el('p', null, '몸 데이터와 기분의 관련은 연구에서 작게 나타나요. 이 리포트는 판정이 아니라 대화의 출발점이에요. 대화에서 추정한 내용은 점수로 보여 주지 않아요.'));
  li.append(md);

  li.append(shareCard(r), el('p', 'card-hint', '이 카드는 캡처해서 공유해도 괜찮은 내용만 담았어요.'));
  $('chat').append(li);
  li.scrollIntoView({ block: 'start', behavior: 'smooth' });
  setFocus('none');
}

function numCell(label, value) {
  const f = document.createDocumentFragment();
  f.append(el('dt', null, label), el('dd', null, value));
  const w = el('div');
  w.append(f);
  return w;
}

function shareCard(r) {
  const card = el('div', 'card');
  card.append(el('span', 'card-brand', '마음 시간표'), el('strong', 'card-type', r.type_name), el('p', 'card-line', r.card_line));
  const mini = el('div', 'mini');
  for (const n of state.summary.recentNights) {
    const col = el('div');
    if (n.onset != null) {
      const i = el('i');
      i.style.top = `${Math.max(0, (n.onset - START) / SPAN) * 100}%`;
      i.style.height = `${(Math.min(SPAN, n.wake - START) - Math.max(0, n.onset - START)) / SPAN * 100}%`;
      col.append(i);
    }
    col.append(el('b', null, n.label));
    mini.append(col);
  }
  card.append(mini, el('span', 'card-foot', `${state.summary.last.replaceAll('-', '.')} 기준 · 지난 7일 밤`));
  return card;
}


/* ---------- Wire up ---------- */

introTable();
$('fileInput').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) start(f, false); });
$('sampleBtn').addEventListener('click', async () => {
  const res = await fetch('sample/export.xml');
  const blob = await res.blob();
  start(new File([blob], 'export.xml', { type: 'text/xml' }), true);
});
