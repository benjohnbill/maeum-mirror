const ratings = ['1 · 거의 그렇지 않다', '2', '3', '4', '5 · 매우 자주 그렇다'];
const tension = [...Array.from({ length: 11 }, (_, i) => String(i)), '기억나지 않아요'];
const sceneChoices = ['거절의 뜻으로 받아들인다', '다른 사정이 있다고 생각한다', '지금은 판단을 보류한다'];

const praise = [
  ['동료의 발표 자료를 손봤어요.', '복잡한 내용을 한 장에 잘 담았네.', '네가 정리해 줘서 내가 설명하기 편했어.'],
  ['친구와 갈 여행 일정을 짰어요.', '네가 알아봐 준 덕분에 나는 마음이 놓였어.', '동선 겹치는 곳 없이 일정을 잘 짰네.'],
  ['모임에서 저녁을 준비했어요.', '여러 명 몫인데도 간을 딱 맞췄네.', '네가 챙겨 줘서 다 같이 편하게 먹었어.'],
  ['처음 온 사람에게 길을 안내했어요.', '네가 알려줘서 헤매지 않고 도착했어.', '처음 듣는 길도 쉽게 그려지게 설명하네.'],
  ['함께 쓸 물건의 고장을 고쳤어요.', '원인이 어디 있는지 금방 찾아냈네.', '네가 고쳐 줘서 오늘 바로 쓸 수 있었어.'],
  ['새로 온 사람에게 모임 규칙을 설명했어요.', '네가 알려줘서 처음인데도 편하게 참여했어.', '처음 듣는 사람한테 중요한 것만 잘 짚어 주네.'],
];

const recoveryTime = ['마친 날', '다음 날', '이틀이나 사흘 뒤', '나흘 이상 지난 뒤', '기억나지 않아요'];

export const resilienceTopic = {
  id: 'resilience', title: '회복탄력성', method: '일상 복귀 기록 · 두 장면',
  instruction: '부담스러운 일이 끝난 뒤 평소 생활로 돌아온 최근 두 번을 떠올려 주세요.',
  questions: ['가장 최근에는 평소 하던 일을 언제 다시 시작했나요?', '그 전에는 언제 다시 시작했나요?'].map(text => ({ text, options: recoveryTime })),
  summary(answers) {
    const days = answers.map(i => recoveryTime[i]);
    const comparison = answers.includes(4) ? null : { score: 6 - answers[0] - answers[1], min: 0, max: 6 };
    return { value: days.join(' · '), detail: '최근 두 번의 일상 복귀 시점이에요.', comparison,
      basis: '각 장면에서 복귀가 빠른 순서대로 3·2·1·0점을 주고 두 값을 합해요. 이 체험용 문항은 두 장면에서 직접 선택한 복귀 시점을 비교해요.' };
  },
};

export const topics = [
  {
    id: 'delay', title: '실행 미루기', method: '한국어판 PPS · 5문항',
    prompt: '하려고 마음먹은 일을 얼마나 자주 미루나요?',
    instruction: '각 문장이 평소 내 모습에 얼마나 자주 해당하는지 골라 주세요.',
    questions: [
      '나는 여러 가지 일의 마감일을 앞두고 종종 다른 것을 하느라 시간을 허비한다.',
      '나는 그저 앉아서 진행하면 되는 그런 일들도 며칠 동안 좀처럼 끝내지 못하곤 한다.',
      '나는 종종 며칠 전에 하고자 했던 일을 지금에서야 하는 나 자신을 발견하곤 한다.',
      '나는 계속 ‘그 일은 내일하면 되지’라는 말을 한다.',
      '나는 내가 해야 하는 일을 시작도 하기 전에 대체로 미룬다.',
    ].map(text => ({ text, options: ratings })),
    summary(answers) {
      const scores = answers.map(index => index + 1);
      const total = scores.reduce((a, b) => a + b, 0);
      return { value: total + '점', comparison: { score: total, min: 5, max: 25 }, detail: '가능한 범위는 5~25점이에요. 높을수록 실행을 미룬다는 문장에 더 자주 그렇다고 답했어요.',
        basis: scores.join(' + ') + ' · 한국어판 PPS 4~8번 응답 합계' };
    },
    source: ['한국어판 PPS 표 8 · Kim 등 (2020)', 'https://doi.org/10.1080/23311908.2020.1809844'],
    credit: 'PPS 원척도 Piers Steel. 한국어 문항 H. Kim, H. Kim, W.-K. Lee, S. Han, P. Carlbring, A. Rozental. CC BY 4.0. 표 8에서 실행지연 5문항을 발췌했고 응답 화면은 마음 시간표가 구성했어요.',
  },
  {
    id: 'social', title: '눈치', method: '상황 선택 · 3장면',
    prompt: '상대의 반응이 애매할 때 어떤 뜻으로 읽나요?',
    instruction: '각 장면에서 가장 먼저 들 것 같은 생각을 골라 주세요.',
    questions: ['만나자고 했더니 “일정 보고 알려줄게”라는 답이 왔어요.', '회의에서 내 제안을 듣고 상대가 잠시 말이 없어요.', '길게 보낸 메시지에 짧은 답장 하나가 왔어요.'].map(text => ({ text, options: sceneChoices })),
    summary(answers) {
      const count = answers.filter(index => index === 0).length;
      return { value: count + ' / 3장면', comparison: { score: count, min: 0, max: 3 }, detail: '애매한 반응을 거절로 읽겠다고 고른 장면 수예요.', basis: '세 장면의 첫 해석을 세었어요. 상대의 실제 의도는 주어지지 않았어요.' };
    },
    source: ['관련 연구 · 대학생 거부민감성척도', 'https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART002199534'],
  },
  {
    id: 'rumination', title: '화난 일 곱씹기', method: '경험 기록 · 지난 7일',
    prompt: '이미 지나간 일이 다시 화가 났던 날은 며칠인가요?',
    instruction: '지난 7일을 떠올려 보세요. 하루에 여러 번 그랬어도 하루로 세어요.',
    questions: [{ text: '지난 일을 다시 떠올리며 화가 났던 날', options: [...Array.from({ length: 8 }, (_, i) => i + '일'), '기억나지 않아요'] }],
    summary([days]) {
      return days === 8 ? { value: '기억하기 어려움', detail: '이번에는 일수를 기록하지 않았어요.' }
        : { value: days + ' / 7일', comparison: { score: days, min: 0, max: 7 }, detail: '지난 일을 되새기며 다시 화가 났다고 기억한 날이에요.' };
    },
    source: ['관련 연구 · 한국판 분노반추척도', 'https://www.kci.go.kr/kciportal/landing/article.kci?arti_id=ART001241138'],
  },
  {
    id: 'recognition', title: '인정받고 싶은 마음', method: '중요도와 말 선택',
    prompt: '인정은 내게 얼마나 중요하고, 어떤 말이 더 반가울까요?',
    instruction: '중요도를 고른 뒤, 여섯 장면에서 같은 사람이 같은 말투로 말한다고 생각하고 더 듣고 싶은 말을 골라 주세요.',
    questions: [{ text: '최근에 다른 사람과 일을 마쳤을 때, 내가 한 일을 알아봐 주는 게 얼마나 중요했나요? (0 전혀 중요하지 않음 · 10 매우 중요함)', options: tension },
      ...praise.map(([text, a, b]) => ({ text, options: [a, b, '둘 다 비슷해요', '이 상황은 답하기 어려워요'] }))],
    summary([importance, ...choices]) {
      const skill = choices.filter((option, i) => option === i % 2).length;
      const help = choices.filter((option, i) => option === 1 - i % 2).length;
      return { value: importance === 11 ? '중요도 미기록' : '중요도 ' + importance + ' / 10',
        comparison: importance === 11 ? null : { score: importance, min: 0, max: 10 },
        detail: '듣고 싶은 말은 솜씨를 알아주는 말 ' + skill + '번, 도움이 됐다는 말 ' + help + '번이에요.',
        basis: '6개 장면 중 두 말이 비슷함 ' + choices.filter(x => x === 2).length + '번, 답하기 어려움 ' + choices.filter(x => x === 3).length + '번. 중요도는 첫 질문에 직접 매긴 값이에요.' };
    },
    source: ['관련 연구 · 감사와 기여감', 'https://doi.org/10.1037/a0017935'],
  },
  {
    id: 'recovery', title: '회복 방식', method: '한 장면 돌아보기',
    prompt: '최근에 쉬었던 날, 마음의 긴장은 어떻게 달라졌나요?',
    instruction: '최근 한 번의 휴식을 떠올려 주세요. 긴장은 0(전혀 없음)부터 10(매우 큼)까지예요.',
    questions: [
      { text: '그때 주로 무엇을 했나요?', options: ['혼자 쉬기', '누군가와 대화하기', '걷거나 운동하기', '취미 즐기기', '다른 활동'] },
      { text: '활동 바로 전의 긴장은 어느 정도였나요?', options: tension },
      { text: '활동을 마친 직후의 긴장은 어느 정도였나요?', options: tension },
    ],
    summary([activity, before, after]) {
      if (before === 11 || after === 11) return { value: '변화량 미기록', detail: '전후 중 기억하기 어려운 시점이 있었어요.' };
      const name = this.questions[0].options[activity];
      return { value: before + ' → ' + after + '점', comparison: { score: before - after, min: -10, max: 10 }, detail: name + ' 전후로 기억한 긴장이 ' + (before === after ? '같았어요.' : Math.abs(after - before) + '점 ' + (after < before ? '낮아졌어요.' : '높아졌어요.')),
        basis: '한 장면에서 본인이 기억한 두 값의 차이예요. 다른 날과 활동의 효과를 비교하려면 여러 번 기록해야 해요.' };
    },
    source: ['관련 연구 · 일상에서의 회복 기록', 'https://pubmed.ncbi.nlm.nih.gov/16248688/'],
  },
];

export const pressureTopic = {
  id: 'pressure', title: '시간 압박 속 수행', method: '숫자 비교 과제',
  prompt: '시간이 촉박해지면 선택 속도와 정확도는 어떻게 달라질까요?',
  source: ['관련 연구 · 시간 제한과 응답 정확도', 'https://doi.org/10.1007/s42113-020-00074-y'],
};

export const everydayTopics = [...topics, pressureTopic];
