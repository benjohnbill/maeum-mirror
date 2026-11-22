import { el, resultCard, resultDetails } from './report-elements.js';
import { appendProfileCards, estimateModel } from './everyday-cards.js';
import { everydayTopics } from './everyday-topics.js';
import { newEstimates, recordTraitReply, groundedSignals, estimateFor } from './trait-estimates.js';
import { parseHealthFile } from './parse.js';
import { computeSummary, hhmm } from './metrics.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { isCrisis, isImmediateDanger, CRISIS_LINES } from './safety.js';
import { readName, readAge } from './preview-profile.js';
import { runScreening } from './phq9-sheet.js';
import { loadForm, scoreForm } from './screening-forms.js';
import { screeningCommand, screeners, offlineScreeningOffer } from './screening-router.js';
import { readPreviewHealth, setupPhoneAccess } from './phone-access.js';

import { workoutConcern, workoutStories, caseAnswers, previewSession, previewTurn, previewResult, recordText } from './preview-report.js';

const caseLinks = ['again', 'interest'];
const MAX_TURNS = 10;
const START = -180; // timetable starts at 21:00 (minutes from midnight)
const SPAN = 14 * 60; // to 11:00
const $ = (id) => document.getElementById(id);
const phonePreview = document.documentElement.classList.contains('phone-preview');

const state = { summary: null, history: [], turns: 0, busy: false, finished: false, supportRelevant: false, example: null, editing: false, traitResults: new Map(), estimates: newEstimates() };
const profile = { step: null, name: null, age: null };
const screening = { status: 'available', offered: [], results: new Map() };

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

function showLandingExamples() {
  const example = previewSession([{ id: 'workout' }]);
  const scenes = caseLinks.map((_, index) => {
    const estimates = newEstimates();
    for (const reply of caseAnswers(example, index)) recordTraitReply(estimates, reply);
    return estimates;
  });
  const featured = everydayTopics.find(topic => topic.id === 'social');
  const replies = $('previewReplies');
  for (const scene of scenes) {
    const { evidence } = estimateFor(scene, featured.id);
    if (!evidence.length) continue;
    const quote = evidence[0].quote;
    const label = el('label', 'preview-reply');
    const choice = el('input');
    choice.type = 'radio';
    choice.name = 'previewReply';
    choice.checked = !replies.querySelector('input');
    label.append(choice, el('span', '', quote));
    replies.append(label);
    function showReplyResult() {
      const estimates = newEstimates();
      recordTraitReply(estimates, quote);
      const { value, scale } = estimateModel(featured, estimates);
      $('heroResult').replaceChildren(resultCard({ label: featured.title, value, scale }));
    }
    choice.addEventListener('change', showReplyResult);
    if (choice.checked) showReplyResult();
  }
  for (const topic of everydayTopics) {
    const model = estimateModel(topic, scenes[0]);
    $('landingCases').append(resultCard({ ...model, label: topic.title }));
  }
}

/* ---------- Focus: the conversation points at the data ---------- */

const SLEEPY = new Set(['sleep', 'onset', 'regularity']);
function setFocus(metric, { scroll = true } = {}) {
  const tt = $('sessionTable');
  tt.classList.toggle('focus', metric === 'onset' || metric === 'regularity');
  tt.classList.toggle('focus-all', metric === 'sleep');
  for (const tr of $('metricsBody').children) tr.classList.toggle('on', tr.dataset.id === metric || (metric === 'onset' && tr.dataset.id === 'regularity'));
  if (scroll && !phonePreview && metric && metric !== 'none' && !SLEEPY.has(metric) && !matchMedia('(max-width: 900px)').matches) {
    $('metricsBody').querySelector(`[data-id="${metric}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' });
  }
}

/* ---------- Start ---------- */

async function start(file, isSample) {
  $('introError').hidden = true;
  $('progressFill').style.width = '0%';
  $('progressText').textContent = isSample ? '샘플 기록을 여는 중' : '기록을 읽는 중';
  $('progress').hidden = false;
  for (const b of document.querySelectorAll('.actions button.btn')) b.setAttribute('disabled', '');
  try {
    if (isSample) {
      const res = await fetch('sample/export.xml');
      if (!res.ok) throw new Error('샘플을 열 수 없어요. 잠시 뒤 다시 시도해 주세요.');
      file = new File([await res.blob()], 'export.xml', { type: 'text/xml' });
    }
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
    $('fileInput').value = '';
    for (const b of document.querySelectorAll('.actions button.btn')) b.removeAttribute('disabled');
  }
}

function openSession(isSample, sampleIndex, exampleScreening) {
  screening.results.clear();
  screening.status = 'available';
  screening.offered = [];
  state.supportRelevant = false;
  if (exampleScreening) screening.results.set(exampleScreening.id, exampleScreening);
  state.traitResults = new Map();
  state.estimates = newEstimates();
  const s = state.summary;
  state.example = isSample ? previewSession(s.metrics) : null;
  $('sentPanel').hidden = isSample;
  $('intro').hidden = true;
  $('introNav').hidden = true;
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
  if (phonePreview) {
    const primary = state.example?.metric || s.metrics[0];
    $('sessionTable').hidden = !s.recentNights.some((night) => night.asleep != null);
    $('recordPanel').querySelector('.panel-head').hidden = $('sessionTable').hidden;
    const overview = el('div', 'phone-overview');
    overview.append(el('h1', '', '최근 2주 ' + primary.label), el('strong', '', primary.recentText), el('p', '', '평소 ' + primary.baseText));
    $('recordPanel').prepend(overview);
    const next = el('button', 'btn primary record-next', '대화 이어보기');
    next.id = 'recordNext';
    next.type = 'button';
    next.addEventListener('click', () => {
      const tab = $('resultButton').hidden ? $('chatButton') : $('resultButton');
      tab.click();
      tab.focus({ preventScroll: true });
    });
    overview.append(next);
    showPhonePanel('chatPanel');
    $('msg').placeholder = '내 이야기로 답하기';
  }
  if (sampleIndex !== undefined) {
    // A public example result can also be opened from its landing-page story.
    for (const reply of caseAnswers(state.example, sampleIndex)) {
      const question = previewTurn(state.example).reply;
      addMsg('ai', question);
      addMsg('user', reply);
      state.history.push({ role: 'model', text: question }, { role: 'user', text: reply });
      recordTraitReply(state.estimates, reply);
      state.example.answers.push(reply);
      state.turns++;
    }
    report();
  } else {
    aiTurn();
  }
}

/* ---------- Chat ---------- */

function revealChatItem(item, block = 'nearest') {
  if (phonePreview) {
    const chat = $('chat');
    chat.scrollTo({ top: chat.scrollHeight, behavior: 'instant' });
  } else {
    item.scrollIntoView({ block, behavior: 'instant' });
  }
}

function addMsg(role, text, actions) {
  $('chat').querySelector('.scene-replies')?.remove();
  const li = document.createElement('li');
  li.className = `msg ${role}`;
  if (role === 'ai') li.append(Object.assign(document.createElement('span'), { className: 'who', textContent: '마음 시간표' }));
  li.append(Object.assign(document.createElement('p'), { textContent: text }));
  if (actions) {
    li.classList.add('with-actions');
    li.append(actions);
  }
  $('chat').append(li);
  revealChatItem(actions || li);
  return li;
}

function updateTurns() {
  $('turnCount').textContent = state.finished ? '대화 끝' : `${state.turns} / ${MAX_TURNS}`;
  const onboarding = phonePreview && profile.step !== 'conversation';
  $('finishBtn').hidden = onboarding || state.finished || state.editing || (state.turns < 2 && !screening.results.size && !state.supportRelevant);
  if (state.example) $('turnCount').hidden = true;
}

async function api(kind, context = state) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, summary: context.summary.text, history: context.history, screeningAvailable: screening.status === 'available' }),
  });
  const body = await res.json().catch(() => ({}));
  if (!res.ok || body.error) throw new Error(body.error || 'AI 응답을 받지 못했어요.');
  return body;
}

async function exampleTurn() {
  const session = state.example;
  const next = previewTurn(session);
  if (screening.status !== 'available' || !session.answers.length) return next;
  const [concern, opening, detail] = session.answers;
  if (session.answers.length === 1 && concern === session.concern) return next;
  const story = workoutStories.find((s) => s.opening === opening && s.detail === detail);
  if (story && concern === workoutConcern && session.answers.length === 3) {
    if (!story.screeningOffer) return next;
    // Construct the external request exclusively from the published fictional scene.
    const context = {
      summary: { text: '대회 시연용 가상 사례. 아래 생활 장면에서 우울 선별검사를 제안할 근거가 있는지 보고, 없으면 자연스럽게 마무리해요.' },
      history: [
        { role: 'user', text: workoutConcern }, { role: 'model', text: '그동안 저녁은 어떻게 보냈어요?' },
        { role: 'user', text: story.opening }, { role: 'model', text: story.question },
        { role: 'user', text: story.detail },
      ],
    };
    const response = await api('turn', context).catch(() => null);
    if (response?.mode === 'gemini') return Object.hasOwn(screeners, response.screening) ? response : next;
    return { reply: story.screeningOffer, screening: 'phq9', focus: 'none' };
  }
  const offer = offlineScreeningOffer(session.answers.at(-1));
  return offer ? { ...offer, focus: 'none' } : next;
}

function leaveOffer() {
  $('chat').querySelector('.screening-offer')?.remove();
  screening.offered = [];
  if (screening.status === 'offered') screening.status = 'declined';
}

function offerScreening(text, ids) {
  leaveOffer();
  screening.status = 'offered';
  const group = el('div', 'screening-offer');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', text);
  screening.offered = ids;
  for (const id of ids) {
    const test = screeners[id];
    const label = ids.length === 1 ? test.name + ' 시작' : test.topic + ' · ' + test.name + ' (' + test.length + '문항)';
    const start = el('button', ids.length === 1 ? 'btn primary' : 'btn', label);
    start.type = 'button';
    start.dataset.test = id;
    start.onclick = () => startScreening(id);
    group.append(start);
  }
  const skip = el('button', 'btn', '대화만 계속');
  skip.type = 'button';
  skip.onclick = () => {
    leaveOffer();
    if (state.example) { aiTurn(); return; }
    addMsg('ai', '그럼 이야기로 이어갈게요. 방금 돌아본 장면에서 더 들려주고 싶은 게 있나요?');
    $('msg').focus();
  };
  group.append(skip);
  addMsg('ai', text, group);
}

async function collectScreening(id) {
  const existing = screening.results.get(id);
  const previous = existing || [...screening.results.values()].reverse().find(r =>
    (id === 'gad7' && (r.id === 'gad2' || r.id === 'phq4')) || (id === 'phq9' && r.id === 'phq4'));
  const result = await runScreening(id, previous?.answers, { retake: Boolean(existing) });
  if (result) screening.results.set(id, result);
  return result;
}

async function startScreening(id) {
  if (state.finished || screening.status === 'active') return;
  if (screening.results.has(id)) {
    addMsg('ai', screeners[id].name + ' 검사는 마쳤어요. 최종 리포트에서 결과를 확인할 수 있어요.');
    return;
  }
  const group = $('chat').querySelector('.screening-offer');
  screening.status = 'active';
  let outcome;
  try {
    outcome = await collectScreening(id);
  } catch {
    screening.status = group ? 'offered' : 'available';
    showError('검사 화면을 열지 못했어요.', () => startScreening(id));
    return;
  }
  group?.remove();
  screening.offered = [];
  screening.status = outcome ? 'completed' : 'declined';
  if (outcome) {
    updateTurns();
    const followups = outcome.followups.filter((key) => !screening.results.has(key));
    if (followups.length) {
      offerScreening('앞에서 답한 두 문항을 포함해 조금 더 살펴볼 수 있어요. 이어서 할 검사를 고르거나 대화로 돌아가세요.', followups);
      return;
    }
  }
  if (state.example) { aiTurn(); return; }
  addMsg('ai', '최근에 마음에 남은 장면이 있다면 이어서 들려주세요.');
  $('msg').focus({ preventScroll: true });
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

function replyChoices(choices) {
  const group = el('div', 'scene-replies');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', '답장 선택');
  for (const label of [...choices, '건너뛰기']) {
    const button = el('button', '', label);
    button.type = 'button';
    button.addEventListener('click', () => {
      $('msg').value = label === '건너뛰기' ? '이 이야기는 건너뛸게요.' : label;
      $('composer').requestSubmit();
    });
    group.append(button);
  }
  return group;
}

async function aiTurn() {
  const lastMessage = state.history.at(-1);
  const answer = lastMessage?.role === 'user' && state.estimates.last?.text === lastMessage.text ? state.estimates.last : null;
  busy(true);
  const typing = addMsg('ai', '데이터를 보고 있어요');
  typing.classList.add('typing');
  try {
    const out = state.example ? await exampleTurn() : await api('turn');
    if (!state.example && answer && out.mode === 'gemini' && Array.isArray(out.traitSignals)) {
      answer.signals = groundedSignals(answer.text, out.traitSignals);
      answer.source = 'AI 대화 해석';
    }
    typing.remove();
    state.history.push({ role: 'model', text: out.reply });
    const hasOffer = Object.hasOwn(screeners, out.screening) && screening.status === 'available' && state.turns > 0;
    busy(false);
    if (hasOffer) {
      setFocus(out.focus, { scroll: false });
      offerScreening(out.reply, [out.screening]);
      return;
    }
    const done = out.done || state.turns >= MAX_TURNS;
    const choices = out.choices ?? (out.suggestedReply ? [out.suggestedReply] : null);
    addMsg('ai', out.reply, !done && choices ? replyChoices(choices) : null);
    setFocus(out.focus);
    if (done) return report();
    if (!phonePreview) $('msg').focus();
  } catch (err) {
    typing.remove();
    busy(false);
    showError(err.message, aiTurn);
  }
}

function supportContacts(open = false) {
  const details = el('details', 'support-contacts');
  details.open = open;
  details.append(el('summary', '', '도움받을 곳'));
  for (const contact of CRISIS_LINES) {
    const link = el('a', '', contact.name);
    link.href = contact.href;
    link.append(el('strong', '', contact.number));
    details.append(link);
  }
  return details;
}

function showImmediateHelp() {
  const message = addMsg('ai', '지금은 가까운 사람에게 곁에 있어 달라고 부탁해 주세요. 이미 다쳤거나 곧 자신을 해칠 것 같다면 바로 응급 도움을 요청하세요.');
  message.append(supportContacts(true));
  revealChatItem(message);
}

$('composer').addEventListener('submit', (e) => {
  e.preventDefault();
  if (state.busy || state.finished) return;
  const text = $('msg').value.trim();
  if (!text) return;
  $('msg').value = '';
  addMsg('user', text);
  const immediateDanger = isImmediateDanger(text);
  if (immediateDanger || isCrisis(text)) {
    leaveOffer();
    state.supportRelevant = true;
    updateTurns();
    if (immediateDanger) showImmediateHelp();
    else addMsg('ai', '말해 주셔서 고마워요. 편한 만큼만 이야기해 주세요.');
    return;
  }
  if (phonePreview && profile.step !== 'conversation') {
    answerProfile(text);
    return;
  }
  const command = screeningCommand(text, screening.offered[0] || 'phq9');
  if (!state.editing && command) {
    startScreening(command);
    return;
  }
  if ((text === '/' || text === '검사 목록') && !state.editing) {
    const available = Object.keys(screeners).filter((id) => !screening.results.has(id));
    if (available.length) offerScreening('지금 살펴보고 싶은 검사를 골라 주세요.', available);
    else addMsg('ai', '네 가지 검사를 모두 마쳤어요. 최종 리포트에서 결과를 볼 수 있어요.');
    return;
  }
  if (screening.status === 'offered') {
    const buttons = $('chat').querySelectorAll('.screening-offer button');
    if (/^(?:네|예|응|할게요|해볼게요|해볼래요|좋아요|시작|시작할게요)[.! ]*$/u.test(text)) {
      if (screening.offered.length === 1) buttons[0].click();
      else buttons[0].focus();
      return;
    }
    if (/^(?:아니요|괜찮아요|건너뛰기|다음에|안 할래요)[.! ]*$/u.test(text)) { buttons[buttons.length - 1].click(); return; }
    leaveOffer();
  }
  state.history.push({ role: 'user', text });
  recordTraitReply(state.estimates, text, state.editing);
  if (state.editing) {
    state.example.correction = text;
    state.editing = false;
    report();
    return;
  }
  if (state.example) state.example.answers.push(text);
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
  leaveOffer();
  state.finished = true;
  updateTurns();
  $('composer').hidden = true;
  $('chat').querySelector('.scene-replies')?.remove();
  if (state.example) {
    const container = phonePreview ? $('phoneReport') : el('li', 'case-report');
    showExampleReport(container);
    if (phonePreview) {
      $('resultButton').hidden = false;
      $('recordNext').textContent = '대화 결과 보기';
      $('viewRecord').textContent = (state.example.metric.id === 'workout' ? '운동' : state.example.metric.label) + ' 기록 다시 보기';
      showPhonePanel('resultPanel');
      $('resultPanel').scrollTop = 0;
      $('resultTitle').focus({ preventScroll: true });
    } else {
      $('chat').append(container);
      container.querySelector('h2').focus({ preventScroll: true });
      container.scrollIntoView({ block: 'start' });
    }
    return;
  }
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

function appendProfile(container, opening, records, correction = '') {
  const deck = el('div', 'result-deck');
  appendProfileCards(deck, {
    results: state.traitResults, estimates: state.estimates, completed: screening.results, age: profile.age, demo: Boolean(state.example),
    takeScreening: collectScreening,
  });
  container.append(deck);
  if (correction) container.append(el('p', 'profile-correction', '바로잡은 내용 · ' + correction));
  if (records.length || opening) {
    const evidence = resultDetails('대화와 건강 기록 보기');
    evidence.classList.add('profile-evidence');
    if (opening && !correction) evidence.append(el('p', '', opening));
    for (const entry of records) {
      const group = el('div', 'profile-basis');
      group.append(el('h3', '', entry.label));
      if (entry.basis) group.append(el('p', '', entry.basis));
      for (const quote of entry.quotes || []) group.append(el('blockquote', '', quote));
      if (entry.metric) {
        const link = el('button', 'basis-record', '기록 보기');
        link.type = 'button';
        link.onclick = () => setFocus(entry.metric);
        group.append(link);
      }
      evidence.append(group);
    }
    container.append(evidence);
  }
}

function showExampleReport(container) {
  const { metric } = state.example;
  const result = previewResult(state.example);
  container.replaceChildren();
  if (!phonePreview) {
    const title = el('h2', '', '마음 프로필');
    title.tabIndex = -1;
    container.append(title);
  }
  const record = {
    label: '대화를 시작한 기록',
    basis: `${metric.label} · ${recordText(metric)}`,
    quotes: [result.concern, ...result.context].filter(Boolean),
  };
  const opening = result.opening || (result.concern ? `“${result.concern}”라는 이야기에서 시작했어요.` : '');
  appendProfile(container, opening, [record], result.correction);
  const edit = el('button', 'correct-report', '내 얘기와 달라요');
  edit.type = 'button';
  edit.onclick = () => {
    state.editing = true;
    state.finished = false;
    if (phonePreview) {
      $('resultButton').hidden = true;
      $('recordNext').textContent = '대화 이어보기';
      showPhonePanel('chatPanel');
    } else {
      container.remove();
    }
    updateTurns();
    $('composer').hidden = false;
    addMsg('ai', '어떤 부분이 내 얘기와 달랐나요? 들려주신 말로 결과를 바로잡을게요.');
    $('msg').focus();
  };
  container.append(edit);
}

function renderReport(r) {
  const li = el('li', 'report');
  li.append(el('h2', 'type', '마음 프로필'));
  const findings = (r.evidence || []).map((item) => ({
    label: METRIC_LABEL[item.metric] || '대화', basis: item.text, metric: item.metric,
  }));
  appendProfile(li, r.reflection, findings);
  const step = el('div', 'step');
  step.append(el('strong', null, '이번 주 작은 실험'), el('span', null, r.small_step));
  li.append(step);

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

function askProfile(question) {
  const example = profile.step === 'name' ? '하루라고 불러 주세요.' : '만 25살이에요.';
  addMsg('ai', question, replyChoices([example]));
}

function answerProfile(reply) {
  const skip = /^(?:건너뛰기|(?:이 이야기는 )?건너뛸게요|비밀|비밀이에요)[.!]?$/u.test(reply);
  if (profile.step === 'name') {
    profile.name = skip ? null : readName(reply);
    if (!skip && !profile.name) {
      askProfile('제가 부르면 좋을 이름이나 별명을 알려주세요. 건너뛰셔도 돼요.');
      return;
    }
    profile.step = 'age';
    const greeting = profile.name ? profile.name + '님, 반가워요. ' : '';
    askProfile(greeting + '만으로 몇 살이세요?');
    $('msg').placeholder = '예) 스물다섯 살이에요.';
    return;
  }
  if (profile.step !== 'age') return;
  profile.age = skip ? null : readAge(reply);
  if (!skip && profile.age === null) {
    askProfile('만 나이를 25살처럼 알려주세요. 건너뛰셔도 돼요.');
    return;
  }
  profile.step = 'conversation';
  openSession(true);
}

function showPhonePanel(panelId) {
  const nav = $('phoneNav');
  nav.hidden = $('resultButton').hidden;
  for (const tab of nav.querySelectorAll('button')) {
    const panel = $(tab.getAttribute('aria-controls'));
    panel.hidden = panel.id !== panelId;
    tab.setAttribute('aria-pressed', String(!panel.hidden));
  }
}

function openPhone() {
  document.title = '스마트폰 체험 · 마음 시간표';
  document.body.append($('phoneTemplate').content.cloneNode(true));
  $('intro').hidden = true;
  $('phoneViewport').append($('session'));
  $('session').append($('resultPanel'));
  const viewport = window.visualViewport;
  if (viewport) {
    // The software keyboard can shrink the visible screen without resizing the layout viewport.
    const fitKeyboard = () => {
      if (viewport.scale === 1) document.documentElement.style.setProperty('--phone-visible-height', viewport.height + 'px');
    };
    fitKeyboard();
    viewport.addEventListener('resize', fitKeyboard);
  }
  const clock = new Intl.DateTimeFormat('ko-KR', { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const showTime = () => { $('phoneClock').textContent = clock.format(new Date()); };
  showTime();
  window.setInterval(showTime, 60_000);
  for (const tab of $('phoneNav').querySelectorAll('button')) {
    tab.addEventListener('click', () => showPhonePanel(tab.getAttribute('aria-controls')));
  }
  setupPhoneAccess((summary) => {
    state.summary = summary;
    $('session').hidden = false;
    showPhonePanel('chatPanel');
    profile.step = 'name';
    $('turnCount').hidden = true;
    askProfile('선택한 건강 기록을 불러왔어요. 어떤 이름으로 불러드릴까요? 별명도 좋아요.');
    $('msg').placeholder = '이름이나 별명을 적어 주세요.';
    $('chatPanel').tabIndex = -1;
    $('chatPanel').focus({ preventScroll: true });
  });
  $('viewRecord').addEventListener('click', () => {
    showPhonePanel('recordPanel');
    setFocus(state.example.metric.id);
    $('recordPanel').scrollTop = 0;
    $('recordsButton').focus({ preventScroll: true });
  });
  const params = new URLSearchParams(location.search);
  const index = caseLinks.indexOf(params.get('case'));
  if (index >= 0) {
    $('appleContinue').disabled = true;
    const answers = params.get('test') === 'phq9' && workoutStories[index].samplePhq9;
    Promise.all([readPreviewHealth(['workouts']), answers ? loadForm('phq9') : null]).then(([summary, form]) => {
      const exampleScreening = form ? { ...scoreForm(form, answers), sample: true } : null;
      state.summary = summary;
      profile.step = 'conversation';
      $('signupStep').hidden = true;
      openSession(true, index, exampleScreening);
    }).catch(() => {
      $('appleContinue').disabled = false;
      $('signupError').textContent = '예시 결과를 불러오지 못했어요. 아래에서 체험을 시작할 수 있어요.';
    });
  }
}

const hero = document.querySelector('.intro-hero');
let dragStartY = 0;
let dragStartScroll = 0;

// Touch and trackpad scrolling stay native. A mouse can also drag the backdrop.
hero.addEventListener('pointerdown', (event) => {
  if (event.pointerType !== 'mouse' || event.button !== 0 || event.target !== hero) return;
  dragStartY = event.clientY;
  dragStartScroll = window.scrollY;
  hero.setPointerCapture(event.pointerId);
  hero.classList.add('is-dragging');
});
hero.addEventListener('pointermove', (event) => {
  if (event.pointerType === 'mouse' && hero.hasPointerCapture(event.pointerId)) {
    window.scrollTo(0, dragStartScroll + dragStartY - event.clientY);
  }
});
hero.addEventListener('lostpointercapture', () => hero.classList.remove('is-dragging'));

if (phonePreview) openPhone();
else showLandingExamples();
$('uploadBtn').addEventListener('click', () => $('fileInput').click());
$('fileInput').addEventListener('change', (e) => { const f = e.target.files[0]; if (f) start(f, false); });
$('sampleBtn').addEventListener('click', () => start(null, true));
