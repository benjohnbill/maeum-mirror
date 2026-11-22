export { mockTurn } from './public/js/sample-chat.js';

export function mockReport() {
  return {
    type_name: '최근 2주의 수면과 낮 피로',
    type_line: '가상 사용자의 기록과 답변으로 만든 예시예요.',
    evidence: [
      { metric: 'sleep', text: '샘플에서 평균 수면 시간은 평소 7시간 11분에서 최근 2주 5시간 13분으로 줄었어요.' },
      { metric: 'onset', text: '평균적으로 잠든 시각도 자정 16분에서 새벽 1시 30분으로 늦어졌어요.' },
    ],
    reflection: '예시 대화에서 이 사람은 점심 뒤 잠깐 눈을 붙였고, 오후에는 피곤해서 급한 메일에만 답했다고 했어요.',
    small_step: '이번 주에는 하루만, 점심을 먹고 난 뒤 어떤 일을 했는지 한 줄 남겨 봐요.',
    card_line: '지난 2주의 수면 기록',
  };
}
