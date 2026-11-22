import { midPercentile } from './profile-results.js';
import { readForm, screeners } from './screening-router.js';

export async function loadForm(id, signal) {
  if (!Object.hasOwn(screeners, id)) throw new Error('지원하지 않는 검사예요.');
  signal?.throwIfAborted();
  const form = await readForm(id);
  if (!form || form.id !== id) throw new Error('문항 파일을 열 수 없어요.');
  const items = form.items.map(({ form: original, source, missing, ...item }) => {
    if (missing || !item.text) throw new Error('검사 문항을 찾을 수 없어요.');
    // Some Korean forms print only the end labels; a middle option shows its number.
    const options = item.options.map((option) => ({ ...option, label: option.label ?? String(option.value) }));
    return { ...item, options, instruction: original.instruction ?? '', attribution: original.attribution };
  });
  return { ...form, items };
}

function bounds(item) {
  const values = item.options.map((option) => option.value);
  return [Math.min(...values), Math.max(...values)];
}

const round = (value) => Math.round(value * 100) / 100;

// A derived subscore as signed terms: "positive − negative" (subscore_rules.<key>.formula),
// ["positive", "-negative"], { difference: ['positive', 'negative'] } or { op, of: [...] }.
export function ruleTerms(rule) {
  const parse = (text) => [...String(text).matchAll(/([+\-−])?\s*([A-Za-z0-9_.]+)/gu)].map(([, sign, key]) => [sign === '-' || sign === '−' ? -1 : 1, key]);
  if (typeof rule === 'string') return parse(rule);
  if (Array.isArray(rule)) return rule.flatMap(parse);
  if (!rule || typeof rule !== 'object') return [];
  if (rule.formula || rule.expr) return parse(rule.formula || rule.expr);
  const op = rule.op || rule.operation || Object.keys(rule).find((key) => ['difference', 'minus', 'subtract', 'sum', 'add', 'plus'].includes(key));
  const list = rule.of || rule.terms || rule.args || rule[op];
  if (!Array.isArray(list)) return [];
  const minus = ['difference', 'minus', 'subtract'].includes(op);
  return list.map((key, i) => [minus && i > 0 ? -1 : 1, key]);
}

// subscore_rules holds either one rule for every subscore ({ method, range, note }) or one
// rule per subscore key ({ positive: { method, range }, balance: { method: 'difference', formula } }).
export function subscoreRule(form, key) {
  const rules = form.subscore_rules || {};
  if (rules[key] && typeof rules[key] === 'object' && !Array.isArray(rules[key])) return rules[key];
  if (typeof rules[key] === 'string' || Array.isArray(rules[key])) return { formula: rules[key] };
  return typeof rules.method === 'string' ? rules : {};
}

const derived = (rule) => Boolean(rule.formula || rule.expr || ['difference', 'minus', 'subtract'].includes(rule.method) || rule.op);

function fillSummary(template, values) {
  if (typeof template !== 'string') return '';
  return template.replace(/\{(\w+)\}/gu, (whole, key) => values[key] == null ? whole : String(values[key]));
}

export function scoreForm(form, answers) {
  for (const item of form.items) {
    if (!item.options.some((option) => option.value === answers[item.id])) throw new Error('모든 문항에 답해 주세요.');
  }
  const byId = new Map(form.items.map((item) => [item.id, item]));
  const reverse = new Set(form.scoring?.reverse_items || []);
  const mean = form.scoring?.method === 'mean';
  const value = (key) => {
    if (!reverse.has(key)) return answers[key];
    const [low, high] = bounds(byId.get(key));
    return low + high - answers[key];
  };
  const combine = (keys) => {
    const total = keys.reduce((n, key) => n + value(key), 0);
    return mean ? round(total / keys.length) : total;
  };
  const span = (keys) => {
    const [low, high] = keys.map((key) => bounds(byId.get(key))).reduce(([a, b], [c, d]) => [a + c, b + d], [0, 0]);
    return mean ? [low / keys.length, high / keys.length] : [low, high];
  };
  const ids = form.items.map((item) => item.id);
  const score = combine(ids);
  const [min, max] = form.scoring?.range || span(ids);
  const subscores = {}, subscoreRanges = {}, subscoreMethods = {};
  const keys = Object.keys(form.subscores || {});
  // Plain subscores first (sum or mean of their items), then subscores derived from them.
  for (const key of keys) {
    const rule = subscoreRule(form, key);
    if (derived(rule)) continue;
    const average = (rule.method || form.scoring?.method) === 'mean';
    const items = form.subscores[key];
    const total = items.reduce((n, id) => n + value(id), 0);
    const [low, high] = items.map((id) => bounds(byId.get(id))).reduce(([a, b], [c, d]) => [a + c, b + d], [0, 0]);
    subscores[key] = average ? round(total / items.length) : total;
    subscoreRanges[key] = average ? [low / items.length, high / items.length] : [low, high];
    subscoreMethods[key] = average ? 'mean' : 'sum';
  }
  for (const key of keys) {
    const rule = subscoreRule(form, key);
    if (!derived(rule)) continue;
    const terms = ruleTerms(rule);
    if (!terms.length || terms.some(([, term]) => !Object.hasOwn(subscores, term))) continue;
    let total = 0, low = 0, high = 0;
    for (const [sign, term] of terms) {
      const [a, b] = subscoreRanges[term];
      total += sign * subscores[term];
      low += sign > 0 ? a : -b;
      high += sign > 0 ? b : -a;
    }
    subscores[key] = round(total);
    subscoreRanges[key] = [low, high];
    subscoreMethods[key] = 'sum';
  }
  // Bands are optional: a source without published cut-offs has none.
  const band = (form.bands || []).find((entry) => entry.min <= score && score <= entry.max);
  const followups = (form.offers || []).filter((rule) => (rule.score === 'total' ? score : subscores[rule.score]) >= rule.at_least).map((rule) => rule.offer);
  const result = { id: form.id, score, min, max, method: mean ? 'mean' : 'sum', band: band?.label ?? null, bandMin: band?.min, bandMax: band?.max,
    subscores, subscoreRanges, subscoreMethods, followups, answers: Object.fromEntries(ids.map((key) => [key, answers[key]])) };
  result.totalMeaningful = form.scoring?.total_meaningful !== false;
  result.summary = fillSummary(form.summary, { score, band: band?.label, max, ...subscores });
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
