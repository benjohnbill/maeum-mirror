import { answerQuestions, runAssessment } from './assessment-sheet.js';
import { loadForm, scoreForm } from './screening-forms.js';
import { screeners } from './screening-router.js';

export function runScreening(id, previous = {}, { retake = false } = {}) {
  const title = screeners[id].topic + ' 선별검사 · ' + screeners[id].name;
  return runAssessment(title, async ({ ask, load }) => {
    const form = await load(signal => loadForm(id, signal));
    const items = retake ? form.items : form.items.filter(item => !Object.hasOwn(previous, item.id));
    const offset = form.items.length - items.length;
    const credit = [offset ? '이전 검사에서 답한 ' + offset + '문항을 포함해요.' : '',
      id === 'phq4' ? '한국어 GAD-7과 PHQ-9 양식에서 문항을 가져왔어요.' : '', items[0]?.attribution].filter(Boolean).join(' ');
    // Only PHQ-9 has a population rank, and its table covers adults (19+), so ask this first.
    const adult = id === 'phq9' ? (await ask({ position: '시작하기 전에', question: '만 19세 이상인가요?',
      options: [{ value: 1, label: '예' }, { value: 0, label: '아니요' }] })).value === 1 : undefined;
    const answers = await answerQuestions(ask, { items, initial: previous, period: form.recall, offset, credit });
    return adult === undefined ? scoreForm(form, answers) : { ...scoreForm(form, answers), adult };
  });
}
