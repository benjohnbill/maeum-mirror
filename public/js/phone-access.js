import { createCollector } from './parse.js';
import { computeSummary } from './metrics.js';

// Each approved type has its own fixture, so the browser never requests the others.
// `persona` picks one of the sample people in sample/personas.json; without it, the default sample.
export async function readPreviewHealth(types, persona) {
  if (!types.length) throw new Error('읽도록 허용한 기록이 없어요.');
  const data = createCollector().data;
  const files = await Promise.all(types.map(async (type) => {
    const response = await fetch(`sample/${persona ? persona + '/' : ''}read/${type}.json`);
    if (!response.ok) throw new Error('기록을 불러오지 못했어요.');
    return response.json();
  }));
  types.forEach((type, i) => {
    const values = files[i].values;
    if (type === 'steps') data.steps = new Map(values.map(([day, sources]) => [day, new Map(sources)]));
    else if (data[type] instanceof Map) data[type] = new Map(values);
    else data[type] = values;
  });
  return summaryFor(data, files[0].through);
}

// `through` defaults to the last day with records.
function summaryFor(data, through) {
  const summary = computeSummary(data, through);
  if (!summary?.metrics.length) throw new Error('비교할 수 있는 기록이 없어요.');
  // The rapport quiz reads the granted records directly, up to a year back.
  return Object.assign(summary, { data, through: through ?? summary.last });
}

export function setupPhoneAccess(onConnected) {
  const $ = (id) => document.getElementById(id);
  const health = $('healthSheet');
  const switches = [...health.querySelectorAll('input[name="healthType"]')];
  const viewport = $('phoneViewport');
  const overlay = $('personaOverlay');
  let granted = [];
  let persona = null;
  let loading = false;

  function fitSheet() {
    const rect = viewport.getBoundingClientRect();
    const top = rect.top + 5;
    health.style.left = rect.left + 'px';
    health.style.top = top + 'px';
    health.style.width = rect.width + 'px';
    health.style.height = (rect.bottom - top) + 'px';
  }
  new ResizeObserver(fitSheet).observe(viewport);
  window.addEventListener('resize', fitSheet);

  function reflectSelection() {
    const selected = switches.filter((input) => input.checked);
    $('toggleHealth').textContent = selected.length === switches.length ? '모두 끄기' : '모두 켜기';
    $('confirmHealth').disabled = !selected.length;
  }
  function requestHealth() {
    if (loading) return;
    for (const input of switches) input.checked = granted.includes(input.value);
    reflectSelection();
    fitSheet();
    health.showModal();
    $('accessTitle').focus();
  }
  function cancelHealth() {
    health.close();
    granted = [];
    $('requestHealth').hidden = true;
    $('retryHealth').hidden = true;
    $('connectStatus').textContent = '읽을 수 있는 건강 기록이 없어요.';
    $('restartHealth').hidden = false;
    $('connectTitle').focus();
  }
  async function readGranted() {
    if (loading || !granted.length) return;
    loading = true;
    $('requestHealth').hidden = true;
    $('retryHealth').hidden = true;
    $('connectStatus').textContent = '허용한 건강 기록을 불러오는 중이에요…';
    let summary;
    try {
      summary = await readPreviewHealth(granted, persona);
    } catch {
      $('connectStatus').textContent = '기록을 불러오지 못했어요. 다시 시도하거나 읽을 항목을 바꿔 주세요.';
      $('requestHealth').hidden = false;
      $('retryHealth').hidden = false;
      $('retryHealth').focus();
      return;
    } finally {
      loading = false;
    }
    $('connectStep').hidden = true;
    onConnected(summary, persona);
  }

  // MVP: no real records yet, so the granted categories come from a sample person the user picks.
  let personas;
  async function showPersonas() {
    try {
      personas ??= await fetch('sample/personas.json').then((response) => {
        if (!response.ok) throw new Error();
        return response.json();
      });
    } catch {
      $('connectStatus').textContent = '샘플 기록 목록을 불러오지 못했어요. 다시 연결해 주세요.';
      $('requestHealth').focus();
      return;
    }
    const legend = $('personaChoices').querySelector('legend');
    // Each marked phrase becomes its own span; CSS underlines them in order once the person is picked.
    const lineWithMarks = (line, marks = []) => {
      const span = document.createElement('span');
      let rest = line;
      marks.forEach((mark, i) => {
        const at = rest.indexOf(mark);
        if (at < 0) return;
        const key = Object.assign(document.createElement('span'), { className: 'persona-key', textContent: mark });
        key.style.setProperty('--i', i);
        span.append(rest.slice(0, at), key);
        rest = rest.slice(at + mark.length);
      });
      span.append(rest);
      return span;
    };
    $('personaChoices').replaceChildren(legend, ...personas.map(({ id, name, age, line, marks }) => {
      const label = document.createElement('label');
      const input = Object.assign(document.createElement('input'), { type: 'radio', name: 'persona', value: id, checked: id === persona });
      const title = Object.assign(document.createElement('strong'), { textContent: `${name} · ${age}세` });
      label.append(input, title, lineWithMarks(line, marks));
      return label;
    }));
    $('personaStart').disabled = !persona;
    $('connectStep').inert = true;
    overlay.hidden = false;
    $('personaTitle').focus();
  }
  function closePersonas() {
    overlay.hidden = true;
    $('connectStep').inert = false;
  }

  $('appleContinue').addEventListener('click', () => {
    $('signupStep').hidden = true;
    $('connectStep').hidden = false;
    $('connectTitle').focus();
  });
  $('requestHealth').addEventListener('click', requestHealth);
  $('cancelHealth').addEventListener('click', cancelHealth);
  health.addEventListener('cancel', (event) => { event.preventDefault(); cancelHealth(); });
  health.addEventListener('change', reflectSelection);
  $('toggleHealth').addEventListener('click', () => {
    const enable = switches.some((input) => !input.checked);
    for (const input of switches) input.checked = enable;
    reflectSelection();
  });
  $('confirmHealth').addEventListener('click', () => {
    granted = switches.filter((input) => input.checked).map((input) => input.value);
    if (!granted.length) return;
    health.close();
    showPersonas();
  });
  overlay.addEventListener('change', () => {
    persona = overlay.querySelector('input[name="persona"]:checked')?.value ?? null;
    $('personaStart').disabled = !persona;
  });
  $('personaStart').addEventListener('click', () => {
    if (!persona) return;
    closePersonas();
    readGranted();
  });
  overlay.addEventListener('keydown', (event) => {
    if (event.key !== 'Escape') return;
    closePersonas();
    $('requestHealth').focus();
  });
  $('retryHealth').addEventListener('click', readGranted);
}
