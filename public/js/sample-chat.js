import { offlineScreeningOffer } from './screening-router.js';

// The preview follows one fictional week. Scene choices only select the next message.
const afterLunch = {
  '하던 일로 바로 돌아갔어요.': {
    reply: '바로 일로 돌아갔군요. 그날 손에 잘 잡혔던 일이나 오래 붙잡고 있던 일이 하나 떠오르면 들려주세요.',
    suggestedReply: '메일은 금방 썼는데, 회의 자료는 오래 붙잡고 있었어요.',
  },
  '잠깐 눈을 붙였어요.': {
    reply: '잠깐 눈을 붙였군요. 쉬고 나서 마저 한 일이나 내일로 미뤄 둔 일을 하나만 들려주세요.',
    suggestedReply: '오후에는 피곤해서 급한 메일에만 답했어요.',
  },
  '밖에 나가 걸었어요.': {
    reply: '걸으러 나갔군요. 돌아와서 남은 오후를 어떻게 보냈는지 조금 더 듣고 싶어요.',
    suggestedReply: '돌아와서 동료랑 밀린 일을 마무리했어요.',
  },
};

const afternoon = {
  reply: '그날 오후도 잠깐 짚어볼게요. 점심을 먹고 난 뒤, 기억에 가까운 장면을 골라도 좋아요.',
  choices: Object.keys(afterLunch),
  focus: 'none',
};

const anotherDay = {
  reply: '이번에는 조금 다르게 보낸 날을 떠올려 봐요. 기억해 두고 싶은 하루가 있으면 그 이야기로 마무리할게요.',
  suggestedReply: '토요일에는 일찍 쉬고, 다음 날은 친구랑 아침을 먹었어요.',
  focus: 'none',
};
const done = { reply: '이야기해 주셔서 고마워요. 이제 리포트를 볼 수 있어요.', focus: 'none', done: true };

export function mockTurn(history, metrics, screeningAvailable = true) {
  const replies = history.filter((entry) => entry.role === 'user' && !entry.text.startsWith('(사용자가 매우 힘든 마음을')).map((entry) => entry.text.trim());
  const lunchReply = replies[2] || '';
  const skip = /^(?:건너뛰기|건너뛸게요|넘어갈래요|패스|(?:잘 )?모르겠어요|기억이 안 나요|말하고 싶지 않아요|말하기 싫어요|이 이야기는 건너뛸게요)[.!~]*$/u;
  const skippedLunch = skip.test(lunchReply);
  if (/^(?:그만|그만할래요|여기까지|여기까지만 할게요|마칠게요)[.!~]*$/u.test(replies.at(-1) || '')) {
    return { ...done, items: [] };
  }
  const offer = screeningAvailable && offlineScreeningOffer(replies.at(-1) || '');
  if (offer) return { ...offer, focus: 'none', choices: [], done: false };
  let turn;
  switch (replies.length) {
    case 0: {
      const first = metrics?.[0];
      const usesOtherRecord = first && first.id !== 'sleep';
      turn = {
        reply: usesOtherRecord
          ? `${first.label} 기록을 보니 평소에는 ${first.baseText}, 최근 2주에는 ${first.recentText}로 나와요. 그중 기억나는 저녁 하나만 들려주세요.`
          : '샘플 기록을 보니 최근 2주는 잠든 시각이 평소보다 한 시간쯤 늦었어요. 그중 기억나는 저녁 하나만 들려주세요.',
        suggestedReply: '일을 마치고 밀린 드라마를 봤어요.',
        focus: usesOtherRecord ? first.id : 'onset',
      };
      break;
    }
    case 1:
      if (skip.test(replies[0])) {
        turn = { reply: '저녁 이야기는 넘어갈게요. 최근에 보낸 아침 중 떠오르는 순간이 있으면 들려주세요.', suggestedReply: '커피를 내리고 창문을 열었어요.', focus: 'none' };
        break;
      }
      turn = {
        reply: replies[0] === '일을 마치고 밀린 드라마를 봤어요.'
          ? '드라마를 본 저녁이었군요. 다음 날 아침은 어떻게 시작됐는지, 기억나는 만큼만 이어주세요.'
          : '그 저녁 다음으로 아침을 떠올려 봐요. 눈을 뜨고 처음 했던 일부터 편하게 들려주세요.',
        suggestedReply: '알람을 한 번 미루고 커피를 내렸어요.',
        focus: 'sleep',
      };
      break;
    case 2:
      turn = afternoon;
      break;
    case 3:
      if (skippedLunch) {
        turn = { ...anotherDay, reply: '그 장면은 넘어갈게요. 지난 2주 중 기억해 두고 싶은 다른 날이 있으면 그 이야기로 마칠게요.' };
      } else {
        const followUp = Object.hasOwn(afterLunch, lunchReply) ? afterLunch[lunchReply] : {
          reply: '그 오후에 하려던 일 중에 마무리한 일이나 뒤로 미룬 일이 떠오르면 들려주세요.',
          suggestedReply: '장보기는 내일로 미루고 저녁은 간단히 먹었어요.',
        };
        turn = { ...followUp, focus: 'none' };
      }
      break;
    case 4:
      turn = skippedLunch ? done : anotherDay;
      break;
    default:
      turn = done;
  }
  return { items: [], done: false, ...turn };
}
