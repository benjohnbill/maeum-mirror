// Handle a personal safety disclosure locally. A statement about the past can be followed up without assuming present danger.
export function isCrisis(text) {
  return /죽고\s*싶|죽어\s*(?:버리고\s*싶|버릴)|죽을\s*(?:래|거|생각|계획)|자살|자해|목숨을?\s*끊|살기\s*싫|살고\s*싶지\s*않|사라지고\s*싶|없어지고\s*싶|삶을?\s*끝내고\s*싶|뛰어\s*내리|스스로를?\s*해치|자신을?\s*해칠|손목을?\s*그었|유서를?\s*(?:썼|쓰고)/u.test(text);
}

export function isImmediateDanger(text) {
  const action = /(?:지금|당장|곧)[^.!?\n]{0,14}(?:(?:자살|자해)(?:을|를)?\s*(?:하려고|할\s*(?:거|것\s*같)|할래)|(?:죽으|뛰어내리|목숨을?\s*끊으)려고\s*(?:해|요)|(?:죽을|나를\s*해칠|자신을\s*해칠|스스로를\s*해칠)\s*(?:거예요|거야|것\s*같))/u;
  const recentHarm = /(?:방금|지금|이미)[^.!?\n]{0,8}(?:자해했|자살을?\s*시도했|목숨을?\s*끊으려\s*했|손목을?\s*그었)/u;
  return action.test(text) || recentHarm.test(text);
}

export const CRISIS_LINES = [
  { name: '자살예방상담전화', number: '109', href: 'tel:+82109?oai_link_source=model_response_hotline' },
  { name: '응급 구조 요청', number: '119', href: 'tel:119' },
];
