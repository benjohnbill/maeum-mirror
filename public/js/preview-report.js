// Fictional dialogue for the local demo. Report values are calculated from the replies.
export const workoutConcern = '지난 일이 계속 마음에 남아요. 제가 회복이 느린 건지, 걱정이 많은 건지 궁금해요.';
export const workoutStories = [
  {
    opening: '이번 주엔 퇴근하면 아홉 시였어요. 공원에서 뛰는 사람들 보면 좀 부러웠어요.',
    question: '늦은 퇴근길에 뛰는 사람들이 눈에 들어왔군요. 그 주말은 어떻게 보냈어요?',
    detail: '토요일에 친구가 뛰자고 해서 반가웠어요. 가족 일정이 있어서 다음 토요일로 약속을 잡았어요. 다음 주에 뛸 생각에 기대됐어요.',
    reflection: '늦은 퇴근길에 달리는 사람들을 보며 부러웠고, 친구가 뛰자고 했을 때는 다음 토요일로 약속을 잡았어요.',
  },
  {
    opening: '수요일엔 일찍 왔어요. 뛸 시간도 있었는데 그날은 별로 나가고 싶지 않았어요.',
    question: '일찍 온 날엔 달리기를 쉬었군요. 평소 기다리던 다른 약속은 어땠어요?',
    detail: '토요일에 보드게임 모임이 있었어요. 원래 제가 먼저 가자고 하는데, 그날은 시간이 돼도 별로 가고 싶지 않아서 쉬었어요. 요즘은 좋아하던 모임도 즐겁지 않았어요.',
    reflection: '일찍 퇴근한 수요일에는 달리기를 쉬었고, 주말에는 먼저 가자고 하던 보드게임 모임도 내키지 않았어요.',
    samplePhq9: {
      'phq9.1': 3, 'phq9.2': 1, 'phq9.3': 2, 'phq9.4': 1, 'phq9.5': 0,
      'phq9.6': 1, 'phq9.7': 2, 'phq9.8': 0, 'phq9.9': 0,
    },
    screeningOffer: '달리기도 보드게임도 평소만큼 내키지 않았군요. 이런 날이 얼마나 자주 있었는지, 지난 2주를 PHQ-9 아홉 문항으로 돌아볼까요?',
  },
];
// The landing example person also finished every test the app can open.
// Answers are listed in item order (tipi.1, tipi.2, …) and scored like real answers.
// PHQ-9 reuses the example dialogue's sample answers.
export const exampleTestAnswers = {
  tipi: [5, 3, 6, 4, 5, 3, 6, 3, 4, 3],
  swls: [3, 4, 3, 4, 3],
  fs: [5, 5, 4, 5, 5, 4, 5, 5],
  spane: [4, 4, 4, 4, 3, 4, 5, 3, 4, 4, 3, 4],
  mlq: [4, 5, 5, 4, 4, 4, 5, 5, 3, 5],
  cbi: [75, 50, 50, 75, 50, 25],
  // Landing example only: total 2 (sleep and tiredness, 1 each) sits mid-pack, about 43등 among Korean adults.
  phq9: [0, 0, 1, 1, 0, 0, 0, 0, 0],
};

const everydayStory = {
  opening: '오전엔 회의 자료를 다 썼어요. 오후엔 메일 한 통을 쓰는 데도 한참 걸렸어요.',
  question: '오후에는 메일 한 통에 시간이 걸렸군요. 일을 마치고 나서는 어떻게 보냈어요?',
  detail: '저녁엔 친구를 만나서 밀린 이야기를 했어요.',
  reflection: '오후에는 메일 한 통을 쓰는 데 오래 걸렸고, 저녁엔 친구를 만나 밀린 이야기를 나눴어요.',
};

export const profileTopics = [
  {
    key: 'resilience', label: '회복탄력성', direction: '일상을 되찾기 수월한 순', period: '평소의 경향',
    prompt: '최근에 신경 쓰이던 일이 하나 끝났던 때를 떠올려 볼까요. 그 뒤로 평소 하던 일을 다시 시작한 건 언제쯤이었어요?',
    neutralFollowUp: '그게 평소와 비슷했는지 궁금해요. 다른 일이 꼬였을 때는 어땠어요?',
    samples: [
      {
        first: '발표를 마친 날은 저녁을 대충 먹었어요. 다음 날엔 평소처럼 아침을 챙기고 출근했어요.',
        followUp: '다음 날 출근은 하셨군요. 마음까지 풀린 건 언제였어요? 다른 마감을 넘겼을 때와 비교하면 어땠나요?',
        second: '이번에도 지난달 마감 때도, 하루 자고 나면 마음이 한결 가벼웠어요. 다음 날엔 밀린 책을 다시 읽을 여유도 생겼어요.',
      },
      {
        first: '발표는 수요일에 끝났는데, 주말이 돼서야 장을 보고 평소처럼 밥을 해 먹었어요.',
        followUp: '주말에 다시 장을 보셨군요. 그전 며칠은 어떤 상태였어요? 다른 마감 뒤에도 비슷했나요?',
        second: '이번에도 지난달 마감 뒤에도 시간은 있었어요. 그런데 사나흘은 진이 빠졌고, 주말이 돼야 장도 보고 싶어졌어요.',
      },
    ],
  },
  {
    key: 'worry', label: '불안 지수', direction: '걱정이 일상을 자주 방해하는 순', period: '최근 2주',
    prompt: '이제 일이 끝난 뒤 말고, 아직 답을 기다리던 때를 떠올려 볼게요. 지난 2주 동안 다른 걸 하다가도 생각이 다시 그쪽으로 간 날이 얼마나 있었어요?',
    neutralFollowUp: '그 생각이 돌아온 날에는 하던 일을 어떻게 이어갔어요?',
    samples: [
      {
        first: '열흘쯤 그랬어요. 답을 기다리는 일이 없는 날에도 다른 걱정거리가 또 떠올랐어요.',
        followUp: '답을 기다리지 않는 날에도 다른 걱정이 떠올랐군요. 가장 최근에 그랬던 날, 하던 일을 다시 이어가기까지 어땠어요?',
        second: '저녁을 먹다가도 메일함을 세 번 열었어요. 닫으면 또 생각나서 친구가 하던 말을 놓쳤어요.',
      },
      {
        first: '결과를 기다린 이틀 정도요. 다른 날엔 퇴근하고 나면 그 생각을 별로 안 했어요.',
        followUp: '결과를 기다린 이틀에 주로 생각이 났군요. 그중 하루만 보면, 걱정이 떠올랐을 때 하던 일은 어떻게 됐어요?',
        second: '저녁에 잠깐 생각나서 확인할 걸 적어 뒀어요. 그다음엔 친구랑 하던 이야기를 마저 했어요.',
      },
    ],
  },
];

const everydayScenes = [
  {
    prompt: '최근에 마감이 있던 일은 언제 손을 댔어요? 시간이 얼마 안 남았을 때는 어땠나요?',
    replies: ['발표 자료는 시작을 자꾸 내일로 미뤄요. 그래도 시간이 촉박하면 오히려 집중이 잘돼요.', '이번에도 마감 전에 미리 해뒀어요. 시간이 촉박하면 머리가 하얘져서 숫자를 틀렸어요.'],
  },
  {
    prompt: '공들인 일에 짧은 답장만 왔던 때가 있나요? 그 답을 어떻게 읽었고, 어떤 말을 듣고 싶었어요?',
    replies: ['팀장님 답장이 짧으면 내가 뭔가 잘못했나 싶어요. 그래도 칭찬이 없어도 스스로 만족하면 충분해요.', '답장이 짧아도 그냥 바쁜가 보다 해요. 그래도 내가 한 일을 인정해 줘야 마음이 놓여요.'],
  },
  {
    prompt: '속상한 말이 오간 날, 그 대화가 얼마나 오래 남았어요? 쉬고 나서는 어땠나요?',
    replies: ['그날 기분 나빴던 말을 계속 곱씹었어요. 친구랑 얘기하고 나니 긴장이 풀렸어요.', '기분 나쁜 말은 그날로 털어내요. 그런데 푹 자도 마음이 가벼워지지 않았어요.'],
  },
];

const skipped = (text) => /^(?:이 이야기는 건너뛸게요|건너뛰기|패스|(?:잘 )?모르겠어요|기억이 안 나요)[.!~ ]*$/u.test(text);
const earlyEnd = (text) => /^(?:그만|여기까지|그만할래요|마칠게요)[.!~ ]*$/u.test(text);
const missingRecord = (text) => /(?:워치|시계|기기|기록).{0,9}(?:안 찼|안 차|안 켰|빠졌|누락|안 남)|(?:워치|시계) 없이/u.test(text);
const mixed = (text) => /둘 다|둘다|두 가지 다/u.test(text);
const done = { reply: '여기까지 나눈 이야기로 결과를 정리했어요.', done: true, focus: 'none' };

export function previewSession(metrics) {
  const workout = metrics.find((m) => m.id === 'workout');
  return { metric: workout || metrics[0], concern: workoutConcern, stories: workout ? workoutStories : [everydayStory], answers: [], correction: '' };
}

export function caseAnswers(session, index) {
  const story = session.stories[index];
  const replies = [session.concern, story.opening, story.detail];
  for (const topic of profileTopics) {
    const sample = topic.samples[index];
    replies.push(sample.first, sample.second);
  }
  for (const scene of everydayScenes) replies.push(scene.replies[index]);
  return replies;
}

export function recordText(metric) {
  if (metric.id === 'workout' && metric.recent === 0) return '평소 ' + metric.baseText + ' · 최근 2주간 기록 0회';
  return '평소 ' + metric.baseText + ' · 최근 2주 ' + metric.recentText;
}

export function previewTurn(session) {
  const { answers, concern, metric, stories } = session;
  const [first, opening] = answers;
  if (earlyEnd(answers.at(-1))) return done;
  if (!answers.length) return { reply: '오늘 여기 들어오면서 ‘이건 좀 알고 싶다’ 싶었던 게 있으면 편하게 말해 주세요.', choices: [concern], focus: 'none' };
  if (answers.length === 1) {
    if (first !== concern && !skipped(first)) return { reply: '그게 마음에 걸렸군요. 최근에 특히 그렇게 느꼈던 때 이야기를 조금 더 들려주세요.', choices: [], focus: 'none' };
    const reply = metric.id === 'workout'
      ? '평소엔 운동 기록이 일주일에 두세 번 있었는데 지난 2주에는 비어 있어요. 요즘 그 시간은 어떻게 보내셨어요?'
      : metric.label + ' 기록은 ' + recordText(metric) + '예요. 지난 2주 중 평소처럼 보낸 때나 유독 힘이 들었던 때가 떠오르나요?';
    return { reply, focus: metric.id, choices: stories.map((story) => story.opening) };
  }
  if (answers.length === 2) {
    const story = stories.find((item) => item.opening === opening);
    if (story) return { reply: story.question, choices: [story.detail], focus: 'none' };
    let reply = '그때 하려고 했던 일이나 그 뒤에 실제로 한 일이 있다면 이어서 들려주세요.';
    if (skipped(opening)) reply = '그 얘기는 넘어갈게요. 요즘 시간을 많이 쓰고 있는 일이 있다면 들려주세요.';
    else if (metric.id === 'workout' && missingRecord(opening)) reply = '운동 기록이 빠진 날이 있었군요. 처음에 마음에 걸렸던 일 중 다른 예가 하나 떠오르나요?';
    else if (mixed(opening)) reply = '그 두 가지가 각각 어느 날에 가까웠는지 기억나는 만큼만 알려주세요.';
    return { reply, choices: [], focus: 'none' };
  }
  // Three opening replies, then two independent exchanges per topic.
  const offset = answers.length - 3;
  const topic = profileTopics[Math.floor(offset / 2)];
  if (!topic) {
    const scene = everydayScenes[offset - profileTopics.length * 2];
    return scene ? { reply: scene.prompt, choices: scene.replies, focus: 'none' } : done;
  }
  if (offset % 2 === 0) return { reply: topic.prompt, choices: topic.samples.map((sample) => sample.first), focus: 'none' };
  const sample = topic.samples.find((item) => item.first === answers.at(-1));
  const reply = skipped(answers.at(-1)) ? '그 장면은 넘어갈게요. 다른 예를 들거나 이 주제를 건너뛰어도 돼요.' : sample?.followUp || topic.neutralFollowUp;
  return { reply, choices: topic.samples.map((item) => item.second), focus: 'none' };
}

export function previewResult(session) {
  const { answers, correction } = session;
  const hasContent = (answer) => Boolean(answer) && !skipped(answer) && !earlyEnd(answer);
  const context = answers.slice(1, 3).filter(hasContent);
  const story = session.stories.find((item) => item.opening === answers[1] && item.detail === answers[2]);
  const concern = hasContent(answers[0]) ? answers[0] : '';
  return { correction, concern, context,
    opening: correction ? `마지막으로 “${correction}”라고 바로잡아 주셨어요.`
      : story?.reflection || (context.length ? `“${context.at(-1)}”라고 들려주셨어요.` : ''),
  };
}
