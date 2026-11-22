// Stage 2 of the phone demo: find the one or two clearest changes in the user's own
// health records, then ask why (Q1) and why again about the answer (Q2). Each choice carries
// cues { indicator, item, dir }; trait-estimates.js cueSignals turns them into ledger signals.
import { nights, onsetOf, shift, keyToMin, WD } from './metrics.js';
import { daily } from './rapport-quiz.js';

/* ---------- Change detector ---------- */

// Recent windows (days ending at the last day of data) and the user's own baseline,
// days 31 to 120 back, which never overlaps any window.
const WINDOWS = [3, 7, 14, 30];
const BASE_FROM = 30;
const BASE_TO = 119;
const MIN_BASE_DAYS = 14;
const minDays = (w) => Math.max(3, Math.ceil(w * 0.6));

const mean = (a) => a.reduce((s, x) => s + x, 0) / a.length;
const sd = (a) => {
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};
const num = (x) => Math.round(x).toLocaleString('ko-KR');
const hm = (min) => {
  const h = Math.floor(Math.round(min) / 60), m = Math.round(min) % 60;
  return [h && `${h}시간`, m && `${m}분`].filter(Boolean).join(' ') || '0분';
};
// "4,234걸음" -> "4,234걸음이에요", "11월 8일(일)부터" -> "...부터예요".
const ida = (text) => {
  const c = text.trim().replace(/\)$/, '').at(-1).charCodeAt(0);
  const batchim = c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
  return text + (batchim ? '이에요' : '예요');
};
const clock = (min) => {
  const m = ((Math.round(min / 5) * 5) % 1440 + 1440) % 1440;
  const h = Math.floor(m / 60);
  const part = h < 5 ? '새벽' : h < 12 ? '오전' : h < 18 ? '오후' : '밤';
  return `${part} ${h % 12 || 12}시${m % 60 ? ` ${m % 60}분` : ''}`;
};

// family: the second change must come from another family (sleep length and onset move together).
// clear(base, recent): the change is large enough to mention in everyday words.
const METRICS = {
  sleep: {
    label: '수면 시간', family: 'sleep', record: 'sleep',
    series: (d) => daily.sleep(d), // hours
    clear: (b, r) => Math.abs(r - b) >= 0.5,
    show: (h) => hm(h * 60),
  },
  onset: {
    label: '잠드는 시각', family: 'sleep', record: 'onset',
    series: (d) => new Map([...nights(d.sleep)].map(([k, n]) => [k, onsetOf(n, k)])),
    clear: (b, r) => Math.abs(r - b) >= 30,
    show: clock,
  },
  steps: {
    label: '하루 걸음 수', family: 'move', record: 'steps',
    series: (d) => daily.steps(d),
    clear: (b, r) => Math.abs(r - b) / b >= 0.2,
    show: (x) => `${num(x)}걸음`,
  },
  flights: {
    label: '오른 층수', family: 'move',
    series: (d) => daily.flights(d),
    clear: (b, r) => Math.abs(r - b) / b >= 0.3 && Math.abs(r - b) >= 2,
    show: (x) => `${num(x)}층`,
  },
  daylight: {
    label: '햇빛 아래 있던 시간', family: 'outside',
    series: (d) => daily.daylight(d),
    clear: (b, r) => Math.abs(r - b) / b >= 0.3 && Math.abs(r - b) >= 10,
    show: (x) => `${num(x)}분`,
  },
  exercise: {
    label: '운동한 시간', family: 'exercise',
    series: (d) => daily.exercise(d),
    clear: (b, r) => Math.abs(r - b) / b >= 0.3 && Math.abs(r - b) >= 5,
    show: (x) => `${num(x)}분`,
  },
  workouts: {
    label: '운동 기록', family: 'exercise', record: 'workout', counts: true,
    // One entry per day with the number of recorded workouts, zero on other days.
    series: (d, through) => {
      const map = new Map();
      if (!d.workouts?.length) return map;
      for (let i = 0; i <= BASE_TO; i++) map.set(shift(through, -i), 0);
      for (const k of d.workouts) if (map.has(k)) map.set(k, map.get(k) + 1);
      return map;
    },
    clear: (b, r) => Math.abs(r - b) / b >= 0.5,
    show: (x) => (x ? `주 ${(x * 7).toFixed(1)}회` : '기록 없음'),
  },
  rhr: {
    label: '안정 시 심박', family: 'heart', record: 'rhr',
    series: (d) => daily.rhr(d),
    clear: (b, r) => Math.abs(r - b) >= 3,
    show: (x) => `분당 ${num(x)}회`,
  },
};

function valuesBack(series, through, from, to) {
  const out = [];
  for (let i = from; i <= to; i++) {
    const k = shift(through, -i);
    if (series.has(k)) out.push(series.get(k));
  }
  return out;
}

// The strongest window for one metric, or null when no window shows a clear change.
// Strength is a z statistic: the window mean against the baseline, in standard errors.
// Workout counts use a Poisson z because most days are zero.
function strongestWindow(id, series, through) {
  const metric = METRICS[id];
  const base = valuesBack(series, through, BASE_FROM, BASE_TO);
  if (base.length < MIN_BASE_DAYS) return null;
  const b = mean(base);
  const spread = sd(base);
  if (!(spread > 0) || !(b > 0 || id === 'onset')) return null;
  let best = null;
  for (const w of WINDOWS) {
    const recent = valuesBack(series, through, 0, w - 1);
    if (recent.length < minDays(w)) continue;
    const r = mean(recent);
    let z, effect;
    if (metric.counts) {
      const expected = b * recent.length;
      if (expected < 2) continue;
      z = (r * recent.length - expected) / Math.sqrt(expected);
      effect = z / Math.sqrt(recent.length) * 2; // comparable scale for the effect threshold
    } else {
      effect = (r - b) / spread;
      z = effect * Math.sqrt(recent.length);
    }
    if (Math.abs(effect) < 0.6 || Math.abs(z) < (metric.counts ? 2 : 2.5) || !metric.clear(b, r)) continue;
    if (!best || Math.abs(z) > Math.abs(best.z)) best = { window: w, base: b, recent: r, spread, days: recent.length, z };
  }
  return best;
}

// The first day inside the window that sits on the changed side of the midpoint between
// normal and recent, so the question can name a concrete date instead of the window length.
// When that is the window's first day, walk back while earlier days are also changed.
function startDay(series, through, found) {
  const mid = (found.base + found.recent) / 2;
  const changed = (k) => (found.recent > found.base ? series.get(k) > mid : series.get(k) < mid);
  let start = null;
  for (let i = found.window - 1; i >= 0 && !start; i--) {
    const k = shift(through, -i);
    if (series.has(k) && changed(k)) start = k;
  }
  if (!start) return shift(through, -(found.window - 1));
  if (start !== shift(through, -(found.window - 1))) return start;
  for (let i = found.window; i < BASE_FROM; i++) {
    const k = shift(through, -i);
    if (!series.has(k)) continue;
    if (!changed(k)) break;
    start = k;
  }
  return start;
}

export function detectChanges(data, through, { limit = 2 } = {}) {
  const found = [];
  for (const [id, metric] of Object.entries(METRICS)) {
    const series = metric.series(data, through);
    if (!series.size) continue;
    const best = strongestWindow(id, series, through);
    if (!best) continue;
    const direction = best.recent > best.base ? 'up' : 'down';
    const start = metric.counts
      ? (lastBefore(data.workouts, through, best.window) ?? shift(through, -(best.window - 1)))
      : startDay(series, through, best);
    found.push({
      id, label: metric.label, family: metric.family, record: metric.record, direction, ...best, start, through,
      baseText: metric.show(best.base), recentText: metric.show(best.recent),
    });
  }
  found.sort((a, b) => Math.abs(b.z) - Math.abs(a.z));
  const picked = [];
  for (const change of found) {
    if (picked.length >= limit) break;
    if (picked.some((p) => p.family === change.family)) continue;
    picked.push(change);
  }
  return picked;
}

// For "no workouts since ...": the day after the last workout before the quiet stretch.
function lastBefore(workouts, through, window) {
  const from = shift(through, -(window - 1));
  const before = workouts.filter((k) => k < from).sort().at(-1);
  const inside = workouts.filter((k) => k >= from && k <= through);
  return before && !inside.length ? shift(before, 1) : null;
}

/* ---------- Wording ---------- */

const md = (k) => `${+k.slice(5, 7)}/${+k.slice(8, 10)}`;
const wd = (k) => WD[new Date(keyToMin(k) * 60000).getUTCDay()];
const daysBetween = (a, b) => Math.round((keyToMin(b) - keyToMin(a)) / 1440);

// The export is made the day after the last day of data, so "today" is through + 1.
function since(start, through) {
  const today = shift(through, 1);
  const ago = daysBetween(start, today);
  const monday = (k) => shift(k, -((new Date(keyToMin(k) * 60000).getUTCDay() + 6) % 7));
  const weeks = daysBetween(monday(start), monday(today)) / 7;
  if (ago === 1) return `어제(${md(start)})부터`;
  if (ago === 2) return `그저께(${md(start)})부터`;
  if (weeks === 0) return `이번 주 ${wd(start)}요일(${md(start)})부터`;
  if (weeks === 1) return `지난주 ${wd(start)}요일(${md(start)})부터`;
  return `${+start.slice(5, 7)}월 ${+start.slice(8, 10)}일(${wd(start)})부터`;
}

function span(change) {
  const days = daysBetween(change.start, change.through) + 1;
  if (days >= 25) return '한 달 가까이';
  if (days >= 12) return `${Math.round(days / 7)}주째`;
  if (days >= 6) return '일주일 가까이';
  return `${days}일째`;
}

function ratioWords(change) {
  const ratio = change.recent / change.base;
  if (ratio < 0.15) return '거의 없어요';
  if (ratio < 0.4) return '평소의 3분의 1쯤이에요';
  if (ratio < 0.6) return '평소의 절반쯤이에요';
  if (ratio < 1) return `평소보다 ${Math.round((1 - ratio) * 100)}%쯤 적어요`;
  if (ratio >= 1.8) return '평소의 두 배 가까이 돼요';
  return `평소보다 ${Math.round((ratio - 1) * 100)}%쯤 많아요`;
}

// About how much, rounded for talk: 2시간 반쯤, 40분쯤.
function rough(minutes) {
  const m = Math.abs(minutes);
  if (m < 50) return `${Math.max(10, Math.round(m / 10) * 10)}분쯤`;
  const half = Math.round(m / 30) / 2;
  return `${Math.floor(half)}시간${half % 1 ? ' 반' : ''}쯤`;
}

// One short sentence about the change with one number: since when, what, how much, which way.
// The exact values stay in the record panel.
function describe(change) {
  const metric = METRICS[change.id];
  const from = since(change.start, change.through).replace(/\([^)]*\)/, '');
  const up = change.direction === 'up';
  const diff = change.recent - change.base;
  return {
    sleep: `${from} 잠이 평소보다 하루 ${rough(diff * 60)} ${up ? '늘었어요' : '줄었어요'}.`,
    onset: `${from} 평소보다 ${rough(diff)} ${up ? '늦게' : '일찍'} 주무시고 있어요.`,
    steps: `${from} 하루 걸음이 ${ratioWords(change)}.`,
    flights: `${from} 오르신 계단이 ${ratioWords(change)}.`,
    daylight: `${from} 햇빛 아래 계신 시간이 ${ratioWords(change)}.`,
    exercise: `${from} 운동하신 시간이 ${ratioWords(change)}.`,
    workouts: up ? `${from} 운동 기록이 평소보다 자주 있어요.`
      : change.recent === 0 ? `평소 있던 운동 기록이 ${from} 없어요.`
        : `${from} 운동 기록이 평소보다 드물어요.`,
    rhr: `${from} 가만히 계실 때 심박이 평소보다 ${Math.round(Math.abs(diff))}회쯤 ${up ? '높아요' : '낮아요'}.`,
  }[change.id];
}

// For the report: one plain line about the period and the values.
export function recordLine(change) {
  const metric = METRICS[change.id];
  return `${since(change.start, change.through).replace(/부터$/, '')}부터 ${md(change.through)}까지 ${metric.show(change.recent)} · 평소 ${metric.show(change.base)}`;
}

/* ---------- Question bank ---------- */

// Item ids are cue ids from trait-estimates.js cueTable(): test items ('cbi.1', 'tipi.3')
// and everyday questions ('recovery.2' = tension right after resting, 0-based).
// A cue names a row of the table and the direction (1 toward `high`, -1 toward `low`); it has no size.
const c = (indicator, item, dir) => ({ indicator, item, dir });

// Q2 asks why about the first answer. Keys are reason kinds; `life` covers reasons outside the
// person (travel, illness, weather) and free text with no cue. Choices are everyday reasons, not symptoms.
const WHY = {
  burnout: {
    asks: ['할 일이 그렇게 몰린 데는 이유가 있었어요?', '요즘 그렇게 바쁘셨던 건 왜였을까요?'],
    choices: [
      { text: '미뤄 둔 일이 한꺼번에 몰렸어요', cues: [c('delay', 'delay.2', 1)] },
      { text: '잘 해내고 싶어서 끝까지 붙잡고 있었어요', cues: [c('conscientiousness', 'tipi.3', 1)] },
      { text: '쉬어도 피곤이 안 풀려서 일이 더뎠어요', cues: [c('burnout', 'cbi.1', 1)] },
      { text: '그 시기엔 원래 일이 많아요', cues: [] },
    ],
  },
  worry: {
    asks: ['그 생각이 자꾸 떠오른 데는 이유가 있었어요?', '무엇이 그렇게 마음에 걸리셨어요?'],
    choices: [
      { text: '결과를 기다리는 일이 있었어요', cues: [c('worry', 'gad7.1', 1)] },
      { text: '원래 걱정이 많은 편이에요', cues: [c('worry', 'gad7.3', 1), c('stability', 'tipi.4', -1)] },
      { text: '딱히 이유 없이 생각이 꼬리를 물었어요', cues: [c('worry', 'gad7.2', 1)] },
      { text: '사람 사이에 마음 쓰이는 일이 있었어요', cues: [c('affect', 'spane.2', -1)] },
    ],
  },
  phone: {
    asks: ['휴대폰을 오래 보게 된 데는 이유가 있었어요?', '그 시간엔 왜 휴대폰을 붙잡게 되셨을까요?'],
    choices: [
      { text: '보다 보면 시간 가는 줄 몰랐어요', cues: [c('phone', 'sassv.9', 1)] },
      { text: '연락이나 알림을 놓칠까 봐 계속 봤어요', cues: [c('phone', 'sassv.8', 1)] },
      { text: '잠이 안 와서 그냥 들고 있었어요', cues: [c('mood', 'phq9.3', 1)] },
      { text: '하루 중 쉬는 시간이 그때뿐이었어요', cues: [] },
    ],
  },
  fatigue: {
    asks: ['그렇게 지치신 데는 짚이는 이유가 있었어요?', '기운이 빠진 건 무엇 때문이었을까요?'],
    choices: [
      { text: '일이나 공부에 힘을 많이 쏟았어요', cues: [c('burnout', 'cbi.1', 1)] },
      { text: '마음 쓰이는 일이 있어서 더 지쳤어요', cues: [c('burnout', 'cbi.3', 1)] },
      { text: '쉬는 날에도 제대로 못 쉬었어요', cues: [c('recovery', 'recovery.2', -1)] },
      { text: '감기 기운이 있었어요', cues: [] },
    ],
  },
  mood: {
    asks: ['그렇게 내키지 않았던 데는 이유가 있었어요?', '마음이 잘 안 움직인 건 왜였을까요?'],
    choices: [
      { text: '요즘 재미있는 일이 별로 없었어요', cues: [c('mood', 'phq9.1', 1), c('flourishing', 'fs.3', -1)] },
      { text: '기운이 없어서 다 귀찮았어요', cues: [c('mood', 'phq9.4', 1)] },
      { text: '혼자 조용히 쉬고 싶었어요', cues: [c('extraversion', 'tipi.6', -1)] },
      { text: '날씨나 일정 때문이었어요', cues: [] },
    ],
  },
  rested: {
    asks: ['푹 주무시려고 마음먹으신 계기가 있었어요?', '잠을 챙기시게 된 이유가 있었어요?'],
    choices: [
      { text: '그동안 너무 지쳐 있었어요', cues: [c('burnout', 'cbi.1', 1)] },
      { text: '잘 자고 나면 마음이 풀리더라고요', cues: [c('recovery', 'recovery.2', 1)] },
      { text: '중요한 일을 앞두고 컨디션을 챙겼어요', cues: [c('conscientiousness', 'tipi.3', 1)] },
      { text: '시간이 나서 늦잠을 잤어요', cues: [] },
    ],
  },
  tension: {
    asks: ['낮에 개인 시간이 없으셨던 이유가 있었어요?', '하루가 그렇게 빠듯했던 건 왜였을까요?'],
    choices: [
      { text: '일과 할 일이 낮을 다 채웠어요', cues: [c('burnout', 'cbi.1', 1)] },
      { text: '퇴근해도 머리가 계속 일 생각이었어요', cues: [c('worry', 'gad7.4', 1)] },
      { text: '밤이 돼야 마음이 좀 놓였어요', cues: [c('worry', 'gad7.1', 1)] },
      { text: '집안일이나 가족을 챙기느라 바빴어요', cues: [] },
    ],
  },
  recovery: {
    asks: ['머리를 식힐 시간이 필요하셨던 이유가 있었어요?', '그렇게 쉬어 가시게 된 계기가 있었어요?'],
    choices: [
      { text: '일이 많아서 잠깐이라도 벗어나고 싶었어요', cues: [c('burnout', 'cbi.1', 1)] },
      { text: '움직이고 나면 마음이 풀리더라고요', cues: [c('recovery', 'recovery.2', 1)] },
      { text: '새로운 길을 걸어 보는 게 좋았어요', cues: [c('openness', 'tipi.5', 1)] },
      { text: '날이 좋아서요', cues: [] },
    ],
  },
  restless: {
    asks: ['마음이 답답하셨던 데는 이유가 있었어요?', '무엇 때문에 그렇게 답답하셨을까요?'],
    choices: [
      { text: '신경 쓰이는 일이 머리에서 안 떠났어요', cues: [c('worry', 'gad7.2', 1)] },
      { text: '가만히 있으면 더 초조했어요', cues: [c('worry', 'gad7.5', 1)] },
      { text: '누군가와 서운한 일이 있었어요', cues: [c('affect', 'spane.2', -1)] },
      { text: '이유는 잘 모르겠어요', cues: [] },
    ],
  },
  energy: {
    asks: ['새로 해 보시게 된 계기가 있었어요?', '그걸 시작하시게 된 이유가 있었어요?'],
    choices: [
      { text: '새로운 걸 해 보고 싶었어요', cues: [c('openness', 'tipi.5', 1)] },
      { text: '사람들과 어울리는 게 좋아서요', cues: [c('extraversion', 'tipi.1', 1)] },
      { text: '요즘 기분이 좋아서 뭐든 해 보고 싶었어요', cues: [c('affect', 'spane.3', 1)] },
      { text: '친구가 같이 하자고 했어요', cues: [] },
    ],
  },
  routine: {
    asks: ['그렇게 마음먹으신 계기가 있었어요?', '꾸준히 하시게 된 이유가 있었어요?'],
    choices: [
      { text: '한번 정한 건 지키는 편이에요', cues: [c('conscientiousness', 'tipi.3', 1)] },
      { text: '몸이 예전 같지 않아서 챙기기로 했어요', cues: [c('burnout', 'cbi.6', 1)] },
      { text: '하고 나면 기분이 좋아서요', cues: [c('affect', 'spane.3', 1)] },
      { text: '건강검진 결과를 보고 시작했어요', cues: [] },
    ],
  },
  joy: {
    asks: ['요즘 사람들을 자주 만나신 이유가 있었어요?', '같이 하시게 된 계기가 있었어요?'],
    choices: [
      { text: '사람들과 있으면 힘이 나요', cues: [c('extraversion', 'tipi.1', 1), c('flourishing', 'fs.2', 1)] },
      { text: '오랜만에 여유가 생겼어요', cues: [c('burnout', 'cbi.1', -1)] },
      { text: '혼자 있으면 기분이 가라앉아서요', cues: [c('affect', 'spane.2', -1)] },
      { text: '모임 일정이 우연히 겹쳤어요', cues: [] },
    ],
  },
  calm: {
    asks: ['마음이 편해진 데는 이유가 있었어요?', '무엇 덕분에 차분해지셨을까요?'],
    choices: [
      { text: '신경 쓰던 일이 잘 마무리됐어요', cues: [c('worry', 'gad7.3', -1)] },
      { text: '쉬는 시간을 잘 챙겼어요', cues: [c('recovery', 'recovery.2', 1)] },
      { text: '원래 크게 흔들리지 않는 편이에요', cues: [c('stability', 'tipi.9', 1)] },
      { text: '일이 좀 줄었어요', cues: [c('burnout', 'cbi.1', -1)] },
    ],
  },
  delay: {
    asks: ['자꾸 미루시게 된 데는 이유가 있었어요?', '손이 잘 안 간 건 왜였을까요?'],
    choices: [
      { text: '시작하기까지가 제일 힘들었어요', cues: [c('delay', 'delay.4', 1)] },
      { text: '내일 하면 되지 싶었어요', cues: [c('delay', 'delay.3', 1)] },
      { text: '할 일이 많아 지쳐 있었어요', cues: [c('burnout', 'cbi.1', 1)] },
      { text: '날씨나 일정이 안 맞았어요', cues: [] },
    ],
  },
  drinking: {
    asks: ['술자리가 늘어난 데는 이유가 있었어요?', '요즘 자주 마시게 되신 건 왜였을까요?'],
    choices: [
      { text: '한잔하면 긴장이 좀 풀려서요', cues: [c('worry', 'gad7.4', 1)] },
      { text: '마시다 보면 양이 늘었어요', cues: [c('alcohol', 'auditc.2', 1)] },
      { text: '사람들과 어울리는 게 좋아서요', cues: [c('extraversion', 'tipi.1', 1)] },
      { text: '모임이나 회식이 많은 시기였어요', cues: [] },
    ],
  },
  life: {
    asks: ['그 일이 있던 동안은 어떻게 지내셨어요?', '그동안 마음은 좀 어떠셨어요?'],
    choices: [
      { text: '오랜만에 기분 전환이 됐어요', cues: [c('affect', 'spane.3', 1)] },
      { text: '정신없이 바빠서 좀 지쳤어요', cues: [c('burnout', 'cbi.1', 1)] },
      { text: '생활 리듬이 흐트러져서 신경 쓰였어요', cues: [c('stability', 'tipi.4', -1)] },
      { text: '별일 없이 지나갔어요', cues: [] },
    ],
  },
};

// Free-text answers pick the WHY entry by their first cue: [when dir is 1, when dir is -1].
// Indicators not listed here, and null entries, use `life`.
const WHY_BY_INDICATOR = {
  mood: ['mood', null], burnout: ['burnout', null], worry: ['worry', 'calm'], phone: ['phone', null],
  recovery: ['recovery', 'tension'], affect: ['energy', 'mood'], delay: ['delay', null], alcohol: ['drinking', null],
  stability: ['calm', 'worry'], conscientiousness: ['routine', null], extraversion: ['joy', null], flourishing: [null, 'mood'],
};

export function whyKeyFor(cues) {
  const [first] = cues;
  return (first && WHY_BY_INDICATOR[first.indicator]?.[first.dir > 0 ? 0 : 1]) || 'life';
}

// metric × direction -> 3–4 reasons. dir is the sign the reason points on that indicator;
// `why` names the WHY entry for Q2.
const BANK = {
  sleep: {
    down: {
      choices: [
        { text: '할 일이 많아서 늦게까지 깨어 있었어요', cues: [c('burnout', 'cbi.1', 1)], why: 'burnout' },
        { text: '누워도 생각이 많아 잠이 안 왔어요', cues: [c('worry', 'gad7.2', 1), c('mood', 'phq9.3', 1)], why: 'worry' },
        { text: '휴대폰을 보다가 늦게 잤어요', cues: [c('phone', 'sassv.9', 1)], why: 'phone' },
        { text: '여행이나 일정 때문이었어요', cues: [], why: 'life' },
      ],
    },
    up: {
      choices: [
        { text: '피곤해서 자도 자도 졸렸어요', cues: [c('mood', 'phq9.4', 1), c('burnout', 'cbi.1', 1)], why: 'fatigue' },
        { text: '딱히 할 게 없어서 오래 누워 있었어요', cues: [c('mood', 'phq9.1', 1), c('flourishing', 'fs.3', -1)], why: 'mood' },
        { text: '일부러 푹 자려고 했어요', cues: [c('recovery', 'recovery.2', 1)], why: 'rested' },
        { text: '아파서 쉬었어요', cues: [], why: 'life' },
      ],
    },
  },
  onset: {
    up: {
      choices: [
        { text: '일이나 공부가 밤까지 이어졌어요', cues: [c('burnout', 'cbi.1', 1)], why: 'burnout' },
        { text: '밤에만 내 시간이 있어서 늦게까지 버텼어요', cues: [c('recovery', 'recovery.2', -1), c('burnout', 'cbi.3', 1)], why: 'tension' },
        { text: '누워도 걱정이 많아 잠이 늦게 들었어요', cues: [c('worry', 'gad7.1', 1), c('mood', 'phq9.3', 1)], why: 'worry' },
        { text: '휴대폰이나 영상을 보다 보니 늦어졌어요', cues: [c('phone', 'sassv.9', 1)], why: 'phone' },
      ],
    },
    down: {
      choices: [
        { text: '저녁이면 금방 지쳐서 일찍 눕게 돼요', cues: [c('burnout', 'cbi.1', 1)], why: 'burnout' },
        { text: '일찍 자고 일찍 일어나려고 마음먹었어요', cues: [c('conscientiousness', 'tipi.3', 1)], why: 'routine' },
        { text: '저녁에 할 게 없어서 일찍 누워요', cues: [c('mood', 'phq9.1', 1), c('flourishing', 'fs.3', -1)], why: 'mood' },
        { text: '아침 일정이 생겼어요', cues: [], why: 'life' },
      ],
    },
  },
  steps: {
    down: {
      choices: [
        { text: '나가기가 싫었어요', cues: [c('mood', 'phq9.1', 1), c('affect', 'spane.1', -1)], why: 'mood' },
        { text: '일이 많아 책상 앞에만 있었어요', cues: [c('burnout', 'cbi.1', 1)], why: 'burnout' },
        { text: '몸이 무겁고 기운이 없었어요', cues: [c('mood', 'phq9.4', 1), c('burnout', 'cbi.2', 1)], why: 'fatigue' },
        { text: '날씨가 춥거나 비가 왔어요', cues: [], why: 'life' },
      ],
    },
    up: {
      choices: [
        { text: '산책하면서 머리를 식혔어요', cues: [c('recovery', 'recovery.2', 1), c('affect', 'spane.1', 1)], why: 'recovery' },
        { text: '마음이 답답해서 무작정 걸었어요', cues: [c('worry', 'gad7.5', 1), c('affect', 'spane.2', -1)], why: 'restless' },
        { text: '새로 시작한 운동이나 모임이 있어요', cues: [c('openness', 'tipi.5', 1), c('affect', 'spane.1', 1)], why: 'energy' },
        { text: '여행이나 이사로 많이 다녔어요', cues: [], why: 'life' },
      ],
    },
  },
  flights: {
    down: {
      choices: [
        { text: '움직이기가 귀찮았어요', cues: [c('mood', 'phq9.4', 1), c('burnout', 'cbi.2', 1)], why: 'fatigue' },
        { text: '바빠서 거의 앉아만 있었어요', cues: [c('burnout', 'cbi.1', 1)], why: 'burnout' },
        { text: '다리가 아프거나 몸이 안 좋았어요', cues: [], why: 'life' },
        { text: '출근길이나 사는 곳이 바뀌었어요', cues: [], why: 'life' },
      ],
    },
    up: {
      choices: [
        { text: '건강 챙기려고 일부러 계단으로 다녔어요', cues: [c('conscientiousness', 'tipi.3', 1)], why: 'routine' },
        { text: '등산이나 나들이를 다녀왔어요', cues: [c('affect', 'spane.1', 1), c('openness', 'tipi.5', 1)], why: 'energy' },
        { text: '출근길이나 사는 곳이 바뀌었어요', cues: [], why: 'life' },
      ],
    },
  },
  daylight: {
    down: {
      choices: [
        { text: '집에만 있고 싶었어요', cues: [c('mood', 'phq9.1', 1), c('extraversion', 'tipi.6', -1)], why: 'mood' },
        { text: '실내에서 일하는 시간이 길어졌어요', cues: [c('burnout', 'cbi.1', 1)], why: 'burnout' },
        { text: '해가 짧아지고 추워졌어요', cues: [], why: 'life' },
        { text: '워치를 잘 안 찼어요', cues: [], why: 'life' },
      ],
    },
    up: {
      choices: [
        { text: '일부러 밖에서 쉬는 시간을 가졌어요', cues: [c('recovery', 'recovery.2', 1), c('affect', 'spane.1', 1)], why: 'recovery' },
        { text: '나들이나 약속이 많았어요', cues: [c('extraversion', 'tipi.1', 1), c('affect', 'spane.10', 1)], why: 'joy' },
        { text: '외근이나 이동이 많았어요', cues: [], why: 'life' },
      ],
    },
  },
  exercise: {
    down: {
      choices: [
        { text: '운동할 마음이 잘 안 생겼어요', cues: [c('mood', 'phq9.1', 1), c('flourishing', 'fs.3', -1)], why: 'mood' },
        { text: '일이 바빠 시간이 없었어요', cues: [c('burnout', 'cbi.1', 1)], why: 'burnout' },
        { text: '하려고 했는데 자꾸 미뤘어요', cues: [c('delay', 'delay.4', 1)], why: 'delay' },
        { text: '다치거나 아파서 쉬었어요', cues: [], why: 'life' },
      ],
    },
    up: {
      choices: [
        { text: '스트레스를 풀려고 운동했어요', cues: [c('recovery', 'recovery.2', 1)], why: 'recovery' },
        { text: '목표가 생겨서 꾸준히 해요', cues: [c('conscientiousness', 'tipi.3', 1), c('affect', 'spane.1', 1)], why: 'routine' },
        { text: '친구와 같이 하게 됐어요', cues: [c('extraversion', 'tipi.1', 1), c('affect', 'spane.10', 1)], why: 'joy' },
        { text: '날이 좋아서요', cues: [], why: 'life' },
      ],
    },
  },
  rhr: {
    up: {
      choices: [
        { text: '긴장하거나 신경 쓰는 일이 많아요', cues: [c('worry', 'gad7.1', 1), c('stability', 'tipi.4', -1)], why: 'worry' },
        { text: '잠을 잘 못 잤어요', cues: [c('mood', 'phq9.3', 1), c('burnout', 'cbi.1', 1)], why: 'fatigue' },
        { text: '술자리가 잦았어요', cues: [c('alcohol', 'auditc.1', 1)], why: 'drinking' },
        { text: '감기 기운이 있거나 아팠어요', cues: [], why: 'life' },
      ],
    },
    down: {
      choices: [
        { text: '운동을 꾸준히 했어요', cues: [c('conscientiousness', 'tipi.3', 1), c('affect', 'spane.1', 1)], why: 'routine' },
        { text: '요즘 마음이 편해졌어요', cues: [c('stability', 'tipi.9', 1), c('worry', 'gad7.1', -1)], why: 'calm' },
        { text: '쉬는 날이 많았어요', cues: [], why: 'life' },
      ],
    },
  },
};
BANK.workouts = BANK.exercise;

// The first question about one change: wording and reason choices.
export function firstQuestion(change, index = 0) {
  const entry = BANK[change.id][change.direction];
  return { text: `${describe(change)} ${index ? '짚이는 이유가 있으세요?' : '이유가 있었을까요?'}`, choices: entry.choices };
}

// The scripted second question: why about the first answer. `key` is a WHY key (whyKeyFor for free text).
export function whyQuestion(key, index = 0) {
  const entry = WHY[key] || WHY.life;
  return { text: entry.asks[index % entry.asks.length], choices: entry.choices };
}
export { BANK, WHY };
