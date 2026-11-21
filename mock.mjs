// Scripted replies for running without a Gemini key (offline rehearsal, UI checks).
const SCRIPT = [
  { reply: '안녕하세요. 데이터를 먼저 봤어요. 최근 2주 동안 잠드는 시각이 평소보다 1시간 넘게 늦어졌고, 날마다 흔들림도 커졌어요. 요즘 밤에는 주로 어떻게 보내고 있어요?', focus: 'onset' },
  { reply: '그랬군요. 누우면 바로 잠드는 편이에요, 아니면 한참 뒤척이게 돼요?', focus: 'sleep', items: [{ id: 3, score: 2, why: '늦게까지 잠들지 못함' }] },
  { reply: '걸음 수도 평소의 절반 정도로 줄었어요. 낮에는 기운이 좀 있는 편이에요?', focus: 'steps', items: [{ id: 3, score: 2, why: '뒤척임' }] },
  { reply: '말해 줘서 고마워요. 예전에 즐겁던 일들, 예를 들면 저녁 달리기 같은 게 요즘은 어떻게 느껴져요?', focus: 'workout', items: [{ id: 4, score: 2, why: '낮에 피곤함' }] },
  { reply: '그럴 수 있어요. 일이나 공부할 때 집중은 어때요? 같은 문장을 여러 번 읽게 된다거나요.', focus: 'none', items: [{ id: 1, score: 1, why: '운동이 귀찮아짐' }] },
  { reply: '요즘 스스로에 대해서는 어떤 생각이 자주 들어요?', focus: 'none', items: [{ id: 7, score: 1, why: '집중이 흐트러짐' }] },
  { reply: '이야기해 줘서 고마워요. 이제 지난 2주를 정리한 리포트를 보여 드릴게요.', focus: 'none', items: [{ id: 6, score: 1, why: '스스로를 탓하는 생각' }, { id: 2, score: 1, why: '가끔 가라앉음' }], done: true },
];

export function mockTurn(history) {
  const turn = history.filter((h) => h.role === 'user').length;
  const s = SCRIPT[Math.min(turn, SCRIPT.length - 1)];
  const items = SCRIPT.slice(0, turn + 1).flatMap((x) => x.items || []);
  return { reply: s.reply, focus: s.focus, items, done: !!s.done };
}

export function mockReport() {
  return {
    type_name: '밤이 길어진 올빼미형',
    type_line: '하루의 끝이 점점 뒤로 밀리면서, 낮의 기운도 같이 줄어든 2주였어요.',
    evidence: [
      { metric: 'onset', text: '잠드는 시각이 평소보다 1시간 넘게 늦어졌고, 밤마다 흔들림이 두 배가 됐어요. 뒤척인다는 말과 같은 방향이에요.' },
      { metric: 'steps', text: '걸음 수가 절반으로 줄었어요. 낮에 기운이 없다는 말과 맞닿아 있어요.' },
      { metric: 'workout', text: '주 2~3회 하던 저녁 달리기가 2주째 멈췄어요.' },
    ],
    reflection: '바쁜 시기에 밤을 늦게까지 붙잡게 된 건 이상한 일이 아니에요. 다만 몸은 그 사이에 꽤 지쳐 있다는 신호를 보내고 있어요. 즐겁던 일이 귀찮아졌다는 말도 그 신호의 일부일 수 있어요.',
    small_step: '이번 주에 이틀만, 평소 잠들던 00시 15분에 맞춰 불을 꺼 봐요.',
    card_line: '요즘 내 하루는 조금 늦게 끝나요',
  };
}
