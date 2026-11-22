// Turns parsed records into the comparison the AI sees:
// the user's own normal (days 15 to 90 back) versus the last 14 days.

const DAY = 1440;
const RECENT = 14;
const BASELINE_FROM = 90;
const WD = ['일', '월', '화', '수', '목', '금', '토'];

const dayKey = (min) => new Date(min * 60000).toISOString().slice(0, 10);
const keyToMin = (k) => Date.UTC(+k.slice(0, 4), +k.slice(5, 7) - 1, +k.slice(8, 10)) / 60000;
const shift = (k, d) => dayKey(keyToMin(k) + d * DAY);
const mean = (a) => (a.length ? a.reduce((s, x) => s + x, 0) / a.length : null);
const sd = (a) => {
  if (a.length < 3) return null;
  const m = mean(a);
  return Math.sqrt(a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1));
};

function nights(segments) {
  // Merge overlapping segments, then group by the evening the night began.
  const sorted = segments.slice().sort((a, b) => a[0] - b[0]);
  const merged = [];
  for (const [s, e] of sorted) {
    const last = merged[merged.length - 1];
    if (last && s <= last[1]) last[1] = Math.max(last[1], e);
    else merged.push([s, e]);
  }
  const byNight = new Map();
  for (const [s, e] of merged) {
    const k = dayKey(s - 12 * 60); // before noon belongs to the previous evening
    const n = byNight.get(k) || byNight.set(k, { asleep: 0, onset: Infinity, wake: -Infinity }).get(k);
    n.asleep += e - s;
    n.onset = Math.min(n.onset, s);
    n.wake = Math.max(n.wake, e);
  }
  // Ignore naps: keep nights with at least 2 hours of sleep.
  for (const [k, n] of byNight) if (n.asleep < 120) byNight.delete(k);
  return byNight;
}

function inRange(k, last, from, to) {
  // from/to are "days back from last", inclusive
  return k <= shift(last, -from) && k >= shift(last, -to);
}

const pct = (b, r) => (b && r != null ? Math.round(((r - b) / b) * 100) : null);
const hhmm = (minAfterMidnight) => {
  const m = ((Math.round(minAfterMidnight) % DAY) + DAY) % DAY;
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};
// Onset as minutes after the night's own midnight (23:30 -> -30, 01:10 -> 70).
const onsetOf = (n, k) => n.onset - keyToMin(k) - DAY;
const hm = (min) => `${Math.floor(min / 60)}시간 ${Math.round(min % 60)}분`;

export function computeSummary(data, through) {
  const sleepNights = nights(data.sleep);
  const stepDays = new Map([...data.steps].map(([k, m]) => [k, Math.max(...m.values())]));
  const allKeys = [...sleepNights.keys(), ...stepDays.keys(), ...data.rhr.keys()].sort();
  const last = through ?? allKeys.at(-1);
  if (!last) return null;

  const windowed = (map, valueOf) => {
    const base = [], recent = [];
    for (const [k, v] of map) {
      const x = valueOf(v, k);
      if (x == null) continue;
      if (inRange(k, last, 0, RECENT - 1)) recent.push(x);
      else if (inRange(k, last, RECENT, BASELINE_FROM - 1)) base.push(x);
    }
    return { base, recent };
  };

  const sleepDur = windowed(sleepNights, (n) => n.asleep);
  const onset = windowed(sleepNights, onsetOf);
  const steps = windowed(stepDays, (v) => v);
  const rhr = windowed(data.rhr, (v) => mean(v));
  const hrv = windowed(data.hrv, (v) => mean(v));
  const wk = { base: 0, recent: 0 };
  for (const k of data.workouts) {
    if (inRange(k, last, 0, RECENT - 1)) wk.recent++;
    else if (inRange(k, last, RECENT, BASELINE_FROM - 1)) wk.base++;
  }
  const baseWeeks = (BASELINE_FROM - RECENT) / 7;

  const metrics = [];
  const add = (id, label, b, r, fmt, change, enough) => {
    if (!enough) return;
    metrics.push({ id, label, base: b, recent: r, baseText: fmt(b), recentText: fmt(r), change });
  };
  const mb = mean(sleepDur.base), mr = mean(sleepDur.recent);
  add('sleep', '수면 시간', mb, mr, hm, pct(mb, mr) != null ? `${pct(mb, mr) > 0 ? '+' : ''}${pct(mb, mr)}%` : '', sleepDur.base.length >= 7 && sleepDur.recent.length >= 5);
  const ob = mean(onset.base), or = mean(onset.recent), osb = sd(onset.base), osr = sd(onset.recent);
  add('onset', '잠드는 시각', ob, or, (x) => hhmm(x), `${or - ob >= 0 ? '+' : '-'}${Math.round(Math.abs(or - ob))}분`, onset.base.length >= 7 && onset.recent.length >= 5);
  if (osb != null && osr != null) {
    add('regularity', '잠드는 시각의 흔들림', osb, osr, (x) => `±${Math.round(x)}분`, `${(osr / osb).toFixed(1)}배`, true);
  }
  const sb = mean(steps.base), sr = mean(steps.recent);
  add('steps', '하루 걸음 수', sb, sr, (x) => `${Math.round(x).toLocaleString('ko-KR')}보`, `${pct(sb, sr) > 0 ? '+' : ''}${pct(sb, sr)}%`, steps.base.length >= 7 && steps.recent.length >= 5);
  const rb = mean(rhr.base), rr = mean(rhr.recent);
  add('rhr', '안정 시 심박', rb, rr, (x) => `${Math.round(x)}회/분`, `${rr - rb >= 0 ? '+' : ''}${Math.round(rr - rb)}`, rhr.base.length >= 7 && rhr.recent.length >= 5);
  const hb = mean(hrv.base), hr = mean(hrv.recent);
  add('hrv', '심박변이도(HRV)', hb, hr, (x) => `${Math.round(x)}ms`, `${pct(hb, hr) > 0 ? '+' : ''}${pct(hb, hr)}%`, hrv.base.length >= 7 && hrv.recent.length >= 5);
  add('workout', '운동 횟수', wk.base / baseWeeks, wk.recent / 2, (x) => `주 ${x.toFixed(1)}회`, '', data.workouts.length > 0);

  // Timetable: the last 7 nights as blocks, and the user's normal per weekday as ghosts.
  const recentNights = [];
  for (let d = 6; d >= 0; d--) {
    const k = shift(last, -d - (sleepNights.has(last) ? 0 : 1));
    const n = sleepNights.get(k);
    const wd = new Date(keyToMin(k) * 60000).getUTCDay();
    recentNights.push({ key: k, wd, label: WD[wd], onset: n ? onsetOf(n, k) : null, wake: n ? n.wake - keyToMin(k) - DAY : null, asleep: n?.asleep ?? null });
  }
  const ghost = Array.from({ length: 7 }, () => ({ on: [], off: [] }));
  for (const [k, n] of sleepNights) {
    if (!inRange(k, last, RECENT, BASELINE_FROM - 1)) continue;
    const wd = new Date(keyToMin(k) * 60000).getUTCDay();
    ghost[wd].on.push(onsetOf(n, k));
    ghost[wd].off.push(n.wake - keyToMin(k) - DAY);
  }
  const normal = ghost.map((g) => (g.on.length ? { onset: mean(g.on), wake: mean(g.off) } : null));

  const lines = metrics.map((m) => `${m.label}: 평소 ${m.baseText} → 최근 2주 ${m.recentText}${m.change ? ` (${m.change})` : ''}`);
  const text = [
    `기간: 최근 2주(${shift(last, -(RECENT - 1))}~${last})를 그 이전 약 11주와 비교`,
    ...lines,
  ].join('\n');

  return { last, metrics, recentNights, normal, text };
}

export { hhmm, hm, nights, onsetOf, shift, keyToMin, WD };
