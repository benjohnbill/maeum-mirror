// Streams an Apple Health export (export.xml or export.zip) and keeps only
// the records the metrics need. Runs in the browser; nothing is uploaded.

const SLEEP = 'HKCategoryTypeIdentifierSleepAnalysis';
const STEPS = 'HKQuantityTypeIdentifierStepCount';
const RHR = 'HKQuantityTypeIdentifierRestingHeartRate';
const HRV = 'HKQuantityTypeIdentifierHeartRateVariabilitySDNN';

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

async function feedZip(file, collector, onProgress) {
  const { Unzip, UnzipInflate } = await import('https://cdn.jsdelivr.net/npm/fflate@0.8.2/esm/browser.js');
  const dec = new TextDecoder();
  let found = false;
  const unzip = new Unzip((entry) => {
    if (!/(^|\/)export\.xml$/.test(entry.name)) return;
    found = true;
    entry.ondata = (err, chunk, final) => {
      if (err) throw err;
      collector.feed(dec.decode(chunk, { stream: !final }));
    };
    entry.start();
  });
  unzip.register(UnzipInflate);
  const reader = file.stream().getReader();
  let read = 0;
  for (;;) {
    const { done, value } = await reader.read();
    if (done) { unzip.push(new Uint8Array(0), true); break; }
    read += value.byteLength;
    unzip.push(value);
    onProgress?.(read / file.size);
    await new Promise((r) => setTimeout(r)); // let the progress bar paint
  }
  if (!found) throw new Error('zip 안에서 export.xml을 찾지 못했어요. 건강 앱의 "모든 건강 데이터 내보내기" 파일이 맞는지 확인해 주세요.');
}

export async function parseHealthFile(file, onProgress) {
  const collector = createCollector();
  const isZip = /\.zip$/i.test(file.name) || file.type.includes('zip');
  if (isZip) await feedZip(file, collector, onProgress);
  else await feedXmlStream(file.stream(), file.size, collector, onProgress);
  if (!collector.data.records) throw new Error('건강 기록을 하나도 찾지 못했어요. Apple 건강 앱에서 내보낸 export.zip 또는 export.xml을 올려 주세요.');
  return collector.data;
}
