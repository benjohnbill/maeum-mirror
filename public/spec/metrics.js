// What each body metric can and cannot say about mood.
// Source: research/04-body-to-mind/REPORT.md (ids S04-xx are in its sources.md).
// Read by the prompt (server and browser) and by the report cards.

export const METRICS = {
  sleep: {
    label: '수면 시간',
    strength: 'moderate',
    direction: '짧아지거나 길어질 때 둘 다 (U자)',
    evidence: '짧은 수면 RR 1.31, 긴 수면 RR 1.42 (전향 연구 메타분석)',
    source: 'Zhai et al., 2015, Depression and Anxiety',
    ask: '최근 2주 잠이 평소보다 줄었거나 늘었어요. 요즘 잠은 어땠어요?',
    never: '잠의 증감으로 기분 방향을 단정하기',
    quiet: { pct: 5 },
  },
  onset: {
    label: '잠드는 시각',
    strength: 'weak',
    direction: '늦어질 때',
    evidence: '늦은 취침과 우울 증상 b = 0.068 (의사 인턴 2,115명)',
    source: 'Fang et al., 2021, npj Digital Medicine',
    ask: '잠드는 시각이 평소보다 늦어졌어요. 밤에 뭘 하면서 보냈어요?',
    never: '늦게 자는 것을 문제 신호로 말하기 (한국 20대 평균 취침 0시 37분, 2024 생활시간조사)',
    quiet: { min: 20 },
  },
  regularity: {
    label: '잠드는 시각의 흔들림',
    strength: 'moderate',
    direction: '들쭉날쭉해질 때',
    evidence: '규칙적으로 자는 사람의 우울 발생 위험 HR 0.62 (UK Biobank 79,666명)',
    source: 'Li et al., 2025, Psychological Medicine',
    ask: '잠드는 시각이 평소보다 들쭉날쭉했어요. 생활 리듬에 바뀐 게 있었어요?',
    never: '집단 위험비를 개인 확률처럼 말하기',
    quiet: { ratio: 1.2 },
  },
  steps: {
    label: '하루 걸음 수',
    strength: 'moderate',
    direction: '줄어들 때',
    evidence: '걸음 수와 우울 증상 r = −0.12 (33개 연구, 96,173명 메타분석)',
    source: 'Bizzozero-Peroni et al., 2024, JAMA Network Open',
    ask: '하루 걸음이 평소와 달라졌어요. 밖에 나갈 일이 달라졌어요?',
    never: '"걸으면 우울이 줄어요" 같은 처방',
    quiet: { pct: 10 },
  },
  rhr: {
    label: '안정 시 심박',
    strength: 'weak',
    direction: '높아질 때',
    evidence: '메타분석 없음. 대규모 관찰 연구에서 약한 관련',
    source: 'Presby et al., 2025, Journal of Medical Internet Research',
    ask: '안정 시 심박이 평소와 달라졌어요. 요즘 몸 컨디션은 어땠어요?',
    never: '심박으로 스트레스를 판정하기. 3회 이내 차이는 측정 오차 범위(MAE 3.73회)',
    quiet: { abs: 3 },
  },
  hrv: {
    label: '심박변이도(HRV)',
    strength: 'weak',
    direction: '낮아질 때',
    evidence: 'SDNN r = −0.15 (전향 메타분석). Apple Watch HRV 오차 MAPE 28.9%',
    source: 'Galin et al., 2026, Journal of Affective Disorders; O\'Grady et al., 2024, Sensors',
    ask: null,
    never: 'HRV로 대화를 열기, "자율신경", "스트레스 지수"',
    quiet: { pct: 20 },
  },
  workout: {
    label: '운동 횟수',
    strength: 'weak',
    direction: '줄어들 때',
    evidence: '운동 기록 횟수의 변화를 직접 다룬 연구 없음',
    source: 'Pearce et al., 2022, JAMA Psychiatry; Chekroud et al., 2018, Lancet Psychiatry',
    ask: '운동 기록이 평소와 달라졌어요. 바빠진 거예요, 쉬고 싶었던 거예요?',
    never: '운동을 처방처럼 권하기',
    quiet: { abs: 0.5 },
  },
};

export const STRENGTH_LABEL = { strong: '근거 강함', moderate: '근거 보통', weak: '근거 약함' };

// True when the change is inside measurement noise and should not be talked about.
export function isQuiet(id, base, recent) {
  const q = METRICS[id]?.quiet;
  if (!q || base == null || recent == null) return true;
  if (q.pct != null) return Math.abs((recent - base) / base) * 100 < q.pct;
  if (q.min != null || q.abs != null) return Math.abs(recent - base) < (q.min ?? q.abs);
  if (q.ratio != null) return recent / base < q.ratio && base / recent < q.ratio;
  return false;
}
