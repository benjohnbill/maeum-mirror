import { el, renderProfileResult } from './report-elements.js';
import { answerQuestions, runAssessment } from './assessment-sheet.js';
import { everydayTopics, pressureTopic, resilienceTopic } from './everyday-topics.js';
import { describeBlock, runPressureTask } from './pressure-task.js';
import { indicatorById, indicators } from './indicators.js';
import { demoRank, testResult } from './profile-results.js';
import { screeningReflection } from './screening-forms.js';
import { testManifest } from './screening-router.js';
import { estimateFor } from './trait-estimates.js';

function sourceLink(label, url) {
  const link = el('a', 'fine', label);
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  return link;
}

function evidence(topic, record, basis) {
  const details = document.createDocumentFragment();
  if (basis) details.append(el('p', '', basis));
  if (record && topic.questions) {
    const items = el('ol', 'trait-responses');
    topic.questions.forEach(({ text, options }, i) => {
      const li = el('li');
      li.append(text, el('b', '', options[record.answers[i]]));
      items.append(li);
    });
    details.append(items);
  }
  if (topic.credit) {
    details.append(el('p', '', topic.credit), sourceLink('CC BY 4.0 이용 조건', 'https://creativecommons.org/licenses/by/4.0/'));
  } else {
    details.append(el('p', '', 'Herz가 만든 ' + (topic === pressureTopic ? '비교 과제예요. 수치는 이번 문제에서의 수행을 보여줘요.' : '질문이에요. 결과는 여기서 직접 고른 응답을 요약해요.')));
  }
  if (topic.source) details.append(sourceLink(...topic.source));
  return details;
}

function runTopicQuestions(topic, previous) {
  return runAssessment(topic.title, async ({ ask }) => {
    const items = topic.questions.map(({ text, options }, id) => ({ id, text, instruction: topic.instruction,
      options: options.map((label, value) => ({ label, value })) }));
    const answers = await answerQuestions(ask, { items, initial: previous, credit: evidence(topic, null, topic.method) });
    return items.map(item => answers[item.id]);
  });
}

const everydayById = new Map([resilienceTopic, ...everydayTopics].map(topic => [topic.id, topic]));

// Conversation clues move an indicator from where it starts. Without a sample person's `prior`
// ({ rank, basis } from sample/<persona>/profile.json) it starts at 50 and has no value until a clue arrives.
export function estimateModel(topic, estimates, prior = null) {
  const row = indicatorById.get(topic.id) || topic;
  const { direction, score, count, evidence } = estimateFor(estimates, row.id, prior ? 100 - prior.rank : 50);
  if (!count && !prior) return { value: { main: '단서 부족' }, meta: '대화로 추정',
    description: '아직 이 항목을 추정할 만한 이야기가 없어요.' };
  // The big slot holds only the number. Direction and the clues stay in the evidence.
  const rank = Math.max(1, Math.min(100, 100 - score));
  const items = [];
  if (count) {
    const side = direction > 0 ? row.high : direction < 0 ? row.low : '양쪽 단서가 비슷해요';
    items.push(el('p', '', '대화 단서 ' + count + '개 · ' + side + (direction ? ' 쪽으로 읽었어요.' : '.')));
  }
  for (const signal of evidence) {
    items.push(el('blockquote', '', signal.quote));
    items.push(el('p', '', '→ ' + (signal.cue || signal.item) + ' → ' + row.title + ' · ' + (signal.delta > 0 ? row.high : row.low)));
  }
  const caption = '1등에 가까울수록 ' + row.high + '이에요.';
  if (!prior) {
    return { ...rankMetric(rank, caption), meta: '대화로 추정한 앱 내 순위 · 단서 ' + count + '개',
      evidence: { label: '어떤 답변이 반영됐나요?', items } };
  }
  const changed = count > 0 && rank !== prior.rank;
  const metric = rankMetric(rank, caption);
  if (changed) metric.value.prefix = prior.rank + '등 →';
  return { ...metric, before: prior.rank, changed, quotes: evidence.map((signal) => signal.quote),
    meta: '샘플 인물 설정값' + (count ? ' · 대화로 보정' : ''),
    description: '기록에서 · ' + prior.basis + (changed ? ' 대화를 듣고 ' + prior.rank + '등에서 ' + rank + '등으로 옮겼어요.' : ''),
    evidence: count ? { label: '어떤 답변이 반영됐나요?', items, open: changed } : null };
}

function rankMetric(rank, caption) {
  return { value: { main: rank, unit: '등' },
    scale: { min: 1, max: 100, current: rank, unit: '등', caption } };
}

const number = (value) => Number.isInteger(value) ? String(value) : value.toFixed(1);

function scoreValue({ score, min, max, method }) {
  if (method === 'mean') return { prefix: '평균', main: number(score), unit: '/ ' + number(max) };
  if (min < 0) return { main: (score > 0 ? '+' : '') + score, unit: '점' };
  return { main: score, unit: '/ ' + max + '점' };
}

// Subscores that no card reads still need a Korean name in the evidence list.
const partNames = { positive: '긍정 정서', negative: '부정 정서', balance: '정서 균형', presence: '의미의 존재', search: '의미의 추구' };
const partName = (id, key) => indicators.find(row => row.test === id && row.subscore === key)?.title ?? partNames[key] ?? key;

function scoreLine(result) {
  const name = testManifest[result.id]?.name ?? result.id.toUpperCase();
  // Forms without a meaningful total (TIPI, SPANE, MLQ) list their subscores instead.
  if (result.totalMeaningful === false) {
    return name + ' · ' + Object.entries(result.subscores).map(([key, score]) => {
      const [min, max] = result.subscoreRanges[key];
      const { prefix, main, unit } = scoreValue({ score, min, max, method: result.subscoreMethods?.[key] ?? result.method });
      return partName(result.id, key) + ' ' + (prefix ? prefix + ' ' : '') + main + unit.replace(/^\/ /, '/');
    }).join(', ');
  }
  const { prefix, main, unit } = scoreValue(result);
  let line = name + ' ' + (prefix ? prefix + ' ' : '') + main + unit.replace(/^\/ /, '/') + (result.band ? ' · ' + result.band : '');
  // A combined form lists the parts that are tests of their own (PHQ-4 → PHQ-2, GAD-2).
  const parts = Object.keys(result.subscores || {}).filter(key => testManifest[key] && result.subscoreRanges?.[key]);
  if (parts.length) line += ' (' + parts.map(key => testManifest[key].name + ' ' + result.subscores[key] + '/' + result.subscoreRanges[key][1] + '점').join(', ') + ')';
  return line;
}

// Forms whose every answer is a 2-week frequency (0 전혀 … 3 거의 매일). The total reads back as
// "how often" in the words of the answers the user picked, and the bar marks the score from which
// the developers advise a talk with a professional (GAD-7 and PHQ-9: 10; GAD-2 and PHQ-2: 3).
const frequencyForms = {
  gad7: { items: 7, symptom: '불안', refer: 10 },
  gad2: { items: 2, symptom: '불안', refer: 3 },
  phq9: { items: 9, symptom: '우울', refer: 10 },
  phq2: { items: 2, symptom: '우울', refer: 3 },
};

function frequencyLine(form, score) {
  const average = score / form.items;
  const subject = '지난 2주 동안 ' + form.symptom + ' 증상이 ';
  // At the referral line an average of "며칠" would read as reassurance under a caption that
  // advises a talk with a professional, so the line says the level instead.
  if (average < 1.5 && score >= form.refer) return subject + '상담을 권하는 수준이었어요.';
  if (average < 0.5) return subject + '거의 없었어요.';
  if (average < 1.5) return subject + '며칠 정도 있었어요.';
  if (average < 2.5) return '지난 2주 중 절반 이상의 날에 ' + form.symptom + ' 증상이 있었어요.';
  return subject + '거의 매일 있었어요.';
}

function referCaption(form, score) {
  return score >= form.refer
    ? '상담 권장선 ' + form.refer + '점 이상이에요. 전문가와 이야기해 보길 권해요.'
    : '상담 권장선 ' + form.refer + '점까지 ' + (form.refer - score) + '점 남았어요.';
}

function screeningModel(measured, row) {
  const { test, related, instrument, rank, group, source, label, band } = measured;
  const items = related.map(result => el('p', '', scoreLine(result)));
  const keys = Object.keys(test.answers || {});
  if (test.id !== 'phq4' && keys.length && keys.every(key => /^(?:phq9|gad7)\./.test(key))) items.push(el('p', '', screeningReflection([test])));
  else if (test.summary) items.push(el('p', '', test.summary));
  // Every card carries the same parts: number, bar, one caption line. The bar spans the form's own range.
  const { score, min, max, method } = measured;
  const unit = method === 'mean' ? '' : '점';
  const form = frequencyForms[measured.key ?? test.id];
  let metric = { value: scoreValue(measured),
    scale: { min, max, current: score, unit, caption: band || (row?.high ? '높을수록 ' + row.high + '이에요.' : '') } };
  if (form) {
    metric.description = frequencyLine(form, score);
    metric.scale = { ...metric.scale, caption: referCaption(form, score), mark: { at: form.refer, label: '상담 권장선' } };
  }
  if (rank != null) {
    metric = { ...rankMetric(rank, group + ' 100명 기준 환산 · 검사 점수가 높은 순'), description: metric.description };
    items.push(el('p', '', '조사 분포에서 같은 점수를 받은 사람들의 중간 위치를 100명 기준 등수로 환산했어요.'), sourceLink(label, source));
  } else if (group) {
    items.push(el('p', '', '이 연령에 맞는 비교 자료가 없어 검사 원점수를 표시해요.'));
  } else {
    items.push(el('p', '', '국내 비교 자료가 없어 순위 없이 검사 점수' + (band ? '와 출처의 점수 구간' : '') + '만 표시해요.'));
  }
  return { ...metric, meta: instrument + ' 검사 결과' + (test.sample ? ' · 예시 응답' : ''),
    evidence: { items } };
}

function pressureSummary(answers) {
  const scores = answers.map(block => ({ ...describeBlock(block), timed: block.timed, correct: block.trials.filter(t => t.correct).length }));
  const timed = scores.find(b => b.timed), free = scores.find(b => !b.timed);
  return { value: '시간 제한 없음 ' + free.count + ' · 제한 있음 ' + timed.count,
    detail: '각 조건에서 네 문제 중 맞힌 개수예요.', comparison: { score: timed.correct - free.correct, min: -4, max: 4 },
    basis: '시간 제한이 있을 때의 정답 수에서 제한이 없을 때의 정답 수를 뺐어요. 제한 없음 · ' + free.detail + '. 제한 있음 · ' + timed.detail + '.' };
}

function exerciseModel(topic, record, demo, row) {
  const summary = topic === pressureTopic ? pressureSummary(record.answers) : topic.summary(record.answers);
  const items = [evidence(topic, record, summary.basis)];
  let metric = { value: { main: summary.value }, description: summary.detail };
  if (demo && summary.comparison) {
    const { score, min, max } = summary.comparison;
    const direction = topic === pressureTopic ? '시간 제한을 걸었을 때 정답 수를 유지한 순' : row.high.replace(/편$/u, '순');
    metric = rankMetric(demoRank(score, min, max), '가상 100명 기준 환산 · ' + direction);
    items.unshift(el('p', '', summary.value + ' · ' + summary.detail));
    items.unshift(el('p', '', '체험용 비교군은 가능한 점수에 고르게 배치한 가상 응답 100개예요. 동점자는 중간 등수로 표시해요.'));
  }
  const source = topic === pressureTopic ? '과제 결과' : '검사 결과';
  return { ...metric, meta: metric.scale ? source + ' · 체험용 순위' : source, evidence: { items } };
}

function testButton(container, { label, detail, disabled, run }, accessibleName) {
  const button = el('button', 'btn assessment-start', label);
  button.type = 'button';
  if (accessibleName) button.setAttribute('aria-label', accessibleName);
  button.setAttribute('aria-description', detail);
  if (disabled) {
    button.disabled = true;
    return button;
  }
  button.onclick = async () => {
    if (button.getAttribute('aria-disabled') === 'true') return;
    button.setAttribute('aria-disabled', 'true');
    container.querySelector('[role=alert]')?.remove();
    try {
      await run();
    } catch {
      const message = el('p', 'inline-error', '검사를 열지 못했어요. 다시 눌러 주세요.');
      message.setAttribute('role', 'alert');
      container.append(message);
    } finally {
      button.removeAttribute('aria-disabled');
      if (button.isConnected) button.focus({ preventScroll: true });
    }
  };
  return button;
}

function actionButton(footer, action) {
  footer.append(el('p', 'profile-test-detail', action.detail));
  footer.append(testButton(footer, action));
}

// The one place that decides whether an indicator has a value. A finished test comes first,
// then a finished everyday exercise, then the conversation estimate (from the sample person's
// prior rank when `prior` is given). No source → null.
export function indicatorModel(row, { results, estimates, completed, demo, prior }) {
  const measured = row.test && completed && testResult(row, completed);
  if (measured) return { ...screeningModel(measured, row), source: 'test', test: measured.test.id };
  const topic = everydayById.get(row.everyday);
  const record = topic && results?.get(topic.id);
  if (record) return { ...exerciseModel(topic, record, demo, row), source: 'exercise' };
  const start = prior?.[row.id];
  if (!estimates || (!start && !estimateFor(estimates, row.id).count)) return null;
  return { ...estimateModel(row, estimates, start), source: 'conversation' };
}

// The ways to measure one row: its everyday exercise, then its test. Without `takeScreening`
// (the landing example) every action is shown but stays closed.
function rowActions(row, { results, completed }, { takeScreening }, done) {
  const actions = [];
  const topic = everydayById.get(row.everyday);
  if (topic) {
    const record = results?.get(topic.id);
    const pressure = topic === pressureTopic;
    actions.push({
      label: pressure ? (record ? '숫자 비교 과제 다시 하기' : '숫자 비교 과제 시작하기') : topic.title + (record ? ' 다시 검사하기' : ' 검사 시작하기'),
      short: pressure ? '과제하기' : '검사하기',
      detail: pressure ? '선택 과제 · 연습 2문제 · 본 과제 8문제' : ['선택 검사', topic.method.split(' · ')[0], topic.questions.length + '문항'].join(' · '),
      line: pressure ? '연습 2문제 · 본 과제 8문제' : topic.method.split(' · ')[0] + ' ' + topic.questions.length + '문항',
      disabled: !takeScreening,
      run: async () => {
        const answers = pressure ? await runPressureTask() : await runTopicQuestions(topic, record?.answers);
        if (answers) {
          results.set(topic.id, { answers });
          done();
        }
      },
    });
  }
  if (row.test) {
    const test = testManifest[row.test];
    const ready = test?.status === 'available';
    const name = test?.name ?? row.test.toUpperCase();
    const parts = ['선택 검사', name];
    if (test?.length) parts.push(test.length + '문항');
    actions.push({
      label: ready ? test.topic + (completed?.has(row.test) ? ' 다시 검사하기' : ' 검사 시작하기') : '준비 중',
      short: ready ? '검사하기' : '준비 중',
      detail: parts.join(' · ') + (ready ? '' : ' · 한국어판 검사지를 확인하고 있어 아직 열 수 없어요.'),
      line: name + (test?.length ? ' ' + test.length + '문항' : ''),
      pending: !ready,
      disabled: !ready || !takeScreening,
      run: async () => {
        if (await takeScreening(row.test)) done();
      },
    });
  }
  return actions;
}

// Rows that share one form (the five TIPI traits) become one list item.
function todoGroups(rows) {
  const groups = new Map();
  for (const row of rows) {
    const key = row.everyday ? row.id : row.test;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(row);
  }
  return [...groups.values()];
}

function profileCard(row, model, footer) {
  const card = el('details', 'result-card profile-result');
  renderProfileResult(card, { ...model, topic: row.icon || row.id, label: row.title }, footer);
  card.dataset.topic = row.id;
  card.dataset.source = model.source;
  if (model.test) card.dataset.test = model.test;
  return card;
}

// One big card with the row's test and exercise buttons in its footer. `render(ids)` redraws
// the report after a test or exercise finishes.
function rowCard(row, model, state, takeScreening, render, open) {
  const footer = el('div', 'profile-test-action');
  for (const action of rowActions(row, state, { takeScreening }, () => render([row.id]))) actionButton(footer, action);
  const card = profileCard(row, model, footer);
  card.open = open.has(row.id);
  return card;
}

const openCards = (container) => new Set([...container.querySelectorAll('details.profile-result[open]')].map(card => card.dataset.topic));

function focusCard(container, focusIds) {
  const target = focusIds.map(id => container.querySelector(`details.profile-result[data-topic="${id}"]`)).find(Boolean);
  if (!target) return;
  const summary = target.querySelector('summary') || target;
  summary.focus({ preventScroll: true });
  summary.scrollIntoView({ block: 'nearest' });
}

// With a sample person's prior every row has a value, so there is no '더 알아볼 지표' list.
// '대화로 바뀐 지표': rows the conversation moved, largest rank change first.
// '기록으로 본 지표': the rest, closest to 1등 first; a test result without a rank keeps its prior place.
function appendPriorReport(container, state, { takeScreening }) {
  const section = (title) => {
    const count = el('span', 'profile-count');
    const heading = el('h3', 'profile-section-title', title + ' ');
    heading.append(count);
    return { heading, count, deck: el('div', 'result-deck') };
  };
  const moved = section('대화로 바뀐 지표');
  const none = el('p', 'profile-test-detail', '이번 대화로 등수가 바뀐 지표는 없어요.');
  const rest = section('기록으로 본 지표');
  container.append(moved.heading, moved.deck, none, rest.heading, rest.deck);
  const rankOf = ({ row, model }) => model.value?.unit === '등' ? model.value.main : state.prior[row.id]?.rank ?? 50;
  const shift = ({ model }) => Math.abs(model.value.main - model.before);

  function render(focusIds = []) {
    const open = openCards(container);
    const models = indicators.map(row => ({ row, model: indicatorModel(row, state) })).filter(({ model }) => model);
    const changed = models.filter(({ model }) => model.changed).sort((a, b) => shift(b) - shift(a));
    // Mood and anxiety rows go last so a clinical label never heads the list.
    const clinical = ({ row }) => row.group === '기분과 불안';
    const others = models.filter(({ model }) => !model.changed).sort((a, b) => clinical(a) - clinical(b) || rankOf(a) - rankOf(b));
    for (const [part, list] of [[moved, changed], [rest, others]]) {
      part.count.textContent = list.length + '개';
      part.deck.replaceChildren(...list.map(({ row, model }) => rowCard(row, model, state, takeScreening, render, open)));
    }
    none.hidden = changed.length > 0;
    focusCard(container, focusIds);
  }
  render();
}

// Two parts: '알아낸 지표' (one big card per indicator with a value, in indicators.js order)
// and '더 알아볼 지표' (one line per form still to take; pending forms last).
// Finishing a test or exercise re-renders both parts, so the indicator moves up.
// `bigCard(row, model)` swaps the big card for another surface (the landing uses resultCard).
// `state.prior` (the phone demo's sample person) switches to appendPriorReport.
export function appendProfileReport(container, state, { takeScreening, bigCard } = {}) {
  if (state.prior && !bigCard) return appendPriorReport(container, state, { takeScreening });
  const countLabel = el('span', 'profile-count');
  const foundTitle = el('h3', 'profile-section-title', '알아낸 지표 ');
  foundTitle.append(countLabel);
  const deck = el('div', bigCard ? 'case-grid' : 'result-deck');
  const empty = el('p', 'profile-test-detail', '아직 알아낸 지표가 없어요. 아래 검사로 하나씩 채워 보세요.');
  const todoTitle = el('h3', 'profile-section-title', '더 알아볼 지표');
  const todo = el('ul', 'profile-todo');
  container.append(foundTitle, deck, empty, todoTitle, todo);

  function render(focusIds = []) {
    const open = openCards(deck);
    // `state.fill(row)` gives a model to rows with no value (the landing example fills all 24).
    const models = indicators.map(row => [row, indicatorModel(row, state) ?? state.fill?.(row) ?? null]);
    const known = models.filter(([, model]) => model);
    countLabel.textContent = known.length + ' / ' + indicators.length;
    empty.hidden = known.length > 0;
    deck.replaceChildren(...known.map(([row, model]) => bigCard ? bigCard(row, model) : rowCard(row, model, state, takeScreening, render, open)));
    const groups = todoGroups(models.filter(([, model]) => !model).map(([row]) => row));
    const items = groups.map(rows => {
      const title = rows.map(row => row.title).join(' · ');
      const actions = rowActions(rows[0], state, { takeScreening }, () => render(rows.map(row => row.id)));
      const action = actions.find(item => !item.pending) ?? actions[0];
      const item = el('li', 'profile-todo-item');
      item.dataset.topic = rows[0].id;
      if (action.pending) item.dataset.pending = '';
      const text = el('div');
      text.append(el('strong', '', title), el('p', 'profile-test-detail', action.line));
      item.append(text, testButton(item, { ...action, label: action.short }, title + ' · ' + action.label));
      return { pending: Boolean(action.pending), item };
    });
    todo.replaceChildren(...items.filter(entry => !entry.pending).map(entry => entry.item), ...items.filter(entry => entry.pending).map(entry => entry.item));
    todo.hidden = todoTitle.hidden = !items.length;
    focusCard(deck, focusIds);
  }
  render();
}
