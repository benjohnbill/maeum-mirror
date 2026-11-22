// Generates a synthetic Apple Health export.xml for the demo persona.
// Every value is invented. Run: node scripts/make-sample.mjs
import { writeFileSync } from 'node:fs';
import { createCollector } from '../public/js/parse.js';
import { writeReadFixtures } from './read-fixtures.mjs';

function rng(start) {
  let seed = start;
  const rand = () => ((seed = (seed * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  const gauss = () => {
    const u = rand() || 1e-9, v = rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  return { rand, gauss };
}
// The last 120 days keep the original seed, so the existing story values do not change.
// Older days and the quiz-only categories use a second stream.
const main = rng(20261122);
const extra = rng(20261123);

const DAYS = 120;
const YEAR = 365;
const RECENT = 14;
const end = new Date(Date.UTC(2026, 10, 21)); // 2026-11-21, treated as local date
const pad = (n) => String(n).padStart(2, '0');
// Format a "local" timestamp. Dates are built in UTC and printed as +0900 wall time.
const fmt = (d) =>
  `${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}-${pad(d.getUTCDate())} ${pad(d.getUTCHours())}:${pad(d.getUTCMinutes())}:${pad(d.getUTCSeconds())} +0900`;
const addMin = (d, m) => new Date(d.getTime() + m * 60000);

const out = [];
out.push('<?xml version="1.0" encoding="UTF-8"?>');
out.push('<HealthData locale="ko_KR">');
out.push(' <ExportDate value="2026-11-22 09:00:00 +0900"/>');
out.push(' <Me HKCharacteristicTypeIdentifierDateOfBirth="2000-03-14" HKCharacteristicTypeIdentifierBiologicalSex="HKBiologicalSexFemale" HKCharacteristicTypeIdentifierBloodType="HKBloodTypeAPositive"/>');

const rec = (type, src, start, stop, value, unit) =>
  out.push(` <Record type="${type}" sourceName="${src === 'w' ? '지수의 Apple Watch' : '지수의 iPhone'}" sourceVersion="11.1" device="&lt;&lt;HKDevice: 0x0&gt;, name:${src === 'w' ? 'Apple Watch' : 'iPhone'}, manufacturer:Apple Inc.&gt;" ${unit ? `unit="${unit}" ` : ''}creationDate="${fmt(stop)}" startDate="${fmt(start)}" endDate="${fmt(stop)}" value="${value}"/>`);

function writeDay(i, { rand, gauss }) {
  const day = new Date(end.getTime() - i * 86400000); // midnight of this date
  const recent = i < RECENT;
  const weekend = [0, 6].includes(day.getUTCDay());

  // Sleep for the night that starts on this date's evening.
  const onsetMean = recent ? 25.4 : 24.1 + (weekend ? 0.6 : 0); // hours after midnight of `day`
  const onsetSd = recent ? 1.6 : 0.45;
  const durMean = recent ? 5.5 : 7.0 + (weekend ? 0.6 : 0);
  const onset = addMin(day, Math.round((onsetMean + gauss() * onsetSd) * 60));
  const dur = Math.max(3.2, durMean + gauss() * (recent ? 0.8 : 0.4));
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
    if (recent && rand() < 0.18 && t < stop) { // short awakenings
      const a = addMin(t, 6 + Math.round(rand() * 14));
      rec('HKCategoryTypeIdentifierSleepAnalysis', 'w', t, a, 'HKCategoryValueSleepAnalysisAwake');
      t = a;
    }
  }

  // Steps: hourly chunks from the Watch and a slightly lower duplicate from the iPhone.
  const stepsTotal = Math.max(800, (recent ? 4100 : weekend ? 9400 : 7800) + gauss() * (recent ? 900 : 1300));
  const hours = [8, 9, 12, 13, 18, 19, 20, 21];
  for (const h of hours) {
    const s = addMin(day, h * 60 + Math.round(rand() * 20));
    const n = Math.round((stepsTotal / hours.length) * (0.6 + rand() * 0.8));
    rec('HKQuantityTypeIdentifierStepCount', 'w', s, addMin(s, 30), n, 'count');
    rec('HKQuantityTypeIdentifierStepCount', 'p', s, addMin(s, 30), Math.round(n * 0.88), 'count');
  }

  // Resting heart rate (one per day) and HRV (several per day).
  const noon = addMin(day, 12 * 60);
  rec('HKQuantityTypeIdentifierRestingHeartRate', 'w', noon, noon, Math.round((recent ? 67 : 61) + gauss() * 2), 'count/min');
  for (const h of [3, 9, 15, 22]) {
    const s = addMin(day, h * 60);
    rec('HKQuantityTypeIdentifierHeartRateVariabilitySDNN', 'w', s, addMin(s, 1), ((recent ? 35 : 48) + gauss() * 6).toFixed(1), 'ms');
  }

  // Workouts: about 3 per week at baseline, none recently.
  if (!recent && [1, 3, 6].includes(day.getUTCDay()) && rand() < 0.85) {
    const s = addMin(day, 19 * 60 + 30);
    out.push(` <Workout workoutActivityType="HKWorkoutActivityTypeRunning" duration="32" durationUnit="min" sourceName="지수의 Apple Watch" startDate="${fmt(s)}" endDate="${fmt(addMin(s, 32))}"/>`);
    return true;
  }
  return false;
}

// Quiz-only categories: walking from the iPhone, exercise and daylight from the Watch.
function writeQuizDay(i, worked) {
  const { rand, gauss } = extra;
  const day = new Date(end.getTime() - i * 86400000);
  const recent = i < RECENT;
  const weekend = [0, 6].includes(day.getUTCDay());
  for (const h of [9, 13, 19]) {
    const s = addMin(day, h * 60 + Math.round(rand() * 30));
    rec('HKQuantityTypeIdentifierWalkingStepLength', 'p', s, addMin(s, 10), (68 + gauss() * 1.5).toFixed(1), 'cm');
    rec('HKQuantityTypeIdentifierWalkingSpeed', 'p', s, addMin(s, 10), ((recent ? 4.4 : 4.8) + gauss() * 0.25).toFixed(2), 'km/hr');
  }
  const flights = Math.max(0, Math.round((recent ? 4 : 9) + gauss() * 3));
  if (flights) rec('HKQuantityTypeIdentifierFlightsClimbed', 'p', addMin(day, 8 * 60), addMin(day, 20 * 60), flights, 'count');
  const exercise = Math.max(0, Math.round((recent ? 6 : 11) + (worked ? 31 : 0) + gauss() * 4));
  if (exercise) rec('HKQuantityTypeIdentifierAppleExerciseTime', 'w', addMin(day, 7 * 60), addMin(day, 21 * 60), exercise, 'min');
  const daylight = Math.max(0, Math.round((recent ? 18 : weekend ? 75 : 42) + gauss() * 12));
  if (daylight) rec('HKQuantityTypeIdentifierTimeInDaylight', 'w', addMin(day, 9 * 60), addMin(day, 18 * 60), daylight, 'min');
}

for (let i = YEAR - 1; i >= 0; i--) writeQuizDay(i, writeDay(i, i < DAYS ? main : extra));
out.push('</HealthData>');
writeFileSync(new URL('../public/sample/export.xml', import.meta.url), out.join('\n'));
// The phone preview requests only the sample categories the visitor grants.
const collector = createCollector();
collector.feed(out.join('\n'));
writeReadFixtures(collector.data, end.toISOString().slice(0, 10), new URL('../public/sample/read/', import.meta.url));
console.log('records:', out.length);
