// Scripted replies for running without a Gemini key (offline rehearsal, UI checks).
const SCRIPT = [
  { reply: '데이터부터 봤어요. 최근 2주 잠드는 시각이 평소보다 1시간 넘게 늦어졌어요. 요즘 밤엔 주로 뭐 하면서 보내요?', focus: 'onset' },
  { reply: '마감 때문에 밤을 붙잡고 있었군요. 누우면 바로 잠드는 편이에요, 한참 뒤척이는 편이에요?', focus: 'sleep', items: [{ id: 3, score: 2, why: '늦게까지 잠들지 못함' }] },
  { reply: '누워도 머리가 안 꺼지는 쪽이네요. 걸음도 평소의 절반쯤으로 줄었는데, 낮엔 기운이 좀 있어요?', focus: 'steps', items: [{ id: 3, score: 2, why: '뒤척임' }] },
  { reply: '낮에도 몸이 무거운 거네요. 예전에 하던 저녁 달리기 같은 건 요즘 어떻게 느껴져요?', focus: 'workout', items: [{ id: 4, score: 2, why: '낮에 피곤함' }] },
  { reply: '좋아하던 것도 손이 안 가는 2주였네요. 원하면 2분짜리 짧은 검사로 요즘 기분을 더 정확히 볼 수 있어요.', focus: 'none', items: [{ id: 1, score: 1, why: '달리기가 귀찮아짐' }], offer_test: true },
  { reply: '일할 때 집중은 어때요? 같은 문장을 여러 번 읽게 된다거나요.', focus: 'none' },
  { reply: '요즘 스스로에 대해서는 어떤 생각이 자주 들어요?', focus: 'none', items: [{ id: 7, score: 1, why: '집중이 흐트러짐' }] },
  { reply: '정리해 보면, 마감 때문에 밤이 길어졌고, 누워도 잠이 안 오고, 낮엔 기운이 없었어요. 리포트로 정리해 볼게요.', focus: 'none', items: [{ id: 6, score: 1, why: '스스로를 탓하는 생각' }, { id: 2, score: 1, why: '가끔 가라앉음' }], done: true },
];

export function mockTurn(history) {
  const turn = history.filter((h) => h.role === 'user').length;
  const s = SCRIPT[Math.min(turn, SCRIPT.length - 1)];
  const items = SCRIPT.slice(0, turn + 1).flatMap((x) => x.items || []);
  return { reply: s.reply, focus: s.focus, items, risk: 'none', offer_test: !!s.offer_test, done: !!s.done };
}

export function mockReport() {
  return {
    type_name: '밤이 길어진 올빼미형',
    type_line: '하루의 끝이 뒤로 밀리면서 낮의 기운도 같이 줄어든 2주였어요.',
    evidence: [
      { metric: 'onset', data: '잠드는 시각이 평소보다 1시간 넘게 늦어졌어요.', said: '마감 때문에 밤을 붙잡고 있었다고 했어요.' },
      { metric: 'steps', data: '하루 걸음이 평소의 절반쯤으로 줄었어요.', said: '낮에도 몸이 무겁다고 했어요.' },
      { metric: 'workout', data: '주 2~3회 하던 운동 기록이 2주째 없어요.', said: '좋아하던 달리기도 귀찮아졌다고 했어요.' },
    ],
    reflection: '마감이 몰린 시기에 밤을 붙잡게 된 건 이상한 일이 아니에요. 누워도 머리가 안 꺼진다는 말이 이번 2주를 잘 보여 줘요.',
    step: { action: '이번 주 이틀만 00시 15분에 불 끄기', obstacle: '마감이 남아 있으면 계속 붙잡게 돼요', plan: '그날 할 일을 23시 반에 메모로 넘겨 두기' },
    card_line: '요즘 내 하루는 조금 늦게 끝나요',
  };
}
