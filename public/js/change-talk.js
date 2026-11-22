// Stage 2 of the phone demo: find the one or two clearest changes in the user's own
// health records, then ask about them with pre-written reasons. Each reason carries
// signals in the indicators.js contract: { indicator, item, delta, quote }.
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

// One sentence about the change. Index varies the phrasing between the first and second change.
function describe(change, index = 0) {
  const metric = METRICS[change.id];
  const from = since(change.start, change.through);
  const base = metric.show(change.base);
  const recent = metric.show(change.recent);
  const up = change.direction === 'up';
  const lines = {
    sleep: [
      `${from} 하루 평균 ${recent} 잤어요. 평소 ${base}보다 ${hm(Math.abs(change.recent - change.base) * 60)} ${up ? '길어요' : '짧아요'}.`,
      `${span(change)} 잠이 평소보다 ${hm(Math.abs(change.recent - change.base) * 60)}쯤 ${up ? '늘었어요' : '줄었어요'}. ${from} 그래요.`,
    ],
    onset: [
      `${from} 잠드는 시각이 평소 ${base}쯤에서 ${recent}쯤으로 ${up ? '늦어졌어요' : '당겨졌어요'}.`,
      `${span(change)} 평소보다 ${hm(Math.abs(change.recent - change.base))}쯤 ${up ? '늦게' : '일찍'} 잠들고 있어요. ${from}예요.`,
    ],
    steps: [
      `${from} 하루 걸음이 ${ratioWords(change)}. 평소엔 ${base}, 요즘은 ${ida(recent)}.`,
      `${span(change)} 걸음 수가 ${ratioWords(change)}. ${from} 하루 ${recent}쯤이에요.`,
    ],
    flights: [
      `${from} 오른 계단이 ${ratioWords(change)}. 평소 하루 ${base}, 요즘 ${ida(recent)}.`,
      `${span(change)} 계단 오른 기록이 ${ratioWords(change)}. ${from} 하루 ${recent}쯤이에요.`,
    ],
    daylight: [
      `${from} 햇빛 아래 있던 시간이 ${ratioWords(change)}. 평소 하루 ${base}, 요즘 ${ida(recent)}.`,
      `${span(change)} 바깥 햇빛을 본 시간이 ${ratioWords(change)}. ${from} 하루 ${recent}쯤이에요.`,
    ],
    exercise: [
      `${from} 운동한 시간이 ${ratioWords(change)}. 평소 하루 ${base}, 요즘 ${ida(recent)}.`,
      `${span(change)} 운동 시간이 ${ratioWords(change)}. ${from} 하루 ${recent}쯤이에요.`,
    ],
    workouts: up
      ? [`${from} 운동 기록이 ${recent}로 늘었어요. 평소엔 ${base}였어요.`, `${span(change)} 운동 기록이 평소(${base})보다 자주 있어요.`]
      : change.recent === 0
        ? [`평소엔 운동 기록이 ${base} 있었는데, ${from}는 한 번도 없어요.`, `${from} 운동 기록이 비어 있어요. 평소엔 ${base} 있었어요.`]
        : [`${from} 운동 기록이 ${recent}로 줄었어요. 평소엔 ${base}였어요.`, `${span(change)} 운동 기록이 평소(${base})보다 드물어요.`],
    rhr: [
      `${from} 가만히 있을 때 심박이 평소 ${base}에서 ${recent}로 ${up ? '올랐어요' : '내려갔어요'}.`,
      `${span(change)} 안정 시 심박이 평소보다 ${Math.round(Math.abs(change.recent - change.base))}회쯤 ${up ? '높아요' : '낮아요'}. ${from}예요.`,
    ],
  }[change.id];
  return lines[index % lines.length];
}

// For the report: one plain line about the period and the values.
export function recordLine(change) {
  const metric = METRICS[change.id];
  return `${since(change.start, change.through).replace(/부터$/, '')}부터 ${md(change.through)}까지 ${metric.show(change.recent)} · 평소 ${metric.show(change.base)}`;
}

/* ---------- Question bank ---------- */

// Item ids are cue ids from trait-estimates.js cueTable(): test items ('cbi.1', 'tipi.3')
// and everyday questions ('recovery.2' = tension right after resting, 0-based).
// phq9/gad7 items need a `cue` in their test file, and auditc needs its test file,
// before groundedSignals accepts them.

// Follow-ups confirm or undo the first answer. `indicators` lists what the follow-up
// probes; `item` is the cue it asks about (for the first of those indicators). Yes confirms
// the first answer's direction at 12, no reverses the first answer's signals for those indicators.
const FOLLOW = {
  mood: { indicators: ['mood', 'flourishing', 'affect'], item: 'phq9.1', asks: ['좋아하던 것도 예전만큼 재미가 덜했어요?', '평소 즐기던 일에도 손이 덜 갔어요?'], yes: '네, 좋아하던 것도 시들했어요', no: '아니요, 좋아하는 건 여전히 즐거웠어요' },
  fatigue: { indicators: ['mood', 'burnout'], item: 'phq9.4', asks: ['쉬고 나서도 피곤함이 잘 안 풀렸어요?', '깨어 있는 동안에도 기운이 거의 없었어요?'], yes: '네, 쉬어도 계속 기운이 없었어요', no: '아니요, 쉬고 나면 괜찮아졌어요' },
  burnout: { indicators: ['burnout'], item: 'cbi.3', asks: ['일이 끝난 뒤에도 마음까지 지친 느낌이었어요?', '하루가 끝나면 녹초가 된 느낌이었어요?'], yes: '네, 하루가 끝나면 녹초였어요', no: '아니요, 바빴을 뿐 기운은 남아 있었어요' },
  worry: { indicators: ['worry', 'stability'], item: 'gad7.2', asks: ['그 생각이 낮에도 자꾸 떠올라 하던 일을 방해했어요?', '걱정을 멈추고 싶어도 잘 안 멈춰졌어요?'], yes: '네, 낮에도 그 생각이 자꾸 떠올랐어요', no: '아니요, 하던 일을 하면 잊혔어요' },
  restless: { indicators: ['worry'], item: 'gad7.5', asks: ['가만히 있기 힘들 만큼 마음이 들떴어요?'], yes: '네, 가만히 있기가 힘들었어요', no: '아니요, 걷고 싶었을 뿐이에요' },
  phone: { indicators: ['phone'], item: 'sassv.9', asks: ['내려놓으려 해도 생각보다 오래 보게 됐어요?', '잠깐 보려다 한참 지나 있던 날이 많았어요?'], yes: '네, 계획보다 훨씬 오래 봤어요', no: '아니요, 그날따라 그랬어요' },
  recovery: { indicators: ['recovery', 'affect'], item: 'recovery.2', asks: ['그러고 나면 긴장이 좀 풀렸어요?', '그 시간 뒤엔 마음이 한결 가벼웠어요?'], yes: '네, 하고 나면 한결 가벼웠어요', no: '아니요, 해도 마음은 그대로였어요' },
  tension: { indicators: ['recovery', 'burnout'], item: 'recovery.2', asks: ['그렇게 늦게까지 있어도 긴장은 잘 안 풀렸어요?'], yes: '네, 쉬어도 긴장이 남았어요', no: '아니요, 그 시간에 많이 풀렸어요' },
  rested: { indicators: ['recovery'], item: 'recovery.2', asks: ['자고 일어나면 개운했어요?', '푹 자고 나면 몸이 가뿐했어요?'], yes: '네, 아침이 한결 개운했어요', no: '아니요, 자도 개운하지 않았어요' },
  energy: { indicators: ['affect', 'openness'], item: 'spane.1', asks: ['요즘 기분 좋은 날이 많았어요?', '그 덕에 기분이 좀 나아졌어요?'], yes: '네, 요즘 기분이 좋아요', no: '아니요, 기분은 평소와 비슷해요' },
  joy: { indicators: ['affect', 'extraversion'], item: 'spane.10', asks: ['요즘 즐거운 일이 많았어요?', '같이 하니까 더 즐거웠어요?'], yes: '네, 즐거운 날이 많았어요', no: '아니요, 즐거운 건 평소만큼이었어요' },
  calm: { indicators: ['stability', 'worry'], item: 'tipi.9', asks: ['요즘 마음이 차분하고 덜 흔들려요?'], yes: '네, 요즘 마음이 차분해요', no: '아니요, 그렇진 않아요' },
  routine: { indicators: ['conscientiousness', 'affect'], item: 'tipi.3', asks: ['정한 대로 꾸준히 지키고 있어요?', '마음먹은 걸 거의 매일 지켰어요?'], yes: '네, 거의 매일 지켰어요', no: '아니요, 마음만 먹고 잘 안 됐어요' },
  delay: { indicators: ['delay'], item: 'delay.3', asks: ['다른 할 일도 자꾸 내일로 미뤄졌어요?'], yes: '네, 다른 일도 자꾸 미뤘어요', no: '아니요, 운동만 그랬어요' },
  drinking: { indicators: ['alcohol'], item: 'auditc.2', asks: ['한 번 마실 때 평소보다 많이 마셨어요?'], yes: '네, 마시면 많이 마셨어요', no: '아니요, 양은 평소와 비슷했어요' },
};

// Free-text answers pick the follow-up by the strongest signal's indicator.
// A follow-up confirms the first answer in its own direction, so the pick depends on the sign:
// [follow when the clue points to `high`, follow when it points to `low`]. null = no follow-up.
const FOLLOW_BY_INDICATOR = {
  mood: ['mood', null], burnout: ['burnout', null], worry: ['worry', 'calm'], phone: ['phone', null],
  recovery: ['recovery', 'tension'], affect: ['energy', 'mood'], delay: ['delay', null], alcohol: ['drinking', null],
  stability: ['calm', 'worry'], conscientiousness: ['routine', null], extraversion: ['joy', null], flourishing: [null, 'mood'],
};

const s = (indicator, item, delta) => ({ indicator, item, delta });
const LIFE = []; // a pure life reason carries no signals

// metric × direction -> questions and 3–4 reasons. `follow` names a FOLLOW entry.
const BANK = {
  sleep: {
    down: {
      asks: ['잠이 줄어든 데 이유가 있었을까요?', '무엇 때문에 잠이 줄었을까요?'],
      choices: [
        { text: '할 일이 많아서 늦게까지 깨어 있었어요', signals: [s('burnout', 'cbi.1', 4)], follow: 'burnout' },
        { text: '누워도 생각이 많아 잠이 안 왔어요', signals: [s('worry', 'gad7.2', 5), s('mood', 'phq9.3', 3)], follow: 'worry' },
        { text: '휴대폰을 보다가 늦게 잤어요', signals: [s('phone', 'sassv.9', 4)], follow: 'phone' },
        { text: '여행이나 일정 때문이었어요', signals: LIFE },
      ],
    },
    up: {
      asks: ['잠이 늘어난 건 어떤 이유였을까요?', '요즘 더 오래 자게 된 이유가 있을까요?'],
      choices: [
        { text: '피곤해서 자도 자도 졸렸어요', signals: [s('mood', 'phq9.4', 4), s('burnout', 'cbi.1', 3)], follow: 'fatigue' },
        { text: '딱히 할 게 없어서 오래 누워 있었어요', signals: [s('mood', 'phq9.1', 4), s('flourishing', 'fs.3', -3)], follow: 'mood' },
        { text: '일부러 푹 자려고 했어요', signals: [s('recovery', 'recovery.2', 3)], follow: 'rested' },
        { text: '아파서 쉬었어요', signals: LIFE },
      ],
    },
  },
  onset: {
    up: {
      asks: ['늦게 잠드는 날이 이어진 이유가 있을까요?', '밤이 길어진 데 무슨 일이 있었어요?'],
      choices: [
        { text: '일이나 공부가 밤까지 이어졌어요', signals: [s('burnout', 'cbi.1', 4)], follow: 'burnout' },
        { text: '밤에만 내 시간이 있어서 늦게까지 버텼어요', signals: [s('recovery', 'recovery.2', -3), s('burnout', 'cbi.3', 3)], follow: 'tension' },
        { text: '누워도 걱정이 많아 잠이 늦게 들었어요', signals: [s('worry', 'gad7.1', 5), s('mood', 'phq9.3', 3)], follow: 'worry' },
        { text: '휴대폰이나 영상을 보다 보니 늦어졌어요', signals: [s('phone', 'sassv.9', 4)], follow: 'phone' },
      ],
    },
    down: {
      asks: ['일찍 잠들게 된 이유가 있을까요?', '잠드는 시간이 당겨진 데 무슨 일이 있었어요?'],
      choices: [
        { text: '저녁이면 금방 지쳐서 일찍 눕게 돼요', signals: [s('burnout', 'cbi.1', 4)], follow: 'burnout' },
        { text: '일찍 자고 일찍 일어나려고 마음먹었어요', signals: [s('conscientiousness', 'tipi.3', 3)], follow: 'routine' },
        { text: '저녁에 할 게 없어서 일찍 누워요', signals: [s('mood', 'phq9.1', 3), s('flourishing', 'fs.3', -2)], follow: 'mood' },
        { text: '아침 일정이 생겼어요', signals: LIFE },
      ],
    },
  },
  steps: {
    down: {
      asks: ['무슨 일이 있었어요?', '덜 걷게 된 이유가 있었을까요?'],
      choices: [
        { text: '나가기가 싫었어요', signals: [s('mood', 'phq9.1', 4), s('affect', 'spane.1', -3)], follow: 'mood' },
        { text: '일이 많아 책상 앞에만 있었어요', signals: [s('burnout', 'cbi.1', 3)], follow: 'burnout' },
        { text: '몸이 무겁고 기운이 없었어요', signals: [s('mood', 'phq9.4', 4), s('burnout', 'cbi.2', 3)], follow: 'fatigue' },
        { text: '날씨가 춥거나 비가 왔어요', signals: LIFE },
      ],
    },
    up: {
      asks: ['많이 걷게 된 이유가 있었어요?', '어디를 그렇게 다녔어요?'],
      choices: [
        { text: '산책하면서 머리를 식혔어요', signals: [s('recovery', 'recovery.2', 4), s('affect', 'spane.1', 3)], follow: 'recovery' },
        { text: '마음이 답답해서 무작정 걸었어요', signals: [s('worry', 'gad7.5', 4), s('affect', 'spane.2', -3)], follow: 'restless' },
        { text: '새로 시작한 운동이나 모임이 있어요', signals: [s('openness', 'tipi.5', 3), s('affect', 'spane.1', 3)], follow: 'energy' },
        { text: '여행이나 이사로 많이 다녔어요', signals: LIFE },
      ],
    },
  },
  flights: {
    down: {
      asks: ['덜 움직이게 된 이유가 있었을까요?', '무슨 일이 있었어요?'],
      choices: [
        { text: '움직이기가 귀찮았어요', signals: [s('mood', 'phq9.4', 3), s('burnout', 'cbi.2', 2)], follow: 'fatigue' },
        { text: '바빠서 거의 앉아만 있었어요', signals: [s('burnout', 'cbi.1', 3)], follow: 'burnout' },
        { text: '다리가 아프거나 몸이 안 좋았어요', signals: LIFE },
        { text: '출근길이나 사는 곳이 바뀌었어요', signals: LIFE },
      ],
    },
    up: {
      asks: ['계단을 많이 오른 이유가 있었어요?', '어디를 다녀왔어요?'],
      choices: [
        { text: '건강 챙기려고 일부러 계단으로 다녔어요', signals: [s('conscientiousness', 'tipi.3', 3)], follow: 'routine' },
        { text: '등산이나 나들이를 다녀왔어요', signals: [s('affect', 'spane.1', 3), s('openness', 'tipi.5', 2)], follow: 'energy' },
        { text: '출근길이나 사는 곳이 바뀌었어요', signals: LIFE },
      ],
    },
  },
  daylight: {
    down: {
      asks: ['밖에 덜 나가게 된 이유가 있었을까요?', '무슨 일이 있었어요?'],
      choices: [
        { text: '집에만 있고 싶었어요', signals: [s('mood', 'phq9.1', 3), s('extraversion', 'tipi.6', -2)], follow: 'mood' },
        { text: '실내에서 일하는 시간이 길어졌어요', signals: [s('burnout', 'cbi.1', 2)], follow: 'burnout' },
        { text: '해가 짧아지고 추워졌어요', signals: LIFE },
        { text: '워치를 잘 안 찼어요', signals: LIFE },
      ],
    },
    up: {
      asks: ['밖에 있는 시간이 늘어난 이유가 있었어요?', '요즘 어디서 시간을 보냈어요?'],
      choices: [
        { text: '일부러 밖에서 쉬는 시간을 가졌어요', signals: [s('recovery', 'recovery.2', 3), s('affect', 'spane.1', 2)], follow: 'recovery' },
        { text: '나들이나 약속이 많았어요', signals: [s('extraversion', 'tipi.1', 3), s('affect', 'spane.10', 3)], follow: 'joy' },
        { text: '외근이나 이동이 많았어요', signals: LIFE },
      ],
    },
  },
  exercise: {
    down: {
      asks: ['운동이 줄어든 이유가 있었을까요?', '그 시간은 어떻게 보냈어요?'],
      choices: [
        { text: '운동할 마음이 잘 안 생겼어요', signals: [s('mood', 'phq9.1', 4), s('flourishing', 'fs.3', -2)], follow: 'mood' },
        { text: '일이 바빠 시간이 없었어요', signals: [s('burnout', 'cbi.1', 3)], follow: 'burnout' },
        { text: '하려고 했는데 자꾸 미뤘어요', signals: [s('delay', 'delay.4', 4)], follow: 'delay' },
        { text: '다치거나 아파서 쉬었어요', signals: LIFE },
      ],
    },
    up: {
      asks: ['운동을 더 하게 된 계기가 있었어요?', '요즘 운동이 늘어난 이유가 궁금해요.'],
      choices: [
        { text: '스트레스를 풀려고 운동했어요', signals: [s('recovery', 'recovery.2', 3)], follow: 'recovery' },
        { text: '목표가 생겨서 꾸준히 해요', signals: [s('conscientiousness', 'tipi.3', 4), s('affect', 'spane.1', 3)], follow: 'routine' },
        { text: '친구와 같이 하게 됐어요', signals: [s('extraversion', 'tipi.1', 3), s('affect', 'spane.10', 2)], follow: 'joy' },
        { text: '날이 좋아서요', signals: LIFE },
      ],
    },
  },
  rhr: {
    up: {
      asks: ['요즘 몸이나 마음에 무슨 일이 있었어요?', '심박이 오른 데 짚이는 게 있을까요?'],
      choices: [
        { text: '긴장하거나 신경 쓰는 일이 많아요', signals: [s('worry', 'gad7.1', 4), s('stability', 'tipi.4', -3)], follow: 'worry' },
        { text: '잠을 잘 못 잤어요', signals: [s('mood', 'phq9.3', 3), s('burnout', 'cbi.1', 2)], follow: 'fatigue' },
        { text: '술자리가 잦았어요', signals: [s('alcohol', 'auditc.1', 4)], follow: 'drinking' },
        { text: '감기 기운이 있거나 아팠어요', signals: LIFE },
      ],
    },
    down: {
      asks: ['심박이 내려간 데 짚이는 게 있을까요?', '요즘 달라진 생활이 있어요?'],
      choices: [
        { text: '운동을 꾸준히 했어요', signals: [s('conscientiousness', 'tipi.3', 3), s('affect', 'spane.1', 3)], follow: 'routine' },
        { text: '요즘 마음이 편해졌어요', signals: [s('stability', 'tipi.9', 4), s('worry', 'gad7.1', -3)], follow: 'calm' },
        { text: '쉬는 날이 많았어요', signals: LIFE },
      ],
    },
  },
};
BANK.workouts = BANK.exercise;

const withQuote = (signals, quote) => signals.map((signal) => ({ ...signal, quote }));

// The first question about one change: wording, reason choices and their signals.
export function firstQuestion(change, index = 0) {
  const entry = BANK[change.id][change.direction];
  const ask = entry.asks[index % entry.asks.length];
  return {
    text: `${describe(change, index)} ${ask}`,
    choices: entry.choices.map((choice) => ({ ...choice, signals: withQuote(choice.signals, choice.text) })),
  };
}

// The follow-up for a first answer, or null when the answer carried no signals.
// `followId` comes from a picked choice; free text picks by its strongest signal.
export function followUp(firstSignals, followId, index = 0) {
  if (!firstSignals.length) return null;
  const strongest = [...firstSignals].sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta))[0];
  const follow = FOLLOW[followId || FOLLOW_BY_INDICATOR[strongest.indicator]?.[strongest.delta > 0 ? 0 : 1]];
  if (!follow) return null;
  const probed = firstSignals.filter((signal) => follow.indicators.includes(signal.indicator));
  if (!probed.length) return null;
  const confirm = probed.map((signal) => ({
    indicator: signal.indicator,
    item: signal.indicator === follow.indicators[0] ? follow.item : signal.item,
    delta: Math.sign(signal.delta) * 12,
  }));
  const undo = probed.map((signal) => ({ indicator: signal.indicator, item: signal.item, delta: -signal.delta }));
  return {
    text: follow.asks[index % follow.asks.length],
    choices: [
      { text: follow.yes, signals: withQuote(confirm, follow.yes) },
      { text: follow.no, signals: withQuote(undo, follow.no) },
    ],
  };
}
