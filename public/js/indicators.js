// One row per profile card. This registry is the single source for the card order,
// the tests a card can open, the conversation cues the AI may cite, and signal checks.
//
// Signal contract (shared by the AI, the scripted reason choices, and the ledger):
//   { indicator: <indicators[].id>, item: <cue id>, delta: ±1..15, quote: <exact text from the user's reply> }
//   delta > 0 moves toward `high`, delta < 0 toward `low`.
//   1~5 passing mention · 6~9 one concrete scene · 10~15 confirmed by a follow-up or repeated.
//   One reply moves at most MAX_SIGNALS_PER_REPLY indicators.
//
// Cue ids are test item ids (e.g. 'phq9.1'). The cue text itself lives in the test file
// (public/tests/<test>.json → items[].cue), so the item and its cue never drift apart.
// Everyday cards have no licensed test; their cues are the app's own questions.

export const MAX_SIGNALS_PER_REPLY = 3;

// test: the form that measures this card. subscore: which subscore of that form (multi-trait forms).
// alt: other forms that also fill this card (shorter or combined forms).
export const indicators = [
  // 성격 (TIPI: one 10-item form, five cards)
  { id: 'extraversion', group: '성격', title: '외향성', test: 'tipi', subscore: 'extraversion', high: '사람들 속에서 활기를 얻는 편', low: '조용히 혼자 있는 편' },
  { id: 'agreeableness', group: '성격', title: '친화성', test: 'tipi', subscore: 'agreeableness', high: '남을 너그럽게 대하는 편', low: '비판적으로 따지는 편' },
  { id: 'conscientiousness', group: '성격', title: '성실성', test: 'tipi', subscore: 'conscientiousness', high: '계획대로 해내는 편', low: '즉흥적이고 느슨한 편' },
  { id: 'stability', group: '성격', title: '정서 안정성', test: 'tipi', subscore: 'stability', high: '차분하고 흔들림이 적은 편', low: '쉽게 불안해지고 흔들리는 편' },
  { id: 'openness', group: '성격', title: '개방성', test: 'tipi', subscore: 'openness', high: '새로운 경험을 즐기는 편', low: '익숙한 방식을 좋아하는 편' },

  // 마음 건강
  { id: 'wellbeing', group: '마음 건강', title: '정서적 안녕감', test: 'who5', high: '최근 활기차고 편안했던 편', low: '최근 활기와 편안함이 줄어든 편' },
  { id: 'lifesat', group: '마음 건강', title: '삶의 만족도', test: 'swls', high: '지금 삶에 만족하는 편', low: '지금 삶이 기대와 멀다고 느끼는 편' },
  { id: 'esteem', group: '마음 건강', title: '자존감', test: 'rses', high: '스스로를 괜찮게 여기는 편', low: '스스로를 낮게 평가하는 편' },
  { id: 'flourishing', group: '마음 건강', title: '마음의 번영도', test: 'fs', high: '관계와 일에서 의미를 느끼는 편', low: '관계와 일에서 의미를 덜 느끼는 편' },
  { id: 'affect', group: '마음 건강', title: '요즘 내 감정 날씨', test: 'spane', subscore: 'balance', high: '좋은 감정이 더 많았던 편', low: '힘든 감정이 더 많았던 편' },
  { id: 'meaning', group: '마음 건강', title: '삶의 의미', test: 'mlq', subscore: 'presence', high: '삶의 의미를 느끼는 편', low: '삶의 의미를 찾는 중인 편' },
  { id: 'resilience', group: '마음 건강', title: '회복탄력성', test: 'brs', everyday: 'resilience', high: '힘든 일 뒤 금방 일상으로 돌아오는 편', low: '힘든 일 뒤 회복에 시간이 걸리는 편' },

  // 일과 생활
  { id: 'burnout', group: '일과 생활', title: '번아웃', test: 'cbi', high: '지치고 소진된 느낌이 큰 편', low: '기운이 남아 있는 편' },
  { id: 'phone', group: '일과 생활', title: '스마트폰 과의존', test: 'sassv', high: '스마트폰을 놓기 어려운 편', low: '스마트폰 사용을 조절하는 편' },
  { id: 'alcohol', group: '일과 생활', title: '음주 습관', test: 'auditc', high: '술을 자주, 많이 마시는 편', low: '술을 적게 마시는 편' },

  // 일상 카드 (상민 브랜치의 대화·과제 카드)
  { id: 'delay', group: '일상', title: '실행 미루기', everyday: 'delay', high: '해야 할 일을 자주 미루는 편', low: '바로 시작하는 편' },
  { id: 'social', group: '일상', title: '눈치', everyday: 'social', high: '애매한 반응을 거절로 받아들이기 쉬운 편', low: '반응을 너그럽게 해석하는 편' },
  { id: 'rumination', group: '일상', title: '화난 일 곱씹기', everyday: 'rumination', high: '화났던 일을 오래 곱씹는 편', low: '금방 털어내는 편' },
  { id: 'recognition', group: '일상', title: '인정받고 싶은 마음', everyday: 'recognition', high: '다른 사람의 인정이 중요한 편', low: '스스로의 기준이 중요한 편' },
  { id: 'recovery', group: '일상', title: '회복 방식', everyday: 'recovery', high: '쉬고 나면 긴장이 잘 풀리는 편', low: '쉬어도 긴장이 남는 편' },
  { id: 'pressure', group: '일상', title: '시간 압박 속 수행', everyday: 'pressure', high: '촉박해도 집중을 유지하는 편', low: '촉박하면 흔들리는 편' },

  // 기분과 불안 (무거운 지표는 뒤쪽)
  { id: 'mood', group: '기분과 불안', title: '우울', test: 'phq9', alt: ['phq2', 'phq4'], high: '기분 저하와 흥미 저하가 두드러지는 편', low: '기분과 흥미가 유지되는 편' },
  { id: 'worry', group: '기분과 불안', title: '불안', test: 'gad7', alt: ['gad2', 'phq4'], high: '걱정이 일상을 자주 방해하는 편', low: '걱정이 일상을 크게 방해하지 않는 편' },
  { id: 'ptsd', group: '기분과 불안', title: '외상 후 스트레스', test: 'pcptsd5', high: '힘든 사건의 영향이 남아 있는 편', low: '힘든 사건의 영향이 적은 편' },
];

export const indicatorById = new Map(indicators.map((row) => [row.id, row]));
