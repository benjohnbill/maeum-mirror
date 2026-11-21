// Test registry for the router. Add a test: write tests/<id>.js and list it here.
import phq9 from './phq9.js';

export const TESTS = [phq9];

export function scoreOf(test, answers) {
  const total = answers.reduce((s, v) => s + v, 0);
  const band = test.bands.find((b) => total >= b.min && total <= b.max);
  return { total, max: test.items.length * 3, band: band.label, safety: test.safetyItem != null && answers[test.safetyItem] >= 1 };
}
