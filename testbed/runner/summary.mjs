// Computes the [데이터 요약] text from an export.xml the same way the browser does
// (public/js/parse.js + metrics.js are DOM-free).
import { readFileSync } from 'node:fs';
import { createCollector } from '../../public/js/parse.js';
import { computeSummary } from '../../public/js/metrics.js';

export function summaryFromXml(path) {
  const c = createCollector();
  c.feed(readFileSync(path, 'utf8'));
  const data = c.finish ? c.finish() : c.data;
  return computeSummary(data);
}
