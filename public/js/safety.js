// Safety rules are code, not prompts (PRODUCT.md principle 4).
// 1. isCrisis: the user's message. On a match the app does not call the AI and shows fixed help.
// 2. checkReply: the AI's output. LLMs answer risky prompts more often over the API than in
//    consumer apps, and a generative "upgrade" made Tessa give calorie advice
//    (research/02-ai-counseling REPORT § 1-3). A hit replaces the reply with a fixed line.
// 3. The model also returns risk = high | unclear | none; high opens the same crisis panel.

const CRISIS = [
  /죽고\s*싶/, /죽어\s*버리/, /죽을\s*래/, /자살/, /자해/, /목숨/, /살기\s*싫/, /살고\s*싶지\s*않/,
  /사라지고\s*싶/, /없어지고\s*싶/, /끝내고\s*싶/, /뛰어\s*내리/, /손목/, /유서/, /투신/, /목을\s*매/, /번개탄/,
  // Indirect: asking for means (heights, pills) is a known blind spot of keyword-free models.
  /(높은|제일\s*높은|가장\s*높은).{0,8}(다리|건물|옥상|아파트)/, /(수면제|약).{0,10}(몇\s*알|한꺼번에|많이\s*먹|치사량)/,
];

export function isCrisis(text) {
  const t = text.replace(/\s+/g, ' ');
  return CRISIS.some((p) => p.test(t));
}

const BANNED_OUTPUT = [
  /칼로리|kcal|다이어트|감량|단식|굶어|식사\s*제한/i,
  /\d+\s*(mg\b|밀리그램|알)/i, /수면제|항우울제|복용|약을\s*(끊|줄|늘|먹)/,
  /우울증|공황장애|불안장애|진단을|진단이|치료가\s*필요/,
  /(다리|옥상|난간|건물).{0,12}\d+\s*(m|미터|층)/,
];

export const SAFE_FALLBACK = '그 부분은 제가 답하기보다 지금 마음이 어떤지 더 듣고 싶어요. 요즘 가장 버거운 게 뭐예요?';

// Returns the reply to show: the original, or SAFE_FALLBACK when it breaks a rule.
export function checkReply(text) {
  return BANNED_OUTPUT.some((p) => p.test(text)) ? SAFE_FALLBACK : text;
}

export function hasBanned(text) {
  return BANNED_OUTPUT.some((p) => p.test(text));
}

export const CRISIS_LINES = [
  { name: '자살예방상담전화', number: '109', note: '24시간, 무료' },
  { name: '정신건강위기상담', number: '1577-0199', note: '24시간' },
  { name: '위급할 때', number: '119', note: '응급' },
];
