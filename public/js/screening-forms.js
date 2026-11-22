import { midPercentile } from './profile-results.js';
import { screeners } from './screening-router.js';

const definitions = new Map();

async function readDefinition(id, signal) {
  if (!Object.hasOwn(screeners, id)) throw new Error('지원하지 않는 검사예요.');
  if (definitions.has(id)) return definitions.get(id);
  const response = await fetch(new URL('../tests/' + id + '.json', import.meta.url), { signal });
  if (!response.ok) throw new Error('문항 파일을 열 수 없어요.');
  const data = await response.json();
  if (data.id !== id) throw new Error('문항 파일을 확인해 주세요.');
  definitions.set(id, data);
  return data;
}

export async function loadForm(id, signal) {
  const form = await readDefinition(id, signal);
  const sections = form.sections || [{ source: id, items: form.items.map((item) => item.id) }];
  const groups = await Promise.all(sections.map(async (section) => {
    const original = await readDefinition(section.source, signal);
    return section.items.map((key) => {
      const item = original.items.find((entry) => entry.id === key);
      if (!item) throw new Error('검사 문항을 찾을 수 없어요.');
      return { ...item, options: original.options, instruction: original.instruction, attribution: original.attribution };
    });
  }));
  return { ...form, items: groups.flat() };
}

export function scoreForm(form, answers) {
  const sum = (keys) => keys.reduce((n, key) => n + answers[key], 0);
  for (const item of form.items) {
    if (!item.options.some((option) => option.value === answers[item.id])) throw new Error('모든 문항에 답해 주세요.');
  }
  const score = sum(form.items.map((item) => item.id));
  const subscores = Object.fromEntries(Object.entries(form.subscores || {}).map(([sub, keys]) => [sub, sum(keys)]));
  const band = form.bands.find(({ min, max }) => min <= score && score <= max);
  const followups = (form.offers || []).filter((rule) => (rule.score === 'total' ? score : subscores[rule.score]) >= rule.at_least).map((rule) => rule.offer);
  const result = { id: form.id, score, max: form.scoring.range[1], band: band.label, bandMin: band.min, bandMax: band.max, subscores, followups,
    answers: Object.fromEntries(form.items.map((item) => [item.id, answers[item.id]])) };
  const reference = form.population_reference;
  if (reference) {
    const distribution = reference.weighted_percent_at_or_below;
    result.populationPercentile = midPercentile(distribution, score);
    result.source = reference.source;
    result.sourceLabel = reference.label;
  }
  return result;
}


// Short and extended forms share item IDs. Reflect the same answer only once.
export function screeningReflection(results) {
  const answers = Object.assign({}, ...Array.from(results, (result) => result.answers));
  const descriptions = {
    'phq9.1': '하던 일에서 즐거움을 느끼기 어려웠', 'phq9.2': '기분이 가라앉거나 앞날이 막막하게 느껴졌',
    'phq9.3': '잠자는 데 어려움이 있었', 'phq9.4': '피곤하거나 기운이 없었',
    'phq9.5': '식사량이나 입맛 때문에 불편했', 'phq9.6': '스스로를 부정적으로 바라봤',
    'phq9.7': '하던 일에 집중하기 어려웠', 'phq9.8': '몸이 처지거나 가만히 있기 어려웠', 'phq9.9': '마음이 힘들었',
    'gad7.1': '마음이 조마조마했', 'gad7.2': '걱정을 내려놓기 어려웠',
    'gad7.3': '여러 가지 일이 걱정됐', 'gad7.4': '마음을 편히 두기 어려웠',
    'gad7.5': '가만히 있기 어려울 만큼 안절부절못했', 'gad7.6': '쉽게 짜증이 났', 'gad7.7': '안 좋은 일이 생길까 봐 두려웠',
  };
  const frequency = ['', '며칠은', '일주일 이상', '거의 매일'];
  const experiences = [];
  for (const scale of ['phq9.', 'gad7.']) {
    const items = Object.keys(descriptions).filter((id) => id.startsWith(scale) && answers[id] > 0);
    if (!items.length) continue;
    const peak = items.reduce((a, b) => answers[a] >= answers[b] ? a : b);
    experiences.push(frequency[answers[peak]] + ' ' + descriptions[peak]);
  }
  if (experiences.length) return '지난 2주 동안 ' + experiences.join('고, ') + '다고 했어요.';
  return Object.keys(answers).length ? '지난 2주 동안에는 함께 돌아본 문항에서 일상이 방해받은 날이 없었다고 했어요.' : '';
}
