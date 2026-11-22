import { resultDetails } from './report-elements.js';

const $ = id => document.getElementById(id);

// Closing the sheet also releases a pending answer, retry, or timed trial.
function waitForInput(signal, listen) {
  signal.throwIfAborted();
  return new Promise((resolve, reject) => {
    const abort = () => reject(signal.reason);
    signal.addEventListener('abort', abort, { once: true });
    listen(value => {
      signal.removeEventListener('abort', abort);
      resolve(value);
    });
  });
}

export async function runAssessment(title, run, { closeOnHide = false } = {}) {
  const sheet = $('screeningSheet');
  if (sheet.open) throw new Error('검사가 이미 열려 있어요.');
  const viewport = $('phoneViewport');
  const events = new AbortController();
  const { signal } = events;
  const previous = $('previousItem');
  const retry = $('retryScreening');
  const answers = $('screeningAnswers');
  function fit() {
    if (!viewport) return;
    const rect = viewport.getBoundingClientRect();
    sheet.style.left = (rect.left + 6) + 'px';
    sheet.style.width = (rect.width - 12) + 'px';
    sheet.style.bottom = (innerHeight - rect.bottom + 5) + 'px';
    sheet.style.maxHeight = (rect.height - 10) + 'px';
  }
  async function load(read) {
    while (!signal.aborted) {
      retry.hidden = true;
      $('screeningPosition').textContent = '문항을 불러오는 중이에요.';
      try { return await read(signal); }
      catch (error) {
        if (signal.aborted) throw error;
        $('screeningPosition').textContent = '문항을 불러오지 못했어요.';
        retry.hidden = false;
        retry.focus({ preventScroll: true });
        await waitForInput(signal, resolve => { retry.onclick = resolve; });
      }
    }
    signal.throwIfAborted();
  }
  async function ask({ position, instruction = '', question, options, selected, credit = '', canGoBack = false,
    pair = false, limitMs, feedback }) {
    signal.throwIfAborted();
    $('screeningPosition').textContent = position;
    $('screeningInstruction').textContent = instruction;
    $('screeningQuestion').textContent = question;
    $('screeningCredit').replaceChildren(credit);
    previous.disabled = !canGoBack;
    answers.replaceChildren();
    answers.classList.toggle('number-pair', pair);

    let timer;
    try {
      return await waitForInput(signal, resolve => {
        let locked = false;
        let started;
        function choose(value) {
          if (locked || !sheet.open) return;
          locked = true;
          clearTimeout(timer);
          const elapsed = performance.now() - started;
          if (limitMs != null && elapsed >= limitMs) value = null;
          previous.disabled = true;
          for (const button of answers.children) button.setAttribute('aria-pressed', String(value !== null && button.value === String(value)));
          if (feedback) $('screeningCredit').textContent = feedback(value);
          timer = setTimeout(() => resolve({ value, elapsed }), 250);
        }
        for (const { value, label } of options) {
          const button = document.createElement('button');
          button.type = 'button';
          button.value = String(value);
          button.textContent = label;
          button.setAttribute('aria-pressed', String(value === selected));
          button.onclick = () => choose(value);
          answers.append(button);
        }
        previous.onclick = () => { if (canGoBack && !locked) resolve({ back: true }); };
        if (pair) sheet.onkeydown = event => {
          if (event.repeat || !['ArrowLeft', 'ArrowRight'].includes(event.key)) return;
          event.preventDefault();
          choose(options[event.key === 'ArrowLeft' ? 0 : 1].value);
        };
        sheet.querySelector('.screening-body').scrollTop = 0;
        $('screeningQuestion').focus({ preventScroll: true });
        started = performance.now();
        if (limitMs != null) timer = setTimeout(() => choose(null), limitMs);
      });
    } finally {
      clearTimeout(timer);
      sheet.onkeydown = null;
      previous.onclick = null;
    }
  }
  $('screeningTitle').textContent = title;
  for (const id of ['screeningPosition', 'screeningInstruction', 'screeningQuestion', 'screeningCredit', 'screeningAnswers']) $(id).replaceChildren();
  previous.disabled = true;
  retry.hidden = true;
  const observer = viewport && new ResizeObserver(fit);
  fit();
  sheet.showModal();
  const closed = new Promise(resolve => sheet.addEventListener('close', () => {
    events.abort();
    resolve();
  }, { once: true }));
  try {
    observer?.observe(viewport);
    window.addEventListener('resize', fit, { signal });
    $('leaveScreening').onclick = () => sheet.close();
    if (closeOnHide) document.addEventListener('visibilitychange', () => {
      if (document.hidden && sheet.open) sheet.close();
    }, { signal });
    return await run({ ask, load });
  } catch (error) {
    if (!signal.aborted) throw error;
    return null;
  } finally {
    if (sheet.open) sheet.close();
    await closed;
    observer?.disconnect();
    retry.onclick = null;
  }
}

export async function answerQuestions(ask, { items, initial = {}, offset = 0, period, credit }) {
  const answers = { ...initial };
  const method = credit && resultDetails('측정 방법', typeof credit === 'string' ? credit : '');
  if (credit && typeof credit !== 'string') method.append(credit);
  let i = 0;
  while (i < items.length) {
    const item = items[i];
    const position = [period, (offset + i + 1) + ' / ' + (offset + items.length)].filter(Boolean).join(' · ');
    const response = await ask({ position, instruction: item.instruction, question: item.text, options: item.options,
      selected: answers[item.id], canGoBack: i > 0, credit: i === 0 ? method || '' : '' });
    if (response.back) i--;
    else { answers[item.id] = response.value; i++; }
  }
  return answers;
}
