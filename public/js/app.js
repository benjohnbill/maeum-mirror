import { parseHealthFile } from './parse.js';
import { computeSummary, hhmm } from './metrics.js';
import { SYSTEM_PROMPT, PHQ8 } from './prompt.js';
import { isCrisis, CRISIS_LINES } from './safety.js';

const MAX_TURNS = 10;
const START = -180; // timetable starts at 21:00 (minutes from midnight)
const SPAN = 14 * 60; // to 11:00
const $ = (id) => document.getElementById(id);

const state = { summary: null, history: [], items: new Map(), turns: 0, busy: false, finished: false };

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
    state.history.push({ role: 'model', text: out.reply });
    addMsg('ai', out.reply);
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

/* ---------- Report ---------- */

const METRIC_LABEL = { sleep: '수면 시간', onset: '잠드는 시각', regularity: '수면 규칙성', steps: '걸음 수', rhr: '안정 시 심박', hrv: '심박변이도', workout: '운동' };

async function report() {
  state.finished = true;
  updateTurns();
  $('composer').hidden = true;
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

function renderReport(r) {
  const li = el('li', 'report');
  li.append(el('h2', 'type', r.type_name), el('p', 'type-line', r.type_line));

  const ev = el('ul', 'evidence');
  for (const e of r.evidence || []) {
    const row = el('li');
    const b = el('button', null, METRIC_LABEL[e.metric] || '대화');
    b.type = 'button';
    b.onclick = () => setFocus(e.metric);
    row.append(b, el('p', null, e.text));
    ev.append(row);
  }
  li.append(ev, el('p', null, r.reflection));
  const step = el('div', 'step');
  step.append(el('strong', null, '이번 주 작은 실험'), el('span', null, r.small_step));
  li.append(step);

  // Screening estimate stays on this screen only; it never goes on the card.
  const covered = [...state.items.entries()].filter(([id]) => id <= 8);
  const score = covered.reduce((s, [, v]) => s + v.score, 0);
  const note = el('p', 'screen-note');
  if (state.items.has(9) || score >= 10) {
    note.classList.add('heavy');
    note.innerHTML = '대화를 보면 지난 2주 동안 마음이 꽤 무거웠던 것 같아요. 혼자 견디기보다 이야기할 사람을 만나 보면 좋겠어요. <a href="tel:15770199">정신건강위기상담 1577-0199</a>, 가까운 정신건강복지센터, 학교나 회사의 상담실 모두 무료로 시작할 수 있어요.';
  } else if (score >= 5) {
    note.textContent = '대화 속에 조금 지친 신호가 몇 가지 있었어요. 2주 뒤에도 비슷하다면 가까운 사람이나 상담실에 이야기해 보세요.';
  } else {
    note.textContent = '대화에서는 크게 걱정할 신호가 보이지 않았어요. 몸의 리듬이 돌아오는지 한 달 뒤에 다시 비춰 봐요.';
  }
  li.append(note, el('p', 'fine', `이 결과는 짧은 대화에서 나온 추정이고 진단이 아니에요. 대화에서 다룬 주제 ${covered.length}/${PHQ8.length}개 기준.`));

  li.append(shareCard(r), el('p', 'card-hint', '이 카드는 캡처해서 공유해도 괜찮은 내용만 담았어요.'));
  $('chat').append(li);
  li.scrollIntoView({ block: 'start', behavior: 'smooth' });
  setFocus('none');
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
