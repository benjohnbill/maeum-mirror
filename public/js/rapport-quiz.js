// Rapport quiz: before the conversation, the user guesses up to four of their own
// health numbers and sees the real value. One question per category; the time
// window for each question is drawn from the cells that suit that category.
import { nights } from './metrics.js';

const MAX_QUESTIONS = 4;
const DAY_MS = 86400000;
const keyOf = (d) => d.toISOString().slice(0, 10);
const shift = (k, n) => keyOf(new Date(Date.parse(k + 'T00:00:00Z') + n * DAY_MS));
const weekday = (k) => new Date(k + 'T00:00:00Z').getUTCDay();
const md = (k) => `${+k.slice(5, 7)}/${+k.slice(8, 10)}`;
const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sum = (a) => a.reduce((s, x) => s + x, 0);
const num = (x, digits = 0) => x.toLocaleString('ko-KR', { maximumFractionDigits: digits, minimumFractionDigits: digits });

// 372 -> "6시간 12분", 48 -> "48분", 120 -> "2시간".
const hm = (min) => {
  const h = Math.floor(Math.round(min) / 60), m = Math.round(min) % 60;
  return [h && `${h}시간`, m && `${m}분`].filter(Boolean).join(' ') || '0분';
};

const SEOUL_BUSAN_KM = 400;
const LOTTE_TOWER_FLOORS = 123;

// Day windows, relative to the last day of data (the export is made the day after).
function windowDays(through, id, random) {
  if (id === 'day') {
    const back = random() < 0.5 ? 0 : 1;
    return { days: [shift(through, -back)], label: back ? '그저께' : '어제' };
  }
  if (id === 'weekend') {
    let sat = through;
    while (weekday(sat) !== 6 || shift(sat, 1) > through) sat = shift(sat, -1);
    return { days: [sat, shift(sat, 1)], label: `지난 주말(${md(sat)}~${md(shift(sat, 1))})`, saturday: `지난주 토요일(${md(sat)})` };
  }
  if (id === 'week') return { days: Array.from({ length: 7 }, (_, i) => shift(through, -i)), label: '최근 일주일' };
  if (id === 'month') {
    const y = +through.slice(0, 4), m = +through.slice(5, 7);
    const first = m === 1 ? `${y - 1}-12-01` : `${y}-${String(m - 1).padStart(2, '0')}-01`;
    const days = [];
    for (let k = first; k.slice(0, 7) === first.slice(0, 7); k = shift(k, 1)) days.push(k);
    return { days, label: `지난달(${+first.slice(5, 7)}월)` };
  }
  return { days: Array.from({ length: 365 }, (_, i) => shift(through, -i)), label: '최근 1년' };
}

// Daily series per category: dayKey -> one number.
export const daily = {
  sleep: (d) => new Map([...nights(d.sleep)].map(([k, n]) => [k, n.asleep / 60])),
  steps: (d) => new Map([...d.steps].map(([k, m]) => [k, Math.max(...m.values())])),
  stride: (d) => new Map([...d.stride].map(([k, v]) => [k, mean(v)])),
  speed: (d) => new Map([...d.speed].map(([k, v]) => [k, mean(v)])),
  flights: (d) => new Map([...d.flights].map(([k, v]) => [k, sum(v)])),
  rhr: (d) => new Map([...d.rhr].map(([k, v]) => [k, mean(v)])),
  exercise: (d) => new Map([...d.exercise].map(([k, v]) => [k, sum(v)])),
  daylight: (d) => new Map([...d.daylight].map(([k, v]) => [k, sum(v)])),
};

// Each cell: how to aggregate the window, how to ask, the option step, and how to print a value.
// `single` asks about one day (the window's Saturday for weekend cells).
const CATEGORIES = {
  sleep: {
    words: ['짧았', '길었'],
    show: (h) => hm(h * 60),
    free: true,
    cells: {
      day: { agg: 'single', ask: (w) => `${w.label} 밤엔 몇 시간 잤을 것 같아요?` },
      weekend: { agg: 'single', ask: (w) => `${w.saturday} 밤엔 몇 시간 잤을 것 같아요?` },
      week: { agg: 'avg', ask: (w) => `${w.label}, 하루 평균 몇 시간 잤을 것 같아요?` },
      month: { agg: 'avg', ask: (w) => `${w.label} 하루 평균 수면은 몇 시간쯤이었을까요?` },
    },
  },
  steps: {
    words: ['적었', '많았'],
    cells: {
      day: { agg: 'single', step: 2000, unit: (x) => `${num(x)}걸음`, ask: (w) => `${w.label}는 몇 걸음 걸었을까요?` },
      weekend: { agg: 'single', step: 2000, unit: (x) => `${num(x)}걸음`, ask: (w) => `${w.saturday}엔 몇 걸음 걸었을까요?` },
      week: { agg: 'avg', step: 1500, unit: (x) => `${num(x)}걸음`, ask: (w) => `${w.label}, 하루 평균 몇 걸음 걸었을까요?` },
      month: { agg: 'avg', step: 1500, unit: (x) => `${num(x)}걸음`, ask: (w) => `${w.label} 하루 평균 걸음 수는요?` },
      year: {
        agg: 'sum', step: 1, digits: 1,
        convert: (total, d) => (total * strideMeters(d)) / 1000 / SEOUL_BUSAN_KM,
        unit: (x) => `${num(x, Number.isInteger(x) ? 0 : 1)}번`,
        exact: (x) => `서울–부산 ${num(x, 1)}번 거리(${num(x * SEOUL_BUSAN_KM)}km)`,
        ask: (w) => `${w.label} 걸은 거리를 합치면 서울에서 부산까지 몇 번쯤일까요?`,
      },
    },
  },
  stride: {
    words: ['짧았', '길었'],
    cells: { year: { agg: 'avg', step: 5, unit: (x) => `${num(x)}cm`, ask: () => '한 걸음에 몇 cm쯤 갈까요? 최근 1년 평균 보폭이에요.' } },
  },
  speed: {
    words: ['느렸', '빨랐'],
    cells: {
      month: { agg: 'avg', step: 0.5, digits: 1, unit: (x) => `${num(x, 1)}km/h`, ask: (w) => `${w.label} 평소 걷는 속도는 시속 몇 km였을까요?` },
      year: { agg: 'avg', step: 0.5, digits: 1, unit: (x) => `${num(x, 1)}km/h`, ask: (w) => `${w.label} 평균 걷는 속도는 시속 몇 km일까요?` },
    },
  },
  flights: {
    words: ['적었', '많았'],
    cells: {
      day: { agg: 'single', step: 3, unit: (x) => `${num(x)}층`, ask: (w) => `${w.label}는 계단을 몇 층쯤 올랐을까요?` },
      week: { agg: 'avg', step: 3, unit: (x) => `${num(x)}층`, ask: (w) => `${w.label}, 하루 평균 계단 몇 층을 올랐을까요?` },
      year: {
        agg: 'sum', step: 5,
        convert: (floors) => floors / LOTTE_TOWER_FLOORS,
        unit: (x) => `${num(x)}번`,
        exact: (x) => `롯데월드타워 ${num(x, 1)}번(${num(x * LOTTE_TOWER_FLOORS)}층)`,
        ask: (w) => `${w.label} 오른 계단을 합치면 롯데월드타워(123층) 몇 번쯤일까요?`,
      },
    },
  },
  rhr: {
    words: ['낮았', '높았'],
    cells: {
      week: { agg: 'avg', step: 5, unit: (x) => `${num(x)}회`, exact: (x) => `1분에 ${num(x)}회`, ask: (w) => `${w.label}, 가만히 있을 때 심장은 1분에 몇 번 뛰었을까요?` },
      year: { agg: 'avg', step: 5, unit: (x) => `${num(x)}회`, exact: (x) => `1분에 ${num(x)}회`, ask: (w) => `${w.label} 평균, 가만히 있을 때 심장은 1분에 몇 번 뛸까요?` },
    },
  },
  exercise: {
    words: ['적었', '많았'],
    cells: {
      weekend: { agg: 'sum', step: 20, unit: (x) => `${num(x)}분`, ask: (w) => `${w.label} 이틀 동안 운동한 시간은 모두 몇 분일까요?` },
      week: { agg: 'avg', step: 10, unit: (x) => `${num(x)}분`, ask: (w) => `${w.label}, 하루 평균 운동한 시간은요?` },
      month: { agg: 'sum', step: 3, convert: (min) => min / 60, unit: (x) => `${num(x)}시간`, exact: (x) => hm(x * 60), ask: (w) => `${w.label} 운동한 시간을 다 합치면 몇 시간일까요?` },
    },
  },
  daylight: {
    words: ['짧았', '길었'],
    cells: {
      weekend: { agg: 'avg', step: 15, unit: (x) => `${num(x)}분`, ask: (w) => `${w.label}, 하루에 햇빛 아래 몇 분 있었을까요?` },
      week: { agg: 'avg', step: 15, unit: (x) => `${num(x)}분`, ask: (w) => `${w.label}, 하루 평균 햇빛 아래 몇 분 있었을까요?` },
    },
  },
};

function strideMeters(d) {
  const all = [...(d.stride?.values() || [])].flat();
  return all.length ? mean(all) / 100 : 0.7;
}

// Aggregate one category over a window, or null when the window has too few days.
function measure(series, cell, w, data) {
  if (cell.agg === 'single') {
    const day = w.days[0];
    return series.has(day) ? series.get(day) : null;
  }
  const values = w.days.filter((k) => series.has(k)).map((k) => series.get(k));
  if (values.length < Math.ceil(w.days.length / 2)) return null;
  const raw = cell.agg === 'sum' ? sum(values) : mean(values);
  return cell.convert ? cell.convert(raw, data) : raw;
}

// Four options on the step grid; the rounded truth sits at a random position.
function options(truth, step, random) {
  const r = Math.max(step, Math.round(truth / step) * step);
  let at = Math.floor(random() * 4);
  while (at > 0 && r - at * step <= 0) at--;
  const fix = (x) => +x.toFixed(2);
  return { values: Array.from({ length: 4 }, (_, i) => fix(r + (i - at) * step)), correct: fix(r) };
}

// "7시간 반" -> 7.5, "7천" -> 7000, "1만 2천" -> 12000, "68" -> 68.
export function parseGuess(text) {
  const t = text.replace(/,/g, '');
  const m = t.match(/(\d+(?:\.\d+)?)\s*만(?:\s*(\d+(?:\.\d+)?)\s*천)?/);
  if (m) return +m[1] * 10000 + (m[2] ? +m[2] * 1000 : 0);
  const k = t.match(/(\d+(?:\.\d+)?)\s*천/);
  if (k) return +k[1] * 1000;
  const h = t.match(/(\d+(?:\.\d+)?)\s*시간\s*(반|(\d+)\s*분)?/);
  if (h) return +h[1] + (h[2] === '반' ? 0.5 : h[3] ? +h[3] / 60 : 0);
  const n = t.match(/\d+(?:\.\d+)?/);
  return n ? +n[0] : null;
}

// Pick the "였어요" or "이었어요" ending for the last Hangul syllable.
function was(text) {
  const c = text.trim().replace(/\)$/, '').at(-1).charCodeAt(0);
  const batchim = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return text + (batchim ? '이었어요' : '였어요');
}

export function buildQuiz(data, through, random = Math.random) {
  const usable = Object.keys(CATEGORIES).filter((id) => {
    const source = data[id];
    return source && (source instanceof Map ? source.size : source.length);
  });
  const order = usable.filter((id) => id !== 'sleep').sort(() => random() - 0.5);
  if (usable.includes('sleep')) order.unshift('sleep');

  const used = {};
  const questions = [];
  for (const id of order) {
    if (questions.length >= MAX_QUESTIONS) break;
    const category = CATEGORIES[id];
    const series = daily[id](data);
    const cells = Object.keys(category.cells).filter((c) => (used[c] || 0) < 2).sort(() => random() - 0.5);
    for (const windowId of cells) {
      const cell = category.cells[windowId];
      const w = windowDays(through, windowId, random);
      const truth = measure(series, cell, w, data);
      if (truth == null || truth <= 0) continue;
      used[windowId] = (used[windowId] || 0) + 1;
      questions.push(makeQuestion(id, category, cell, w, truth, random));
      break;
    }
  }
  return questions;
}

function makeQuestion(id, category, cell, w, truth, random) {
  const show = category.show || cell.exact || cell.unit;
  const exact = show(truth);
  const [less, more] = category.words;
  if (category.free) {
    return {
      id, text: cell.ask(w), choices: [],
      answer(reply) {
        const guess = parseGuess(reply);
        if (guess == null) return { reply: `넘어갈게요. 실제로는 ${was(exact)}.`, correct: false };
        const diff = (truth - guess) * 60;
        if (Math.abs(diff) < 30) return { reply: `거의 맞혔어요. 실제로 ${was(exact)}.`, correct: true };
        return { reply: `실제로는 ${was(exact)}. 생각보다 ${hm(Math.abs(diff))} ${diff > 0 ? more : less}어요.`, correct: false };
      },
    };
  }
  const { values, correct } = options(truth, cell.step, random);
  const labels = values.map((v) => cell.unit(v));
  return {
    id, text: cell.ask(w), choices: labels,
    answer(reply) {
      const picked = labels.includes(reply) ? values[labels.indexOf(reply)] : parseGuess(reply);
      if (picked == null) return { reply: `넘어갈게요. 실제로는 ${was(exact)}.`, correct: false };
      if (picked === correct) return { reply: `맞혔어요. 실제로 ${was(exact)}.`, correct: true };
      return { reply: `실제로는 ${was(exact)}. 고른 것보다 ${truth > picked ? more : less}어요.`, correct: false };
    },
  };
}
