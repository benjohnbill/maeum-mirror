// Streams an Apple Health export.xml and keeps only
// the records the metrics need. Runs in the browser; nothing is uploaded.

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
const STEPS = 'HKQuantityTypeIdentifierStepCount';
const RHR = 'HKQuantityTypeIdentifierRestingHeartRate';
const HRV = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN';
// Daily values the rapport quiz asks about. Each maps dayKey -> [values].
const DAILY = {
  HKQuantityTypeIdentifierWalkingStepLength: 'stride', // cm
  HKQuantityTypeIdentifierWalkingSpeed: 'speed', // km/hr
  HKQuantityTypeIdentifierFlightsClimbed: 'flights', // count
  HKQuantityTypeIdentifierTimeInDaylight: 'daylight', // min
  HKQuantityTypeIdentifierAppleExerciseTime: 'exercise', // min
};

function attr(tag, name) {
  const key = ` ${name}="`;
  const i = tag.indexOf(key);
  if (i < 0) return null;
  const s = i + key.length;
  return tag.slice(s, tag.indexOf('"', s));
}

// "2026-11-20 23:10:00 +0900" -> minutes since epoch in wall-clock time.
// The time zone is ignored on purpose: a night is a night where it was slept.
export function wallMinutes(str) {
  return Date.UTC(+str.slice(0, 4), +str.slice(5, 7) - 1, +str.slice(8, 10), +str.slice(11, 13), +str.slice(14, 16)) / 60000;
}

export function createCollector() {
  const data = {
    sleep: [], // [startMin, endMin] asleep segments
    steps: new Map(), // dayKey -> Map(source -> sum)
    rhr: new Map(), // dayKey -> [values]
    hrv: new Map(),
    workouts: [], // dayKey
    ...Object.fromEntries(Object.values(DAILY).map((name) => [name, new Map()])),
    records: 0,
  };
  const push = (map, day, v) => (map.has(day) ? map.get(day).push(v) : map.set(day, [v]));

  function handle(tag) {
    if (tag.startsWith('Record ')) {
      data.records++;
      const type = attr(tag, 'type');
      if (type === SLEEP) {
        const v = attr(tag, 'value') || '';
        if (!v.includes('Asleep')) return;
        data.sleep.push([wallMinutes(attr(tag, 'startDate')), wallMinutes(attr(tag, 'endDate'))]);
      } else if (type === STEPS) {
        const day = attr(tag, 'startDate').slice(0, 10);
        const src = attr(tag, 'sourceName') || '';
        const m = data.steps.get(day) || data.steps.set(day, new Map()).get(day);
        m.set(src, (m.get(src) || 0) + +attr(tag, 'value'));
      } else if (type === RHR) {
        push(data.rhr, attr(tag, 'startDate').slice(0, 10), +attr(tag, 'value'));
      } else if (type === HRV) {
        push(data.hrv, attr(tag, 'startDate').slice(0, 10), +attr(tag, 'value'));
      } else if (DAILY[type]) {
        push(data[DAILY[type]], attr(tag, 'startDate').slice(0, 10), +attr(tag, 'value'));
      }
    } else if (tag.startsWith('Workout ')) {
      data.workouts.push(attr(tag, 'startDate').slice(0, 10));
    }
  }

  let buf = '';
  function feed(text) {
    buf += text;
    let i = 0;
    for (;;) {
      const lt = buf.indexOf('<', i);
      if (lt < 0) { buf = ''; return; }
      const gt = buf.indexOf('>', lt);
      if (gt < 0) { buf = buf.slice(lt); return; }
      handle(buf.slice(lt + 1, gt));
      i = gt + 1;
    }
  }
  return { feed, data };
}

async function feedXmlStream(stream, total, collector, onProgress) {
  const reader = stream.getReader();
  const dec = new TextDecoder();
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    read += value.byteLength;
    collector.feed(dec.decode(value, { stream: true }));
    onProgress?.(read / total);
  }
  collector.feed(dec.decode());
}

export async function parseHealthFile(file, onProgress) {
  const collector = createCollector();
  await feedXmlStream(file.stream(), file.size, collector, onProgress);
  if (!collector.data.records) throw new Error('건강 기록을 하나도 찾지 못했어요.');
  return collector.data;
}
