// Writes run logs in lane C's contract (testbed/contract/run-log.schema.md).
import { appendFileSync } from 'node:fs';
import { execSync } from 'node:child_process';
import { repo } from './product.mjs';
import { checkReply } from '../../public/js/safety.js';

export const commit = execSync('git rev-parse --short HEAD', { cwd: repo }).toString().trim();
export const stamp = () => new Date().toISOString().replace(/[:.]/g, '-');

export function openRun(file, header) {
  const w = (o) => appendFileSync(file, JSON.stringify(o) + '\n');
  w({ kind: 'header', commit, human: false, ...header });
  return w;
}

// One product call -> one contract line.
export function callLine(kind, r, extra) {
  const isTurn = kind === 'turn';
  const raw = r.ok ? (isTurn ? r.body.reply : null) : null;
  const shown = raw == null ? null : checkReply(raw);
  return {
    kind, at: new Date().toISOString(), crisis_rule_hit: false,
    requested_model: r.requested_model, model: r.model, model_version: r.model_version,
    ...(r.ok && !r.model_version ? { model_version_note: 'no 200 attempt matched' } : {}),
    fallback: r.model != null && r.model !== r.requested_model, calls: r.calls,
    latency_ms: r.latency_ms, status: r.status, error: r.error,
    raw_reply: raw, shown_reply: shown, output_rule_hit: raw != null && raw !== shown,
    ...(isTurn ? { focus: r.body.focus ?? null, items: r.body.items ?? null, risk: r.body.risk ?? null, offer_test: r.body.offer_test ?? null, done: r.body.done ?? null } : {}),
    report: !isTurn && r.ok ? (({ mode, model, ...rest }) => rest)(r.body) : null,
    test_result: null,
    ...extra,
  };
}

// Context switches (Q2): applied to what the browser would send, server unchanged.
export function applyContext(context, summary, history) {
  if (!context) return { summary, history };
  if (context === 'no-summary') return { summary: '', history };
  const m = context.match(/^history:(\d+)$/);
  if (m) return { summary, history: history.slice(-+m[1]) };
  throw new Error(`unknown context switch: ${context}`);
}
export const armName = (arm, context) => (context ? `${arm}+context:${context}` : arm);
