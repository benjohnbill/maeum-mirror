// Generates a synthetic Apple Health export.xml for one testbed Persona.
// Every value is invented. Parametric form of scripts/make-sample.mjs.
// Run: node scripts/make-persona-data.mjs --out <export.xml> [flags]
//
// Recent-window changes (last 14 days vs days 15-120):
//   --sleep <pct>       sleep duration change, e.g. -20
//   --onset <min>       sleep-onset shift in minutes, e.g. +60
//   --regularity <x>    sleep-onset SD multiplier, e.g. 2.5 (1 = unchanged)
//   --steps <pct>       daily steps change
//   --rhr <beats>       resting heart rate change
//   --hrv <pct>         HRV (SDNN) change
//   --workout <n>       workouts per week in the recent window
// Baseline levels: --base-sleep 7.0 (h), --base-onset 24.1 (h after midnight),
//   --base-onset-sd 0.45 (h), --base-steps 7800, --base-rhr 61, --base-hrv 48,
//   --base-workout 3 (per week; 0 = no workout records at all)
// Identity: --name 지수 --sex F|M --birth 2000-03-14 --seed 20261122
import { writeFileSync } from 'node:fs';

const args = process.argv.slice(2);
const opt = (k, d) => {
  const i = args.indexOf(`--${k}`);
  return i < 0 ? d : args[i + 1];
};
const num = (k, d) => Number(opt(k, d));

const out = opt('out');
if (!out) { console.error('usage: make-persona-data.mjs --out <export.xml> [flags]'); process.exit(2); }

const P = {
  sleep: num('sleep', 0), onset: num('onset', 0), regularity: num('regularity', 1),
  steps: num('steps', 0), rhr: num('rhr', 0), hrv: num('hrv', 0),
  baseSleep: num('base-sleep', 7.0), baseOnset: num('base-onset', 24.1), baseOnsetSd: num('base-onset-sd', 0.45),
  baseSteps: num('base-steps', 7800), baseRhr: num('base-rhr', 61), baseHrv: num('base-hrv', 48),
  baseWorkout: num('base-workout', 3),
};
P.workout = num('workout', P.baseWorkout);
const name = opt('name', '지수');
const sex = opt('sex', 'F') === 'M' ? 'HKBiologicalSexMale' : 'HKBiologicalSexFemale';
const birth = opt('birth', '2000-03-14');

let seed = num('seed', 20261122);
const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
const gauss = () => {
  const u = rand() || 1e-9, v = rand();
  return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
};

const DAYS = 120;
const RECENT = 14;
const end = new Date(Date.UTC(2026, 10, 21)); // 2026-11-21, treated as local date
const pad = (n) => String(n).padStart(2, '0');
// Dates are built in UTC and printed as +0900 wall time.
const fmt = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0900`;
const addMin = (d, m) => new Date(d.getTime() + m * 60000);

const lines = [];
lines.push('<?xml version="1.0" encoding="UTF-8"?>');
lines.push('<HealthData locale="ko_KR">');
lines.push(' <ExportDate value="2026-11-22 09:00:00 +0900"/>');
lines.push(` <Me HKCharacteristicTypeIdentifierDateOfBirth="${birth}" HKCharacteristicTypeIdentifierBiologicalSex="${sex}" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeNotSet"/>`);

const rec = (type, src, start, stop, value, unit) =>
  lines.push(` <Record type="${type}" sourceName="${name}의 ${src === 'w' ? 'Apple Watch' : 'iPhone'}" sourceVersion="11.1" device="&lt;&lt;HKDevice: 0x0&gt;, name:${src === 'w' ? 'Apple Watch' : 'iPhone'}, manufacturer:Apple Inc.&gt;" ${unit ? `unit="${unit}" ` : ''}creationDate="${fmt(stop)}" startDate="${fmt(start)}" endDate="${fmt(stop)}" value="${value}"/>`);

const WORKOUT_DAYS = [1, 2, 3, 4, 5, 6, 0];
for (let i = DAYS - 1; i >= 0; i--) {
  const day = new Date(end.getTime() - i * 86400000);
  const recent = i < RECENT;
  const weekend = [0, 6].includes(day.getUTCDay());

  // Sleep for the night that starts on this date's evening.
  const onsetMean = P.baseOnset + (weekend ? 0.5 : 0) + (recent ? P.onset / 60 : 0);
  const onsetSd = P.baseOnsetSd * (recent ? P.regularity : 1);
  const durMean = (P.baseSleep + (weekend ? 0.5 : 0)) * (recent ? 1 + P.sleep / 100 : 1);
  const onset = addMin(day, Math.round((onsetMean + gauss() * onsetSd) * 60));
  const dur = Math.max(3.2, durMean + gauss() * 0.4);
  let t = addMin(onset, -15);
  rec('HKCategoryTypeIdentifierSleepAnalysis', 'w', t, onset, 'HKCategoryValueSleepAnalysisInBed');
  t = onset;
  const stop = addMin(onset, dur * 60);
  const stages = ['AsleepCore', 'AsleepDeep', 'AsleepCore', 'AsleepREM'];
  let k = 0;
  while (t < stop) {
    const seg = addMin(t, Math.min(25 + Math.round(rand() * 40), (stop - t) / 60000));
    rec('HKCategoryTypeIdentifierSleepAnalysis', 'w', t, seg, `HKCategoryValueSleepAnalysis${stages[k++ % 4]}`);
    t = seg;
  }

  // Steps: hourly chunks from the Watch and a slightly lower duplicate from the iPhone.
  const stepsMean = P.baseSteps * (weekend ? 1.15 : 1) * (recent ? 1 + P.steps / 100 : 1);
  const stepsTotal = Math.max(800, stepsMean + gauss() * stepsMean * 0.15);
  const hours = [8, 9, 12, 13, 18, 19, 20, 21];
  for (const h of hours) {
    const s = addMin(day, h * 60 + Math.round(rand() * 20));
    const n = Math.round((stepsTotal / hours.length) * (0.6 + rand() * 0.8));
    rec('HKQuantityTypeIdentifierStepCount', 'w', s, addMin(s, 30), n, 'count');
    rec('HKQuantityTypeIdentifierStepCount', 'p', s, addMin(s, 30), Math.round(n * 0.88), 'count');
  }

  // Resting heart rate (one per day) and HRV (several per day).
  const noon = addMin(day, 12 * 60);
  rec('HKQuantityTypeIdentifierRestingHeartRate', 'w', noon, noon, Math.round(P.baseRhr + (recent ? P.rhr : 0) + gauss() * 2), 'count/min');
  const hrvMean = P.baseHrv * (recent ? 1 + P.hrv / 100 : 1);
  for (const h of [3, 9, 15, 22]) {
    const s = addMin(day, h * 60);
    rec('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'w', s, addMin(s, 1), (hrvMean + gauss() * 6).toFixed(1), 'ms');
  }

  // Workouts: spread over the week at the given weekly rate.
  const perWeek = recent ? P.workout : P.baseWorkout;
  if (perWeek > 0 && WORKOUT_DAYS.indexOf(day.getUTCDay()) < Math.ceil(perWeek) && rand() < perWeek / Math.ceil(perWeek)) {
    const s = addMin(day, 19 * 60 + 30);
    lines.push(` <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="32" durationUnit="min" sourceName="${name}의 Apple Watch" startDate="${fmt(s)}" endDate="${fmt(addMin(s, 32))}"/>`);
  }
}
lines.push('</HealthData>');
writeFileSync(out, lines.join('\n'));
console.log(`${out}: ${lines.length} lines`);
