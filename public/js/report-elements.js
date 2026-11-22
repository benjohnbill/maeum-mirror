export function el(tag, cls, text) {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text != null) e.textContent = text;
  return e;
}

function resultValue(value) {
  const line = el('span', 'result-value');
  if (value.prefix) line.append(el('span', '', value.prefix + ' '));
  line.append(el('strong', '', value.main));
  if (value.unit) line.append(el('b', '', value.unit));
  return line;
}

function appendInterpretation(container, description, scale) {
  if (description) container.append(el('p', 'card-interpretation', description));
  if (scale) {
    const { min, max, current, unit, caption } = scale;
    const rule = el('div', 'result-scale');
    rule.setAttribute('aria-hidden', 'true');
    rule.style.setProperty('--position', (current - min) / (max - min) * 100 + '%');
    rule.append(el('i'), el('span', '', min + unit), el('span', '', max + unit));
    container.append(rule, el('p', 'scale-caption', caption));
  }
}

export function resultCard({ label, value, description, scale, evidence }) {
  const card = el('section', 'result-card');
  const header = el('header', 'result-card-head');
  header.append(el('h3', '', label));
  card.append(header, resultValue(value));
  appendInterpretation(card, description, scale);
  if (evidence) {
    const details = resultDetails(evidence.label || '근거 보기');
    details.firstElementChild.setAttribute('aria-label', label + ' · ' + details.firstElementChild.textContent);
    details.append(...evidence.items);
    card.append(details);
  }
  return card;
}

export function renderProfileResult(card, { topic, label, value, meta, description, scale, evidence }, action) {
  const summary = el('summary', 'profile-result-summary');
  const svgNS = 'http://www.w3.org/2000/svg';
  const icon = document.createElementNS(svgNS, 'svg');
  icon.classList.add('profile-result-icon');
  icon.setAttribute('viewBox', '0 0 24 24');
  icon.setAttribute('aria-hidden', 'true');
  icon.setAttribute('focusable', 'false');
  const glyph = document.createElementNS(svgNS, 'use');
  glyph.setAttribute('href', 'assets/profile-icons.svg#' + topic);
  icon.append(glyph);
  const heading = el('span', 'profile-result-heading');
  const metric = el('span', 'profile-result-metric');
  if (meta) metric.append(el('span', 'profile-result-source', meta));
  metric.append(resultValue(value));
  heading.append(el('span', 'profile-result-label', label), metric);
  summary.append(icon, heading);
  const body = el('div', 'profile-result-body');
  appendInterpretation(body, description, scale);
  if (evidence) {
    const sources = resultDetails(evidence.label || '응답과 채점 근거');
    sources.append(...evidence.items);
    body.append(sources);
  }
  body.append(action);
  card.replaceChildren(summary, body);
}

export function resultDetails(label, text) {
  const details = el('details', 'source-row card-evidence');
  details.append(el('summary', '', label));
  if (text) details.append(el('p', '', text));
  return details;
}
