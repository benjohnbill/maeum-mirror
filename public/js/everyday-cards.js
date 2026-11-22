import { el, renderProfileResult } from './report-elements.js';
import { answerQuestions, runAssessment } from './assessment-sheet.js';
import { everydayTopics, pressureTopic, resilienceTopic } from './everyday-topics.js';
import { describeBlock, runPressureTask } from './pressure-task.js';
import { clinicalResult, demoRank } from './profile-results.js';
import { screeningReflection } from './screening-forms.js';
import { screeners } from './screening-router.js';
import { estimateFor, traitAxes } from './trait-estimates.js';

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

const profileTopics = [
  { id: 'mood', title: '우울 증상', test: 'phq9' },
  resilienceTopic,
  { id: 'worry', title: '불안 지수', test: 'gad7' },
  ...everydayTopics,
];

// Describe the direction of a conversational clue, without interpreting it as a test score.
const clueDescriptions = {
  mood: ['기분이 가라앉거나 즐거움이 줄었다는 단서로 읽었어요.', '기분이 괜찮거나 즐거움을 느꼈다는 단서로 읽었어요.'],
  resilience: ['부담이 끝난 뒤 평소 생활로 돌아오기 수월했다는 단서로 읽었어요.', '부담이 끝난 뒤 평소 생활로 돌아오는 데 시간이 걸렸다는 단서로 읽었어요.'],
  worry: ['걱정 때문에 하던 일이 끊겼다는 단서로 읽었어요.', '걱정이 일상을 크게 방해하지 않았다는 단서로 읽었어요.'],
  delay: ['하려던 일의 시작을 미뤘다는 단서로 읽었어요.', '하려던 일을 미리 시작했다는 단서로 읽었어요.'],
  social: ['상대의 반응을 거절이나 내 탓으로 받아들였다는 단서로 읽었어요.', '상대의 반응에 다른 이유도 있을 수 있다고 봤어요.'],
  rumination: ['속상했던 일을 나중에도 되새겼다는 단서로 읽었어요.', '속상했던 일을 오래 곱씹지 않았다는 단서로 읽었어요.'],
  recognition: ['다른 사람이 알아봐 주는 게 중요했다는 단서로 읽었어요.', '다른 사람의 반응보다 스스로의 판단에 무게를 뒀다는 단서로 읽었어요.'],
  recovery: ['쉬고 나서 마음이 가벼워졌다는 단서로 읽었어요.', '쉬고 나서도 긴장이나 피로가 남았다는 단서로 읽었어요.'],
  pressure: ['시간이 촉박해도 집중을 유지했다는 단서로 읽었어요.', '시간이 촉박해지면서 집중하기 어려웠다는 단서로 읽었어요.'],
};

export function estimateModel(topic, estimates) {
  const { rank, evidence } = estimateFor(estimates, topic.id);
  if (!evidence.length) return { value: { main: '단서 부족' },
    description: '아직 이 항목을 추정할 만한 이야기가 없어요.' };
  const items = [];
  for (const positive of [true, false]) {
    const signals = evidence.filter(signal => (signal.delta > 0) === positive);
    if (!signals.length) continue;
    for (const signal of signals) items.push(el('blockquote', '', signal.quote));
    items.push(el('p', '', clueDescriptions[topic.id][positive ? 0 : 1]));
  }
  const caption = '1등에 가까울수록 ' + traitAxes[topic.id].replace(/ 순$/, ' 편이에요.');
  return { ...rankMetric(rank, caption), meta: '대화로 추정한 앱 내 순위',
    evidence: { label: '어떤 답변이 반영됐나요?', items } };
}

function rankMetric(rank, caption) {
  return { value: { main: rank, unit: '등' },
    scale: { min: 1, max: 100, current: rank, unit: '등', caption } };
}

function screeningModel(measured) {
  const { test, related, instrument, score, max, rank, group, source, label } = measured;
  const items = [];
  for (const result of related) {
    let basis = screeners[result.id].name + ' ' + result.score + '/' + result.max + '점 · ' + result.band;
    if (result.id === 'phq4') basis += ' (우울 ' + result.subscores.phq2 + '/6점, 불안 ' + result.subscores.gad2 + '/6점)';
    items.push(el('p', '', basis));
  }
  if (test.id !== 'phq4') items.push(el('p', '', screeningReflection([test])));
  let metric = { value: { main: score, unit: '/ ' + max + '점' }, description: test.id === 'phq4' ? '' : test.band };
  if (rank != null) {
    metric = rankMetric(rank, group + ' 100명 기준 환산 · 검사 점수가 높은 순');
    items.push(el('p', '', '조사 분포에서 같은 점수를 받은 사람들의 중간 위치를 100명 기준 등수로 환산했어요.'), sourceLink(label, source));
  } else {
    items.push(el('p', '', '이 연령에 맞는 비교 자료가 없어 검사 원점수를 표시해요.'));
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

function exerciseModel(topic, record, demo) {
  const summary = topic === pressureTopic ? pressureSummary(record.answers) : topic.summary(record.answers);
  const items = [evidence(topic, record, summary.basis)];
  let metric = { value: { main: summary.value }, description: summary.detail };
  if (demo && summary.comparison) {
    const { score, min, max } = summary.comparison;
    const direction = topic === pressureTopic ? '시간 제한을 걸었을 때 정답 수를 유지한 순' : traitAxes[topic.id];
    metric = rankMetric(demoRank(score, min, max), '가상 100명 기준 환산 · ' + direction);
    items.unshift(el('p', '', summary.value + ' · ' + summary.detail));
    items.unshift(el('p', '', '체험용 비교군은 가능한 점수에 고르게 배치한 가상 응답 100개예요. 동점자는 중간 등수로 표시해요.'));
  }
  const source = topic === pressureTopic ? '과제 결과' : '검사 결과';
  return { ...metric, meta: metric.scale ? source + ' · 체험용 순위' : source, evidence: { items } };
}

export function appendProfileCards(deck, { results, estimates, completed, age, demo, takeScreening }) {
  for (const topic of profileTopics) {
    const card = el('details', 'result-card profile-result');
    function render(focus = false) {
      const record = results.get(topic.id);
      const measured = topic.test && clinicalResult(topic.id, completed, age);
      // Only one source supplies the visible value, explanation and evidence for this topic.
      let model;
      if (measured) model = screeningModel(measured);
      else if (record) model = exerciseModel(topic, record, demo);
      else model = estimateModel(topic, estimates);
      const footer = el('div', 'profile-test-action');
      const test = screeners[topic.test];
      const retake = test ? completed.has(topic.test) : Boolean(record);
      const name = test ? test.topic : topic.title;
      const label = topic === pressureTopic
        ? (retake ? '숫자 비교 과제 다시 하기' : '숫자 비교 과제 시작하기')
        : name + (retake ? ' 다시 검사하기' : ' 검사 시작하기');
      const detail = topic === pressureTopic
        ? '선택 과제 · 연습 2문제 · 본 과제 8문제'
        : ['선택 검사', test?.name ?? topic.method.split(' · ')[0], (test?.length ?? topic.questions.length) + '문항'].join(' · ');
      const button = el('button', 'btn assessment-start', label);
      button.type = 'button';
      button.setAttribute('aria-description', detail);
      button.onclick = async () => {
        if (button.getAttribute('aria-disabled') === 'true') return;
        button.setAttribute('aria-disabled', 'true');
        footer.querySelector('[role=alert]')?.remove();
        try {
          if (topic.test) {
            if (await takeScreening(topic.test)) render(true);
          } else {
            const answers = topic === pressureTopic ? await runPressureTask() : await runTopicQuestions(topic, record?.answers);
            if (answers) {
              results.set(topic.id, { answers });
              render(true);
            }
          }
        } catch {
          const message = el('p', 'inline-error', '검사를 열지 못했어요. 다시 눌러 주세요.');
          message.setAttribute('role', 'alert');
          footer.append(message);
        } finally {
          button.removeAttribute('aria-disabled');
          if (button.isConnected) button.focus({ preventScroll: true });
        }
      };
      footer.append(el('p', 'profile-test-detail', detail), button);
      renderProfileResult(card, { ...model, topic: topic.id, label: topic.title }, footer);
      card.dataset.topic = topic.id;
      card.dataset.source = measured || record ? 'test' : 'conversation';
      if (measured) card.dataset.test = measured.test.id;
      if (!topic.test) card.dataset.trait = topic.id;
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
