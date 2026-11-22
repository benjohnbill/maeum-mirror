// Safety rules are code, not prompts (PRODUCT.md principle 4).
// isCrisis reads the user's message; checkReply and hasBanned read the AI's output.

// Phrases found by the testbed crisis set: methods and indirect asks for means.
const CRISIS_EXTRA = [
  /투신/, /목을\s*매/, /번개탄/,
  /(높은|제일\s*높은|가장\s*높은).{0,8}(다리|건물|옥상|아파트)/, /(수면제|약).{0,10}(몇\s*알|한꺼번에|많이\s*먹|치사량)/,
];

// Handle a personal safety disclosure locally. A statement about the past can be followed up without assuming present danger.
export function isCrisis(text) {
  return CRISIS_EXTRA.some((p) => p.test(text)) || /죽고\s*싶|죽어\s*(?:버리고\s*싶|버릴)|죽을\s*(?:래|거|생각|계획)|자살|자해|목숨을?\s*끊|살기\s*싫|살고\s*싶지\s*않|사라지고\s*싶|없어지고\s*싶|삶을?\s*끝내고\s*싶|뛰어\s*내리|스스로를?\s*해치|자신을?\s*해칠|손목을?\s*그었|유서를?\s*(?:썼|쓰고)/u.test(text);
}

export function isImmediateDanger(text) {
  const action = /(?:지금|당장|곧)[^.!?\n]{0,14}(?:(?:자살|자해)(?:을|를)?\s*(?:하려고|할\s*(?:거|것\s*같)|할래)|(?:죽으|뛰어내리|목숨을?\s*끊으)려고\s*(?:해|요)|(?:죽을|나를\s*해칠|자신을\s*해칠|스스로를\s*해칠)\s*(?:거예요|거야|것\s*같))/u;
  const recentHarm = /(?:방금|지금|이미)[^.!?\n]{0,8}(?:자해했|자살을?\s*시도했|목숨을?\s*끊으려\s*했|손목을?\s*그었)/u;
  return action.test(text) || recentHarm.test(text);
}

export const CRISIS_LINES = [
  { name: '자살예방상담전화', number: '109', href: 'tel:109' },
  { name: '응급 구조 요청', number: '119', href: 'tel:119' },
];

// AI output that must never reach the user: diet and dosage advice, diagnosis words, heights of places.
const BANNED_OUTPUT = [
  /칼로리|kcal|다이어트|감량|단식|굶어|식사\s*제한/i,
  /\d+\s*(mg\b|밀리그램|알)/i, /수면제|항우울제|복용|약을\s*(끊|줄|늘|먹)/,
  /우울증|공황장애|불안장애|진단을|진단이|치료가\s*필요/,
  /(다리|옥상|난간|건물).{0,12}\d+\s*(m|미터|층)/,
];

export const SAFE_FALLBACK = '그 부분은 제가 답하기보다 지금 마음이 어떠신지 더 듣고 싶어요. 요즘 가장 버거운 게 무엇인가요?';

export function hasBanned(text) {
  return BANNED_OUTPUT.some((p) => p.test(text));
}

// Returns the reply to show: the original, or SAFE_FALLBACK when it breaks a rule.
export function checkReply(text) {
  return hasBanned(text) ? SAFE_FALLBACK : text;
}
