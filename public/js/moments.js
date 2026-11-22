// Finds "moments": days in the last 2 weeks that stand out against the user's own normal
// (days 15 to 90 back), and turns them into the hidden data signal for the card demo.
// HRV and resting heart rate are left out on purpose: spec/metrics.js says not to open a
// conversation with them (weak evidence, large device error).

import { nights, keyToMin, shift, mean, sd } from './metrics.js';

const DAY = 1440;
const RECENT = 14;
const BASE_FROM = 90;

// Each kind of moment opens one PHQ-9 item (1-based item number).
export const KINDS = {
  late: { metric: 'onset', item: 3, label: '늦게 잠든 밤' },
  short: { metric: 'sleep', item: 3, label: '짧게 잔 밤' },
  still: { metric: 'steps', item: 4, label: '거의 안 움직인 날' },
  noWorkout: { metric: 'workout', item: 1, label: '끊긴 운동' },
};

const split = (map, last, valueOf) => {
  const base = [], recent = [];
  for (const [k, v] of map) {
    const x = valueOf(v, k);
    if (x == null) continue;
    if (k <= last && k >= shift(last, -(RECENT - 1))) recent.push({ k, x });
    else if (k <= shift(last, -RECENT) && k >= shift(last, -(BASE_FROM - 1))) base.push(x);
  }
  return { base, recent, m: mean(base), s: sd(base) };
};

// k = how many of the user's own standard deviations a day must move to count.
export function findMoments(data, k = 2) {
  const sleepNights = nights(data.sleep);
  const stepDays = new Map([...data.steps].map(([d, m]) => [d, Math.max(...m.values())]));
  const last = [...sleepNights.keys(), ...stepDays.keys()].sort().at(-1);
  const onsetOf = (n, d) => n.onset - keyToMin(d) - DAY; // minutes after that night's midnight
  const wd = (d) => new Date(keyToMin(d) * 60000).getUTCDay();

  const onset = split(sleepNights, last, onsetOf);
  const dur = split(sleepNights, last, (n) => n.asleep);
  const steps = split(stepDays, last, (v) => v);
  const moments = [];
  const scan = (w, kind, dir) => {
    if (!w.s) return;
    for (const { k: d, x } of w.recent) {
      const z = (x - w.m) / w.s;
      if (dir * z >= k) moments.push({ kind, day: d, wd: wd(d), value: x, base: w.m, z: Math.round(z * 10) / 10 });
    }
  };
  scan(onset, 'late', 1);
  scan(dur, 'short', -1);
  scan(steps, 'still', -1);

  let wkBase = 0, wkRecent = 0;
  for (const d of data.workouts) {
    if (d <= last && d >= shift(last, -(RECENT - 1))) wkRecent++;
    else if (d <= shift(last, -RECENT) && d >= shift(last, -(BASE_FROM - 1))) wkBase++;
  }
  const perWeek = wkBase / ((BASE_FROM - RECENT) / 7);
  // A routine of at least 1 a week that went to 0 for 2 weeks.
  if (perWeek >= 1 && wkRecent === 0) moments.push({ kind: 'noWorkout', day: null, value: 0, base: perWeek, z: null });

  const recentNights = [];
  for (let i = RECENT - 1; i >= 0; i--) {
    const d = shift(last, -i), n = sleepNights.get(d);
    recentNights.push({ day: d, wd: wd(d), onset: n ? onsetOf(n, d) : null, asleep: n?.asleep ?? null, steps: stepDays.get(d) ?? null });
  }
  return { last, from: shift(last, -(RECENT - 1)), k, moments, recentNights,
    normal: { onset: onset.m, asleep: dur.m, steps: steps.m, workoutPerWeek: perWeek } };
}

// Hidden data signal: one point per body area with a clear pattern (3+ moment days, or a
// stopped workout routine). Not validated; it only lowers the bar for offering the real test.
export function dataFlags(found) {
  const days = (kinds) => new Set(found.moments.filter((m) => kinds.includes(m.kind)).map((m) => m.day)).size;
  return {
    sleep: days(['late', 'short']) >= 3,
    activity: days(['still']) >= 3,
    workout: found.moments.some((m) => m.kind === 'noWorkout'),
  };
}

// answers: PHQ-9 items 1-8 (0-3 each, null = not asked). Returns the hidden score the nudge uses.
export function hiddenScore(answers, flags, useData = true) {
  const said = answers.reduce((s, v) => s + (v ?? 0), 0);
  const body = useData ? Object.values(flags).filter(Boolean).length : 0;
  return { said, body, total: said + body };
}
