import { el, resultCard, resultDetails } from './report-elements.js';
import { appendProfileReport, estimateModel } from './everyday-cards.js';
import { everydayTopics } from './everyday-topics.js';
import { newEstimates, recordTraitReply, recordSignals, groundedSignals, estimateFor, cueSignals, localCues, groundedCues, closestReason } from './trait-estimates.js';
import { parseHealthFile } from './parse.js';
import { computeSummary, hhmm } from './metrics.js';
import { SYSTEM_PROMPT } from './prompt.js';
import { isCrisis, isImmediateDanger, CRISIS_LINES, checkReply, hasBanned } from './safety.js';
import { runScreening } from './phq9-sheet.js';
import { loadForm, scoreForm } from './screening-forms.js';
import { demoRank } from './profile-results.js';
import { screeningCommand, screeners, offlineScreeningOffer } from './screening-router.js';
import { readPreviewHealth, setupPhoneAccess } from './phone-access.js';
import { buildQuiz } from './rapport-quiz.js';
import { detectChanges, firstQuestion, whyQuestion, whyKeyFor, recordLine } from './change-talk.js';

import { workoutConcern, workoutStories, exampleTestAnswers, caseAnswers, previewSession, previewTurn, previewResult, recordText } from './preview-report.js';

const caseLinks = ['again', 'interest'];
const MAX_TURNS = 10;
const START = -180; // timetable starts at 21:00 (minutes from midnight)
const SPAN = 14 * 60; // to 11:00
const $ = (id) => document.getElementById(id);
const phonePreview = document.documentElement.classList.contains('phone-preview');

const state = { mode: 'demo', summary: null, history: [], turns: 0, busy: false, finished: false, supportRelevant: false, example: null, talk: null, pendingReply: null, editing: false, traitResults: new Map(), estimates: newEstimates(), prior: null };
const profile = { step: null };
const quiz = { questions: [], at: 0, correct: 0 };
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

// When the preview answer changes, the rank counts from the old number to the new one and
// the scale marker slides there (the --position transition lives in styles.css).
// aria-busy holds the live region until the count settles, so only the final rank is read.
function animateRankChange(hero, from, to, fromPosition) {
  const number = hero.querySelector('.result-value strong');
  const rule = hero.querySelector('.result-scale');
  if (!number || !Number.isFinite(from) || !Number.isFinite(to) || from === to) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  if (rule && fromPosition) {
    const target = rule.style.getPropertyValue('--position');
    rule.style.setProperty('--position', fromPosition);
    rule.getBoundingClientRect();
    rule.style.setProperty('--position', target);
  }
  const start = performance.now(), duration = 650;
  hero.setAttribute('aria-busy', 'true');
  number.textContent = from;
  const step = (now) => {
    const t = Math.min(1, (now - start) / duration);
    number.textContent = Math.round(from + (to - from) * (1 - (1 - t) ** 3));
    if (t < 1) requestAnimationFrame(step);
    else hero.removeAttribute('aria-busy');
  };
  requestAnimationFrame(step);
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
      const hero = $('heroResult');
      const before = Number(hero.querySelector('.result-value strong')?.textContent);
      const from = hero.querySelector('.result-scale')?.style.getPropertyValue('--position');
      hero.replaceChildren(resultCard({ label: featured.title, value, scale }));
      animateRankChange(hero, before, Number(value.main), from);
    }
    choice.addEventListener('change', showReplyResult);
    if (choice.checked) showReplyResult();
  }
  // A fixed example person: the conversation of case 0 plus every test the app can open.
  // The landing shows every indicator as a rank ('N등'): test scores become ranks among
  // 100 virtual answers (demoRank), and rows with no example value get a fixed example rank.
  const rankCard = (row, rank, model = {}) => ({ ...model,
    value: { main: rank, unit: '등' },
    scale: { min: 1, max: 100, current: rank, unit: '등', caption: '1등에 가까울수록 ' + row.high + '이에요.' } });
  const asRank = (row, model) => {
    if (model.value?.unit === '등' || !model.scale) return model;
    const { current, min, max } = model.scale;
    const card = rankCard(row, demoRank(current, min, max), model);
    if (card.evidence) card.evidence = { ...card.evidence, items: [el('p', '', '예시 응답의 점수를 가상 100명 기준 등수로 환산했어요.'), ...card.evidence.items] };
    return card;
  };
  const exampleRank = (row) => 20 + [...row.id].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 60;
  const fill = (row) => rankCard(row, exampleRank(row), { evidence: { items: [el('p', '', '랜딩 예시용 값이에요. 실제 리포트에서는 검사로 확인해요.')] } });
  const completed = new Map();
  Promise.all(Object.entries(exampleTestAnswers).map(async ([id, values]) => {
    const form = await loadForm(id);
    const answers = Object.fromEntries(values.map((value, i) => [id + '.' + (i + 1), value]));
    completed.set(id, { ...scoreForm(form, answers), sample: true });
  })).then(() => {
    appendProfileReport($('landingCases'), { results: new Map(), estimates: scenes[0], completed, demo: true, fill },
      { bigCard: (row, model) => {
        const ranked = asRank(row, model);
        const card = resultCard({ ...ranked, label: row.title });
        card.dataset.rank = ranked.value.main;
        return card;
      } });
    // Closest to 1등 first. Ties keep indicators.js order (sort is stable).
    const deck = $('landingCases').querySelector('.case-grid');
    deck.replaceChildren(...[...deck.children].sort((a, b) => a.dataset.rank - b.dataset.rank));
  }).catch(() => {
    $('landingCases').append(el('p', 'fine', '예시 리포트를 불러오지 못했어요.'));
  });
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

async function start() {
  $('introError').hidden = true;
  $('progressFill').style.width = '0%';
  $('progressText').textContent = '샘플 기록을 여는 중';
  $('progress').hidden = false;
  for (const b of document.querySelectorAll('.actions button.btn')) b.setAttribute('disabled', '');
  try {
    const res = await fetch('sample/export.xml');
    if (!res.ok) throw new Error('샘플을 열 수 없어요. 잠시 뒤 다시 시도해 주세요.');
    const file = new File([await res.blob()], 'export.xml', { type: 'text/xml' });
    const data = await parseHealthFile(file, (p) => {
      $('progressFill').style.width = `${Math.round(p * 100)}%`;
      $('progressText').textContent = `기록을 읽는 중 · ${Math.round(p * 100)}%`;
    });
    $('progressText').textContent = `기록 ${data.records.toLocaleString('ko-KR')}개를 읽었어요. 평소와 비교하는 중`;
    const summary = computeSummary(data);
    if (!summary || summary.metrics.length < 2) throw new Error('비교할 만큼의 기록이 없어요. 최근 3개월 동안 수면이나 걸음 기록이 있어야 해요.');
    state.summary = summary;
    openSession(true);
  } catch (err) {
    $('introError').textContent = err.message || '샘플을 열 수 없어요.';
    $('introError').hidden = false;
    $('progress').hidden = true;
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
  // Stage 2 reopens the session after the quiz; the opening answer's clues stay in the ledger.
  if (!state.talk) state.estimates = newEstimates();
  const s = state.summary;
  state.example = isSample && !state.talk ? previewSession(s.metrics) : null;
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
    const change = state.talk?.changes[0];
    const primary = state.example?.metric || s.metrics[0];
    $('sessionTable').hidden = !s.recentNights.some((night) => night.asleep != null);
    $('recordPanel').querySelector('.panel-head').hidden = $('sessionTable').hidden;
    const overview = el('div', 'phone-overview');
    if (change) overview.append(el('h1', '', change.label), el('strong', '', change.recentText), el('p', '', recordLine(change)));
    else overview.append(el('h1', '', '최근 2주 ' + primary.label), el('strong', '', primary.recentText), el('p', '', '평소 ' + primary.baseText));
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
  } else if (state.talk) {
    startTalk();
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
  // A run of AI bubbles shows the speaker name once, like a chat app.
  const previous = $('chat').lastElementChild;
  if (role === 'ai' && !previous?.matches('.msg.ai')) li.append(Object.assign(document.createElement('span'), { className: 'who', textContent: 'Herz' }));
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
  if (state.example || state.talk) $('turnCount').hidden = true;
}

async function api(kind, context = state, { timeout, extra } = {}) {
  const res = await fetch('/api/chat', {
    method: 'POST',
    signal: timeout ? AbortSignal.timeout(timeout) : undefined,
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ kind, summary: context.summary.text, history: context.history, screeningAvailable: screening.status === 'available', ...extra }),
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
    addMsg('ai', '그럼 이야기로 이어갈게요. 방금 돌아본 장면에서 더 들려주고 싶으신 게 있나요?');
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
      offerScreening('앞에서 답하신 두 문항을 포함해 조금 더 살펴볼 수 있어요. 이어서 할 검사를 고르거나 대화로 돌아가세요.', followups);
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

// `skip` adds a last button, such as 잘 모르겠어요.
function replyChoices(choices, skip = null) {
  const group = el('div', 'scene-replies');
  group.setAttribute('role', 'group');
  group.setAttribute('aria-label', '답장 선택');
  for (const label of skip ? [...choices, skip] : choices) {
    const button = el('button', label === skip ? 'quiet' : '', label);
    button.type = 'button';
    button.addEventListener('click', () => {
      $('msg').value = label;
      $('composer').requestSubmit();
    });
    group.append(button);
  }
  return group;
}

async function aiTurn() {
  busy(true);
  const typing = thinking('데이터를 보고 있어요');
  try {
    const out = state.example ? await exampleTurn() : await api('turn');
    const reply = state.pendingReply;
    if (reply) {
      // The AI reads the reply when it answers; the on-device classifier covers the demo server.
      const signals = out.mode === 'gemini' ? out.signals ?? out.traitSignals : null;
      if (Array.isArray(signals)) recordSignals(state.estimates, reply, groundedSignals(reply, signals), 'AI 대화 해석');
      else recordTraitReply(state.estimates, reply);
      state.pendingReply = null;
    }
    typing.remove();
    out.reply = checkReply(out.reply);
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
    if (profile.step === 'talk') {
      // Stop asking about the records; the finish button opens the report when the user is ready.
      state.talk.stopped = true;
      profile.step = 'conversation';
      $('msg').placeholder = '내 이야기로 답하기';
    }
    updateTurns();
    if (immediateDanger) showImmediateHelp();
    else addMsg('ai', '말해 주셔서 고마워요. 편한 만큼만 이야기해 주세요.');
    return;
  }
  if (phonePreview && profile.step === 'opening') {
    answerOpening(text);
    return;
  }
  if (phonePreview && profile.step === 'quiz') {
    answerQuiz(text);
    return;
  }
  if (phonePreview && profile.step === 'talk') {
    answerTalk(text);
    return;
  }
  if (phonePreview && profile.step !== 'conversation') return;
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
  if (state.editing) {
    recordTraitReply(state.estimates, text, true);
    (state.example || state.talk).correction = text;
    state.editing = false;
    report();
    return;
  }
  if (state.example) {
    recordTraitReply(state.estimates, text);
    state.example.answers.push(text);
  } else {
    state.pendingReply = text;
  }
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

const pause = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// The end of the talk gets its own beat before the report: the last message stays readable,
// a short tally shows what the report is made of, and a phone notification hands the user
// into the report on tap.
async function reportBeat() {
  await pause(800);
  const card = el('li', 'msg ai report-progress');
  card.setAttribute('role', 'status');
  const steps = el('ul');
  card.append(el('p', '', '리포트를 만들고 있어요'), steps);
  $('chat').append(card);
  for (const label of ['대화 단서 모으기', '24가지 지표에 반영', '등수 계산']) {
    const step = el('li', '', label);
    steps.append(step);
    revealChatItem(card);
    await pause(650);
    step.classList.add('done');
  }
  await pause(400);
  const notice = el('button', 'phone-notice');
  notice.type = 'button';
  const icon = el('img');
  icon.src = 'favicon.svg';
  icon.alt = '';
  notice.append(icon, el('strong', '', 'Herz'), el('span', '', '리포트가 준비됐어요. 탭해서 볼까요?'));
  document.querySelector('.phone-screen').append(notice);
  notice.focus({ preventScroll: true });
  await new Promise((resolve) => notice.addEventListener('click', resolve, { once: true }));
  notice.classList.add('leaving');
  setTimeout(() => notice.remove(), 300);
}

async function report() {
  leaveOffer();
  state.finished = true;
  updateTurns();
  $('composer').hidden = true;
  $('chat').querySelector('.scene-replies')?.remove();
  if (state.example || state.talk) {
    const container = phonePreview ? $('phoneReport') : el('li', 'case-report');
    showExampleReport(container);
    if (phonePreview) {
      busy(true);
      await reportBeat();
      busy(false);
      $('resultPanel').classList.add('sheet-in');
      $('resultPanel').addEventListener('animationend', () => $('resultPanel').classList.remove('sheet-in'), { once: true });
      $('resultButton').hidden = false;
      $('recordNext').textContent = '대화 결과 보기';
      const metric = state.example?.metric;
      $('viewRecord').textContent = (metric ? (metric.id === 'workout' ? '운동' : metric.label) : state.talk.changes[0]?.label ?? '건강') + ' 기록 다시 보기';
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
  const typing = thinking('지난 2주를 정리하고 있어요');
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
  appendProfileReport(container, {
    results: state.traitResults, estimates: state.estimates, completed: screening.results, demo: Boolean(state.example || state.talk), prior: state.prior,
  }, { takeScreening: collectScreening });
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

// The stage 2 story: which changes were discussed and what the user answered.
function talkStory(talk) {
  if (talk.correction) return { opening: `마지막으로 “${talk.correction}”라고 바로잡아 주셨어요.`, records: talkRecords(talk) };
  if (!talk.changes.length) return { opening: '최근 기록은 평소와 크게 다르지 않았어요.', records: [] };
  const lines = talk.log.map(({ change, first, second }) => {
    if (!first) return `${change.label} 변화는 이유를 건너뛰었어요.`;
    return `${change.label} 변화에 “${first}”라고 답했어요.` + (second ? ` 이어서 “${second}”라고 했어요.` : '');
  });
  return { opening: lines.join(' '), records: talkRecords(talk) };
}

function talkRecords(talk) {
  return talk.log.map(({ change, first, second }) => ({
    label: change.label + ' 변화', basis: recordLine(change), quotes: [first, second].filter(Boolean), metric: change.record,
  }));
}

function showExampleReport(container) {
  container.replaceChildren();
  if (!phonePreview) {
    const title = el('h2', '', 'Herz');
    title.tabIndex = -1;
    container.append(title);
  }
  if (state.talk) {
    const { opening, records } = talkStory(state.talk);
    appendProfile(container, opening, records, state.talk.correction);
  } else {
    const { metric } = state.example;
    const result = previewResult(state.example);
    const record = {
      label: '대화를 시작한 기록',
      basis: `${metric.label} · ${recordText(metric)}`,
      quotes: [result.concern, ...result.context].filter(Boolean),
    };
    const opening = result.opening || (result.concern ? `“${result.concern}”라는 이야기에서 시작했어요.` : '');
    appendProfile(container, opening, [record], result.correction);
  }
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
  li.append(el('h2', 'type', 'Herz'));
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
  card.append(el('span', 'card-brand', 'Herz'), el('strong', 'card-type', r.type_name), el('p', 'card-line', r.card_line));
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

/* ---------- Rapport quiz: guess your own records first ---------- */

// Opening: one free-text answer about self-knowledge. It builds rapport and, like Q2, may move indicators.
const OPENING = '사용자님은 스스로에 대해서 얼마나 잘 아시나요?';

function startOpening() {
  profile.step = 'opening';
  state.history.push({ role: 'model', text: OPENING });
  addMsg('ai', OPENING);
  $('msg').placeholder = '내 말로 답하기';
}

async function answerOpening(text) {
  state.history.push({ role: 'user', text });
  busy(true);
  const typing = thinking('답을 읽고 있어요');
  const { cues, source, reaction } = await readFreeText(text);
  typing.remove();
  busy(false);
  const signals = cueSignals(cues, text, null);
  if (signals.length) recordSignals(state.estimates, text, signals, source);
  addMsg('ai', `${reaction || '좋아요.'} 그럼 기록으로 한번 확인해 볼게요.`);
  startQuiz();
}

function startQuiz() {
  quiz.questions = buildQuiz(state.summary.data, state.summary.through);
  quiz.at = 0;
  quiz.correct = 0;
  if (!quiz.questions.length) return endQuiz();
  profile.step = 'quiz';
  askQuiz();
}

const ORDINALS = ['첫 번째', '두 번째', '세 번째', '네 번째', '다섯 번째'];
const ordinalOf = (i) => (i === quiz.questions.length - 1 && i > 0 ? '마지막' : ORDINALS[i]);

function askQuiz() {
  const question = quiz.questions[quiz.at];
  addMsg('ai', `${ordinalOf(quiz.at)} 질문이에요. ${question.text}`, replyChoices(question.choices));
  $('msg').placeholder = question.choices.length ? '고르거나 숫자로 답하기' : '예) 7시간 반';
}

function answerQuiz(reply) {
  const result = quiz.questions[quiz.at].answer(reply);
  if (result.correct) quiz.correct++;
  quiz.at++;
  if (quiz.at < quiz.questions.length) {
    addMsg('ai', result.reply);
    askQuiz();
  } else {
    endQuiz(result.reply);
  }
}

// At least half right: the count with '!'. Under half: no count.
function quizScore(total, correct) {
  if (correct === total) return `${total}개 모두 맞히셨어요!`;
  if (correct * 2 >= total) return `${total}개 중 ${correct}개 맞히셨어요!`;
  return '기록이 생각과는 꽤나 달랐던 모양이에요.';
}

// A '...' bubble whose dots ripple: the one waiting indicator for every pause.
function thinking(label = '기록을 분석하고 있어요') {
  const li = document.createElement('li');
  li.className = 'msg ai thinking';
  li.setAttribute('role', 'status');
  const dots = el('p', 'dots');
  dots.setAttribute('aria-label', label);
  for (let i = 0; i < 3; i++) dots.append(el('span', null, '.'));
  li.append(dots);
  $('chat').append(li);
  revealChatItem(li);
  return li;
}

// The last answer's feedback and the score share one bubble, then the dots stand in for
// the agent reading the records, so stage 2 opens on a single question bubble.
const THINKING_MS = 3500;

async function endQuiz(lastReply = '') {
  if (quiz.questions.length) {
    addMsg('ai', `${lastReply} ${quizScore(quiz.questions.length, quiz.correct)}`.trim());
    busy(true);
    const dots = thinking();
    await new Promise((resolve) => setTimeout(resolve, THINKING_MS));
    dots.remove();
    busy(false);
  }
  $('msg').placeholder = '내 이야기로 답하기';
  state.talk = { changes: detectChanges(state.summary.data, state.summary.through), at: 0, asked: 0, log: [], current: null, stopped: false, correction: '' };
  openSession(true);
}

/* ---------- Stage 2: ask about the clearest changes in the user's own records ---------- */

const MAX_TALK_QUESTIONS = 4;
// Q2 has no choices: the user answers in their own words or taps 잘 모르겠어요.
const TALK_UNKNOWN = '잘 모르겠어요';
const TALK_SKIP = /^(?:잘 모르겠어요|모르겠어요|건너뛸게요|넘어갈래요|패스|말하고 싶지 않아요|이 이야기는 건너뛸게요)[.!~ ]*$/u;

// A thin line that closes the quiz; stage 2 starts below it as a new part of the talk.
function chatDivider() {
  const li = el('li', 'chat-divider');
  li.setAttribute('role', 'separator');
  $('chat').append(li);
}

function startTalk() {
  const talk = state.talk;
  profile.step = 'talk';
  updateTurns();
  chatDivider();
  if (!talk.changes.length) {
    addMsg('ai', '최근 기록은 평소와 크게 다르지 않았어요. 지금까지의 이야기로 Herz에 정리했어요.');
    finishTalk();
    return;
  }
  askChange('다음으로, 생활기록에 특이한 사항이 있어서 여쭤볼게요. ');
}

function askChange(prefix = '') {
  const talk = state.talk;
  const change = talk.changes[talk.at];
  const question = firstQuestion(change, talk.at);
  talk.current = { change, question, why: null, first: '', firstCues: [], second: '' };
  talk.asked++;
  setFocus(change.record || 'none', { scroll: false });
  askTalk(prefix + question.text);
}

// Q1 offers its reasons as buttons; Q2 asks for the user's own words. Both offer 잘 모르겠어요.
// Q1 and Q2 have no reason buttons: the user answers in their own words or taps 잘 모르겠어요.
function askTalk(text) {
  state.history.push({ role: 'model', text });
  addMsg('ai', text, replyChoices([], TALK_UNKNOWN));
  $('msg').placeholder = '내 말로 답하기';
}

// Free text: Gemini reads it when the server has a key, the demo on the device.
// Returns cues { indicator, item, dir, quote }. A slow or failed AI read falls back to the device.
// Free text: Gemini reads it against the cue table when the server has a key. Without an
// answer from it, the device classifier reads it, then the question's own reason table.
// Also returns the AI's one-line reaction to the answer ('' when the AI did not answer).
async function readFreeText(text, reasons) {
  let reaction = '';
  if (state.mode === 'gemini') {
    try {
      const out = await api('signals', state, { timeout: 15000 });
      if (typeof out.reaction === 'string' && !hasBanned(out.reaction)) reaction = out.reaction;
      const cues = Array.isArray(out.signals) ? groundedCues(out.signals, text) : [];
      if (cues.length) return { cues, source: 'AI 대화 해석', reaction };
    } catch {
      // Fall through to the device.
    }
  }
  const local = localCues(text);
  if (local.length) return { cues: local, source: '기기 내 문장 분류', reaction };
  const reason = closestReason(text, reasons);
  return reason ? { cues: reason.cues, why: reason.why, source: '이유 표 대조', reaction } : { cues: [], source: '기기 내 문장 분류', reaction };
}

// Q2: why about the first answer. Gemini writes it when the server has a key; the scripted
// WHY bank answers in the demo, and when the AI is slow (15 s) or returns too little.
async function whyFor(turn, key) {
  const scripted = whyQuestion(key, state.talk.at);
  if (state.mode !== 'gemini') return scripted;
  const typing = thinking('다음 질문을 고르고 있어요');
  try {
    const context = { summary: state.summary, history: [{ role: 'model', text: turn.question.text }, { role: 'user', text: turn.first }] };
    const out = await api('why', context, { timeout: 15000, extra: { change: turn.change.label } });
    const choices = (out.choices || []).map((choice) => ({ text: choice.text, cues: groundedCues(choice.cues) }));
    if (typeof out.question === 'string' && !hasBanned(out.question) && choices.length >= 2) return { text: out.question, choices };
  } catch {
    // Use the scripted question.
  } finally {
    typing.remove();
  }
  return scripted;
}

async function answerTalk(text) {
  const talk = state.talk;
  const turn = talk.current;
  const second = Boolean(turn.why);
  const asked = turn.why || turn.question;
  const skipped = TALK_SKIP.test(text);
  const picked = asked.choices.find((choice) => choice.text === text);
  state.history.push({ role: 'user', text });
  let cues = [];
  let source = '선택한 이유';
  let why;
  let reaction = '';
  if (picked) {
    cues = picked.cues;
  } else if (!skipped) {
    busy(true);
    const typing = thinking('답을 읽고 있어요');
    ({ cues, source, why, reaction } = await readFreeText(text, asked.choices));
    typing.remove();
    busy(false);
  }
  const signals = skipped ? [] : cueSignals(cues, text, second ? turn.firstCues : null);
  if (!skipped) recordSignals(state.estimates, text, signals, source);
  if (!second) {
    turn.first = skipped ? '' : text;
    turn.firstCues = cues;
    talk.log.push(turn);
    if (!skipped && talk.asked < MAX_TALK_QUESTIONS) {
      busy(true);
      turn.why = await whyFor(turn, picked?.why ?? why ?? whyKeyFor(cues));
      busy(false);
      talk.asked++;
      askTalk(`${reaction || (talk.at ? '그랬군요.' : '그런 일이 있었군요.')} ${turn.why.text}`);
      return;
    }
  } else {
    turn.second = skipped ? '' : text;
  }
  talk.at++;
  const ack = skipped ? '괜찮아요.' : reaction || (signals.length ? '말씀해 주셔서 고마워요.' : '그런 사정이 있었군요.');
  if (talk.at < talk.changes.length && talk.asked < MAX_TALK_QUESTIONS) {
    askChange(ack + ' 하나 더 볼게요. ');
    return;
  }
  addMsg('ai', ack + ' 들려주신 이야기로 Herz에 정리했어요.');
  finishTalk();
}

function finishTalk() {
  profile.step = 'conversation';
  $('msg').placeholder = '내 이야기로 답하기';
  report();
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

// The picked sample person's starting ranks: { <indicator id>: { rank, basis } }, or null.
async function readPrior(persona) {
  if (!persona) return null;
  try {
    const response = await fetch(`sample/${persona}/profile.json`);
    return response.ok ? (await response.json()).indicators : null;
  } catch {
    return null;
  }
}

function openPhone() {
  document.title = '스마트폰 체험 · Herz';
  // Stage 2 calls the AI only when the server has a key; until this answers, it stays on the device.
  fetch('/api/status').then((res) => res.json()).then((status) => { state.mode = status.mode; }).catch(() => {});
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
  setupPhoneAccess(async (summary, persona) => {
    state.summary = summary;
    state.prior = await readPrior(persona);
    $('session').hidden = false;
    showPhonePanel('chatPanel');
    $('turnCount').hidden = true;
    $('chatPanel').tabIndex = -1;
    $('chatPanel').focus({ preventScroll: true });
    startOpening();
  });
  $('viewRecord').addEventListener('click', () => {
    showPhonePanel('recordPanel');
    setFocus(state.example?.metric.id ?? state.talk?.changes[0]?.record ?? 'none');
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
$('sampleBtn').addEventListener('click', start);
