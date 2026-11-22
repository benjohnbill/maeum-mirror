import { runAssessment } from './assessment-sheet.js';

const limitMs = 1800;
const practice = [[17, 20], [46, 43]];
const sets = [
  [[35, 32], [52, 58], [74, 72], [83, 87]],
  [[42, 45], [68, 62], [81, 83], [57, 53]],
];

export function describeBlock(block) {
  const correctTimes = block.trials.filter(t => t.correct).map(t => t.ms).sort((a, b) => a - b);
  const mid = Math.floor(correctTimes.length / 2);
  const median = correctTimes.length % 2 ? correctTimes[mid] : (correctTimes[mid - 1] + correctTimes[mid]) / 2;
  const missed = block.trials.filter(t => t.ms === null).length;
  return {
    count: correctTimes.length + '/' + block.trials.length,
    detail: '오답 ' + (block.trials.length - correctTimes.length - missed) + '회 · 시간 초과 ' + missed
      + '회 · 정답 응답시간 중앙값 ' + (correctTimes.length ? (median / 1000).toFixed(2) + '초' : '해당 없음')
      + ' · 체감 압박 ' + block.rating + '/10',
  };
}

export function runPressureTask() {
  return runAssessment('시간 압박 속 수행', async ({ ask }) => {
    const conditions = Math.random() < .5 ? [false, true] : [true, false];
    const firstSet = Math.random() < .5 ? 0 : 1;
    const rounds = [{ label: '연습', items: practice, timed: false },
      ...conditions.map((timed, i) => ({ label: timed ? '한 문제에 1.8초' : '시간 제한 없음', items: sets[(firstSet + i) % 2], timed }))];
    const blocks = [];
    for (const [i, round] of rounds.entries()) {
      await ask({ position: i ? i + ' / 2묶음' : '연습', question: i ? round.label : '큰 숫자를 골라 주세요',
        instruction: i ? '두 숫자 중 큰 쪽을 골라 주세요. 모두 네 문제예요.'
          : '연습 두 문제 뒤, 시간 제한이 있는 묶음과 없는 묶음을 각각 풀어요. 숫자를 누르거나 왼쪽·오른쪽 방향키로 고르세요.',
        options: [{ value: 0, label: i ? '묶음 시작' : '연습 시작' }] });
      const trials = [];
      for (const [j, numbers] of round.items.entries()) {
        const largest = Math.max(...numbers);
        const { value, elapsed } = await ask({ position: round.label + ' · ' + (j + 1) + ' / ' + round.items.length,
          question: '어느 숫자가 더 큰가요?', pair: true, limitMs: round.timed ? limitMs : undefined,
          options: numbers.map((n, side) => ({ label: String(n), value: side })),
          feedback: side => side === null ? '시간이 지났어요.' : i ? '' : numbers[side] === largest ? '맞았어요.' : '큰 수는 ' + largest + '예요.' });
        trials.push({ correct: value !== null && numbers[value] === largest, ms: value === null ? null : Math.round(elapsed) });
      }
      if (i) {
        const { value: rating } = await ask({ position: round.label, question: '이번 묶음은 얼마나 촉박했나요?',
          instruction: '0은 전혀 촉박하지 않음, 10은 매우 촉박함이에요.',
          options: Array.from({ length: 11 }, (_, n) => ({ label: String(n), value: n })) });
        blocks.push({ timed: round.timed, trials, rating });
      }
    }
    return blocks;
  }, { closeOnHide: true });
}
