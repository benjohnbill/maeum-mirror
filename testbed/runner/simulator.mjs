// User simulator: Claude Sonnet through `claude -p` (ADR 2026-11-22-A-claude-user-simulator).
import { execFile } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { PHQ8 } from '../../public/js/prompt.js';

export const PROMPT_VERSION = 'v1';
const TEMPLATE = readFileSync(new URL(`./simulator/prompt-${PROMPT_VERSION}.md`, import.meta.url), 'utf8');

export function simulatorPrompt(p) {
  const items = PHQ8.map((q) => `${q.id}. ${q.topic}: ${p.phq8_truth[q.id]}점, 털어놓기=${p.disclosure_gate[q.id]}`).join('\n');
  return TEMPLATE.replace('{{archetype}}', p.archetype).replace('{{surface_style}}', p.surface_style)
    .replace('{{behavior_tags}}', p.behavior_tags.join(', ') || '없음').replace('{{items}}', items);
}

function claude(system, input) {
  return new Promise((ok, fail) => {
    const child = execFile('claude', ['-p', '--model', 'sonnet', '--system-prompt', system, '--tools', '',
      '--strict-mcp-config', '--setting-sources', '', '--no-session-persistence', '--output-format', 'json'],
    { timeout: 120000, maxBuffer: 4e6, cwd: '/tmp' }, (err, stdout) => (err ? fail(err) : ok(JSON.parse(stdout))));
    child.stdin.end(input);
  });
}

// transcript: [{who: 'app'|'me', text}] as the user sees it (shown replies, test notes).
export async function simulate(persona, transcript, note = '') {
  const lines = transcript.map((t) => `${t.who === 'app' ? '앱' : '나'}: ${t.text}`).join('\n');
  const input = `지금까지 대화:\n${lines}\n${note ? `\n(상황: ${note})\n` : ''}\n다음 너의 답을 JSON으로.`;
  const out = await claude(simulatorPrompt(persona), input);
  const m = String(out.result).match(/\{[\s\S]*\}/);
  const j = m ? JSON.parse(m[0]) : { text: String(out.result).trim(), disclosed: [] };
  return { text: String(j.text || '').trim(), disclosed: (j.disclosed || []).map(Number), model: Object.keys(out.modelUsage || {})[0] ?? 'sonnet' };
}
