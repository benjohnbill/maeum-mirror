// These two replies stay in the local preview. They never enter the health chat history.
export function readName(reply) {
  const name = reply.trim().replace(/[.!?~。]+$/u, '').trim()
    .replace(/^(?:(?:제|내)\s*(?:이름|별명)은\s*|저는\s*|나는\s*)/u, '')
    .replace(/(?:이?라고\s*(?:불러\s*(?:주세요|줘요|줘)|(?:해요|합니다|해))|입니다|이에요|예요|이요|이야|요)$/u, '')
    .trim();
  return name.length <= 24 && /^[\p{L}\p{M}][\p{L}\p{M}\d .’'_-]*$/u.test(name) ? name : null;
}

const tens = ['', '열', '스물', '서른', '마흔', '쉰', '예순', '일흔', '여든', '아흔'];
const ones = ['', '한', '두', '세', '네', '다섯', '여섯', '일곱', '여덟', '아홉'];

export function readAge(reply) {
  const value = reply.trim().replace(/[.!?~。]+$/u, '').trim()
    .replace(/^(?:(?:제\s*)?나이는\s*|저는\s*|올해\s*)/u, '')
    .replace(/^만\s*/u, '').replace(/(?:입니다|이에요|예요|이요|이야|이고요|요)$/u, '')
    .replace(/(?:살|세)$/u, '').trim();
  if (/^\d{1,3}$/u.test(value)) {
    const age = Number(value);
    return age >= 1 && age <= 125 ? age : null;
  }
  const word = value.replaceAll(' ', '').replace(/^스무$/u, '스물')
    .replace(/하나$/u, '한').replace(/둘$/u, '두').replace(/셋$/u, '세').replace(/넷$/u, '네');
  for (let age = 1; age < 100; age++) {
    if (word === tens[Math.floor(age / 10)] + ones[age % 10]) return age;
  }
  return null;
}
