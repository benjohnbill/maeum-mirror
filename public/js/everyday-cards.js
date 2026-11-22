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
    details.append(el('p', '', '마음 시간표가 만든 ' + (topic === pressureTopic ? '비교 과제예요. 수치는 이번 문제에서의 수행을 보여줘요.' : '질문이에요. 결과는 여기서 직접 고른 응답을 요약해요.')));
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

// Conversation clues give a direction and the clues behind it, never a rank.
export function estimateModel(topic, estimates) {
  const row = indicatorById.get(topic.id) || topic;
  const { direction, score, count, evidence } = estimateFor(estimates, row.id);
  if (!count) return { value: { main: '단서 부족' }, meta: '대화로 추정',
    description: '아직 이 항목을 추정할 만한 이야기가 없어요.' };
  // The big slot holds only the number. Direction and the clues stay in the evidence.
  const rank = Math.max(1, Math.min(100, 100 - score));
  const side = direction > 0 ? row.high : direction < 0 ? row.low : '양쪽 단서가 비슷해요';
  const items = [el('p', '', '대화 단서 ' + count + '개 · ' + side + (direction ? ' 쪽으로 읽었어요.' : '.'))];
  for (const signal of evidence) {
    items.push(el('blockquote', '', signal.quote));
    items.push(el('p', '', '→ ' + (signal.cue || signal.item) + ' → ' + row.title + ' · ' + (signal.delta > 0 ? row.high : row.low)));
  }
  return { ...rankMetric(rank, '1등에 가까울수록 ' + row.high + '이에요.'), meta: '대화로 추정한 앱 내 순위 · 단서 ' + count + '개',
    evidence: { label: '어떤 답변이 반영됐나요?', items } };
}

function rankMetric(rank, caption) {
  return { value: { main: rank, unit: '등' },
    scale: { min: 1, max: 100, current: rank, unit: '등', caption } };
}

const number = (value) => Number.isInteger(value) ? String(value) : value.toFixed(1);

function scoreValue({ score, min, max, method }) {
  if (method === 'mean') return { prefix: '평균', main: number(score), unit: '/ ' + number(max) };
  if (min < 0) return { main: (score > 0 ? '+' : '') + score, unit: '점 (' + min + '~' + max + ')' };
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

function screeningModel(measured) {
  const { test, related, instrument, rank, group, source, label, band } = measured;
  const items = related.map(result => el('p', '', scoreLine(result)));
  const keys = Object.keys(test.answers || {});
  if (test.id !== 'phq4' && keys.length && keys.every(key => /^(?:phq9|gad7)\./.test(key))) items.push(el('p', '', screeningReflection([test])));
  else if (test.summary) items.push(el('p', '', test.summary));
  let metric = { value: scoreValue(measured), description: band || '' };
  if (rank != null) {
    metric = rankMetric(rank, group + ' 100명 기준 환산 · 검사 점수가 높은 순');
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

function actionButton(footer, { label, detail, disabled, run }) {
  footer.append(el('p', 'profile-test-detail', detail));
  const button = el('button', 'btn assessment-start', label);
  button.type = 'button';
  button.setAttribute('aria-description', detail);
  if (disabled) {
    button.disabled = true;
    footer.append(button);
    return;
  }
  button.onclick = async () => {
    if (button.getAttribute('aria-disabled') === 'true') return;
    button.setAttribute('aria-disabled', 'true');
    footer.querySelector('[role=alert]')?.remove();
    try {
      await run();
    } catch {
      const message = el('p', 'inline-error', '검사를 열지 못했어요. 다시 눌러 주세요.');
      message.setAttribute('role', 'alert');
      footer.append(message);
    } finally {
      button.removeAttribute('aria-disabled');
      if (button.isConnected) button.focus({ preventScroll: true });
    }
  };
  footer.append(button);
}

// One card per indicators.js row, in that order. Each card shows one source:
// a finished test, else a finished everyday exercise, else the conversation estimate.
export function appendProfileCards(deck, { results, estimates, completed, age, demo, takeScreening }) {
  for (const row of indicators) {
    const topic = everydayById.get(row.everyday);
    const card = el('details', 'result-card profile-result');
    function render(focus = false) {
      const record = topic && results.get(topic.id);
      const measured = row.test && testResult(row, completed, age);
      let model;
      if (measured) model = screeningModel(measured);
      else if (record) model = exerciseModel(topic, record, demo, row);
      else model = estimateModel(row, estimates);
      const footer = el('div', 'profile-test-action');
      if (topic) {
        const label = topic === pressureTopic
          ? (record ? '숫자 비교 과제 다시 하기' : '숫자 비교 과제 시작하기')
          : topic.title + (record ? ' 다시 검사하기' : ' 검사 시작하기');
        const detail = topic === pressureTopic ? '선택 과제 · 연습 2문제 · 본 과제 8문제'
          : ['선택 검사', topic.method.split(' · ')[0], topic.questions.length + '문항'].join(' · ');
        actionButton(footer, { label, detail, run: async () => {
          const answers = topic === pressureTopic ? await runPressureTask() : await runTopicQuestions(topic, record?.answers);
          if (answers) {
            results.set(topic.id, { answers });
            render(true);
          }
        } });
      }
      if (row.test) {
        const test = testManifest[row.test];
        const ready = test?.status === 'available';
        const parts = ['선택 검사', test?.name ?? row.test.toUpperCase()];
        if (test?.length) parts.push(test.length + '문항');
        const detail = parts.join(' · ') + (ready ? '' : ' · 한국어판 검사지를 확인하고 있어 아직 열 수 없어요.');
        const label = ready ? test.topic + (completed.has(row.test) ? ' 다시 검사하기' : ' 검사 시작하기') : '준비 중';
        actionButton(footer, { label, detail, disabled: !ready, run: async () => {
          if (await takeScreening(row.test)) render(true);
        } });
      }
      renderProfileResult(card, { ...model, topic: row.icon || row.id, label: row.title }, footer);
      card.dataset.topic = row.id;
      card.dataset.source = measured ? 'test' : record ? 'exercise' : 'conversation';
      if (measured) card.dataset.test = measured.test.id;
      if (focus) {
        const target = card.querySelector('summary');
        target.focus({ preventScroll: true });
        target.scrollIntoView({ block: 'nearest' });
      }
    }
    render();
    deck.append(card);
  }
}
