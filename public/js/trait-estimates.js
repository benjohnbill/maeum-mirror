// The ordinal axes describe what rank 1 means. Each observation belongs to one user reply.
export const traitAxes = {
  mood: '기분 저하와 흥미 저하가 두드러지는 순',
  resilience: '부담이 끝난 뒤 평소 생활로 돌아오기 수월한 순',
  worry: '걱정이 일상을 자주 방해하는 순',
  delay: '해야 할 일을 시작하기까지 자주 미루는 순',
  social: '애매한 반응을 거절로 받아들이기 쉬운 순',
  rumination: '화났던 일을 오래 곱씹는 순',
  recognition: '다른 사람의 인정이 중요한 순',
  recovery: '쉰 뒤 마음의 긴장이 잘 풀리는 순',
  pressure: '시간이 촉박할 때 집중을 유지하는 순',
};

// Labelled Korean examples for the offline nearest-neighbour text classifier.
// Compare both directions of each topic, with neutral examples as counterexamples.
const training = {
  mood: [
    ['좋아하던 일에도 흥미가 잘 안 생겨요', '요즘은 좋아하던 모임도 즐겁지 않았어요', '자주 기분이 가라앉아요', '요즘 거의 매일 우울해요', '뭘 해도 재미가 없어요', '평소 좋아하던 일도 손이 안 가요'],
    ['평소 좋아하는 일은 여전히 재미있었어요', '다음 주에 뛸 생각에 기대됐어요', '주말 모임이 즐거웠어요', '요즘 기분은 대체로 괜찮아요', '우울하지 않아요'],
  ],
  resilience: [
    ['마감 다음 날 평소처럼 일상을 보냈어요', '다음 날엔 평소처럼 아침을 챙기고 출근했어요', '마감 뒤 하루면 평소 리듬을 되찾아요', '다음 날엔 밀린 책을 다시 읽을 여유도 생겼어요', '힘든 일이 끝나면 금방 다시 일상으로 돌아와요'],
    ['일이 끝나도 평소 생활로 돌아오는 데 며칠 걸려요', '주말이 돼서야 장을 보고 평소처럼 밥을 해 먹었어요', '사나흘은 진이 빠졌고 주말이 돼야 장도 보고 싶어졌어요', '마감이 끝난 뒤에도 며칠은 평소처럼 지내기 어려웠어요'],
  ],
  worry: [
    ['답을 기다리는 일이 없는 날에도 다른 걱정거리가 또 떠올랐어요', '닫으면 또 생각나서 친구가 하던 말을 놓쳤어요', '걱정이 멈추지 않아 하던 일을 못했어요', '매일 걱정이 떠올라 집중하기 어려워요', '불안해서 일을 계속 멈췄어요'],
    ['다른 날엔 퇴근하고 나면 그 생각을 별로 안 했어요', '걱정이 들어도 하던 일로 돌아갈 수 있었어요', '걱정을 적어 두고 친구랑 하던 이야기를 마저 했어요', '걱정 때문에 일을 멈춘 날은 없었어요', '요즘 불안하지 않아요'],
  ],
  delay: [
    ['하기로 한 일을 계속 내일로 미뤄요', '시간이 있는데도 시작을 미뤄요', '마감 직전까지 손을 못 댔어요', '자꾸 딴짓하다가 마지막 날에 시작해요', '해야 하는데 미루고 있어요', '늘 늦게 시작해요', '해야 할 일을 자꾸 미뤄요'],
    ['할 일이 생기면 바로 시작해요', '미루지 않고 바로 착수했어요', '마감 전에 미리 해둬요', '일단 파일부터 열고 조금씩 시작했어요', '시작을 미룬 적은 거의 없어요', '미루는 편은 아니에요', '해야 할 일을 미루지 않아요'],
  ],
  social: [
    ['답장이 짧으면 내가 뭔가 잘못했나 싶어요', '차가운 말투를 보면 나를 싫어하는 것 같아요', '답이 없으면 거절당한 것 같아요', '무뚝뚝한 표정이 내 탓처럼 느껴져요', '짧은 답장을 보고 나를 피하나 생각했어요'],
    ['답장이 짧아도 그냥 바쁜가 보다 해요', '말투만으로 나를 싫어한다고 생각하지 않아요', '무뚝뚝해도 거절로 받아들이지 않아요', '답이 없어도 다른 사정이 있겠지 해요', '짧은 답장은 일단 판단을 보류해요'],
  ],
  rumination: [
    ['화났던 일이 며칠 내내 떠올라요', '기분 나빴던 말을 계속 곱씹어요', '서운한 말을 밤마다 되새겼어요', '이미 끝난 일인데도 생각하면 또 화가 나요', '속상했던 대화를 여러 번 되짚었어요', '화난 일을 자꾸 곱씹어요'],
    ['화가 나도 지나간 일은 금방 잊어요', '기분 나쁜 말은 그날로 털어내요', '서운했던 말을 다시 곱씹지 않아요', '화났던 일을 계속 떠올리지는 않아요', '속상한 대화는 금방 잊었어요'],
  ],
  recognition: [
    ['다른 사람이 알아봐 주는 게 정말 중요해요', '칭찬받지 못하면 내가 잘한 건지 모르겠어요', '인정받고 싶어서 결과를 자꾸 확인해요', '내가 한 일을 인정해 줘야 마음이 놓여요', '칭찬이 없으면 힘이 빠져요', '남들의 인정이 필요해요'],
    ['칭찬이 없어도 스스로 만족하면 충분해요', '남이 인정해 주는 건 별로 중요하지 않아요', '아무도 몰라줘도 내가 잘했다고 생각해요', '다른 사람의 평가보다 내 기준이 중요해요', '인정을 못 받아도 괜찮아요'],
  ],
  recovery: [
    ['친구랑 얘기하고 나니 긴장이 풀렸어요', '산책하고 나니까 마음이 편안해졌어요', '잠깐 쉬면 다시 여유가 생겨요', '하루 자고 나면 마음이 한결 가벼웠어요', '쉬고 나서 긴장이 내려갔어요', '걷고 나니 마음이 풀렸어요'],
    ['쉬어도 긴장이 좀처럼 풀리지 않아요', '산책한 뒤에도 마음이 무거웠어요', '친구와 얘기해도 긴장은 그대로였어요', '푹 자도 마음이 가벼워지지 않았어요', '쉬었는데도 며칠째 진이 빠졌어요', '퇴근해도 긴장이 남아 있어요'],
  ],
  pressure: [
    ['시간이 촉박하면 오히려 집중이 잘돼요', '마감 직전에도 침착하게 순서대로 해요', '급할수록 정신이 또렷해져요', '시간에 쫓겨도 실수가 늘지 않아요', '급한 상황에서도 차분하게 처리해요'],
    ['시간이 촉박하면 머리가 하얘져요', '마감이 닥치면 당황해서 실수가 늘어요', '시간에 쫓기면 집중하기 어려워요', '급하면 아는 것도 틀려요', '시간이 부족해지자 확인을 자꾸 놓쳤어요'],
  ],
};
const neutral = ['잘 모르겠어요', '그런 편인지 궁금해요', '운동을 쉬었어요', '친구가 뛰자고 했어요', '가족 일정이 있어서 약속을 옮겼어요', '오늘은 시간이 없었어요', '점심을 먹었어요', '메일을 확인했어요', '그냥 평소와 같아요', '잠깐 생각이 났어요', '걱정이 다시 떠올랐어요', '친구와 이야기를 했어요', '아직 결과를 기다리고 있어요', '그날은 별로 나가고 싶지 않았어요', '원래 제가 먼저 가자고 하는데', '지난달 마감 뒤에도 시간은 있었어요'];
const anchors = {
  mood: /기분|흥미|재미|즐거|즐겁|좋아하|우울|기대됐/u,
  resilience: /평소|리듬|일상|다음 날|사나흘|주말이 돼|마감 뒤/u,
  worry: /걱정|불안|그 생각|또 생각나/u,
  delay: /미루|미뤄|미룬|미룰|미뤘|시작|마감 직전|손을 (?:못 |안 )?대|미리|착수|내일로/u,
  social: /반응|답장|답이|말투|표정|무뚝뚝|거절|싫어|피하|내 탓/u,
  rumination: /곱씹|되새|되짚|울화|서운|속상|분했|기분 나|화가|화났|화난|화나/u,
  recognition: /인정|칭찬|알아봐|평가|몰라줘|내 기준|스스로 만족/u,
  recovery: /긴장|여유|가벼|풀렸|풀려|풀리|편안|회복|진이 빠|마음이 무거/u,
  pressure: /촉박|마감|급하|급한|급할|쫓[겨기]|시간이 부족|실수/u,
};

function features(text) {
  const words = text.toLowerCase().normalize('NFC').match(/[가-힣a-z0-9]+/gu) || [];
  const grams = new Set();
  for (const word of words) {
    grams.add(word);
    for (const n of [2, 3]) {
      for (let i = 0; i + n <= word.length; i++) grams.add(word.slice(i, i + n));
    }
  }
  return grams;
}
const documents = neutral.map(text => ({ features: features(text), label: '' }));
for (const [id, groups] of Object.entries(training)) {
  groups.forEach((phrases, i) => phrases.forEach(text => documents.push({
    features: features(text), label: id, sign: i === 0 ? 1 : -1,
  })));
}
const frequencies = new Map();
for (const doc of documents) {
  for (const feature of doc.features) frequencies.set(feature, (frequencies.get(feature) || 0) + 1);
}
const weights = new Map([...frequencies].map(([f, count]) => [f, (1 + Math.log(documents.length / count)) ** 2]));
function norm(grams) {
  let total = 0;
  for (const f of grams) total += weights.get(f) || 0;
  return Math.sqrt(total);
}
for (const doc of documents) doc.norm = norm(doc.features);

function classifyClause(quote) {
  const grams = features(quote);
  const size = norm(grams);
  if (!size) return null;
  const candidates = documents.map(doc => {
    let common = 0;
    for (const f of grams) if (doc.features.has(f)) common += weights.get(f);
    return { doc, similarity: common / (size * doc.norm) };
  }).sort((a, b) => b.similarity - a.similarity);
  const { doc, similarity } = candidates[0];
  const opposite = candidates.find(c => c.doc.label !== doc.label || c.doc.sign !== doc.sign);
  if (!doc.label || !anchors[doc.label].test(quote) || similarity < .34 || similarity - opposite.similarity < .10) return null;
  // An unrepresented negation can reverse the entire statement. Abstain on it.
  const negated = /않|못|없|아니|안\s/u.test(quote);
  if (negated && ![...doc.features].some(f => /않|못|없|아니|^안$/u.test(f))) return null;
  const repeated = /자꾸|계속|자주|매번|언제나|늘|마다|며칠|내내|반복/u.test(quote);
  const delta = doc.sign * Math.round((repeated ? 14 : 9) * Math.min(1, similarity));
  return { topic: doc.label, delta, quote };
}

export function localTraitSignals(reply) {
  const found = new Map();
  for (const sentence of reply.match(/[^.!?。\n]+[.!?。]?/gu) || []) {
    if (sentence.endsWith('?') || /건너뛰|모르겠|기억이 안|궁금|(?:친구|동료|동생|언니|형|누나|엄마|아빠|그 사람|상대방)(?:이|가|는|도)\s|라고 (?:했|말했)|라면 어떨|한다면/u.test(sentence)) continue;
    for (const part of sentence.split(/,|지만\s+(?=요즘|지금|이제)/u)) {
      const quote = part.trim().replace(/[.!。]$/u, '');
      if (quote.length < 5) continue;
      const signal = classifyClause(quote);
      if (signal && (!found.has(signal.topic) || Math.abs(signal.delta) >= Math.abs(found.get(signal.topic).delta))) {
        found.set(signal.topic, signal);
      }
    }
  }
  return [...found.values()];
}

export function groundedSignals(text, signals) {
  const accepted = new Map();
  if (!Array.isArray(signals)) return [];
  for (const signal of signals) {
    if (!signal || !Object.hasOwn(traitAxes, signal.topic) || accepted.has(signal.topic)) continue;
    if (!Number.isInteger(signal.delta) || !signal.delta || Math.abs(signal.delta) > 15 || typeof signal.quote !== 'string') continue;
    const quote = signal.quote.trim();
    if (quote.length >= 3 && text.includes(quote)) accepted.set(signal.topic, { topic: signal.topic, delta: signal.delta, quote });
  }
  return [...accepted.values()];
}

export function newEstimates() {
  return { replies: [], last: null };
}

export function recordTraitReply(ledger, text, correction = false) {
  const entry = { text, correction, source: '기기 내 문장 분류', signals: localTraitSignals(text) };
  ledger.replies.push(entry);
  ledger.last = entry;
  return entry;
}

export function estimateFor(ledger, topic) {
  let score = 50;
  let evidence = [];
  const seen = new Set();
  for (const entry of ledger.replies) {
    const signal = entry.signals.find(s => s.topic === topic);
    if (!signal) continue;
    if (entry.correction) { score = 50; evidence = []; seen.clear(); }
    const key = signal.quote.replace(/[\s.!?]+/gu, '');
    if (seen.has(key)) continue;
    seen.add(key);
    score = Math.min(100, Math.max(0, score + signal.delta));
    evidence.push({ ...signal, source: entry.source, correction: entry.correction });
  }
  return { rank: Math.max(1, 100 - score), score, evidence };
}
