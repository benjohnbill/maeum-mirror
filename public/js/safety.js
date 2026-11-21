// Crisis signals are handled by fixed code, never by the model.
// When one matches, the app does not call the AI and shows fixed help instead.
const PATTERNS = [
  /죽고\s*싶/, /죽어\s*버리/, /죽을\s*래/, /자살/, /자해/, /목숨/, /살기\s*싫/, /살고\s*싶지\s*않/,
  /사라지고\s*싶/, /없어지고\s*싶/, /끝내고\s*싶/, /뛰어\s*내리/, /손목/, /유서/,
];

export function isCrisis(text) {
  const t = text.replace(/\s+/g, ' ');
  return PATTERNS.some((p) => p.test(t));
}

export const CRISIS_LINES = [
  { name: '자살예방상담전화', number: '109', note: '24시간, 무료' },
  { name: '정신건강위기상담', number: '1577-0199', note: '24시간' },
  { name: '위급할 때', number: '119', note: '응급' },
];
