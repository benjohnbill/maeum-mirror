// Rollout: a whole conversation between the product and the Claude user simulator.
// The client turn order re-implements public/js/app.js (Q1 (a)); line refs are app.js.
// Run: node testbed/runner/rollout.mjs <persona dir>... [--n=2] [--arm=head|model:<id>] [--context=no-summary|history:N]
//      [--keys=0,0] (one worker per entry; head uses key0, the deploy path) [--budget=150]
import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';
import { startProduct, repo } from './product.mjs';
import { openRun, callLine, applyContext, armName, stamp } from './runlog.mjs';
import { summaryFromXml } from './summary.mjs';
import { simulate, PROMPT_VERSION } from './simulator.mjs';
import { isCrisis, checkReply } from '../../public/js/safety.js';
import { TESTS, scoreOf } from '../../public/spec/tests/index.js';

const args = process.argv.slice(2);
const opt = (k, d) => args.find((a) => a.startsWith(`--${k}=`))?.slice(k.length + 3) ?? d;
const dirs = args.filter((a) => !a.startsWith('--')).map((d) => resolve(d));
if (!dirs.length) { console.error('usage: rollout.mjs <persona dir>... [--n=2] [--arm=head] [--context=..] [--keys=0,0] [--budget=150]'); process.exit(1); }
const N = +opt('n', 2), ARM = opt('arm', 'head'), CONTEXT = opt('context', ''), BUDGET = +opt('budget', 150);
const KEYS = opt('keys', ARM === 'head' ? '0,0' : '1,2').split(',').map(Number);
const MAX_TURNS = 10; // app.js:8
let used = 0;

async function rollout(product, dir, rep) {
  const persona = JSON.parse(readFileSync(join(dir, 'persona.json'), 'utf8'));
  const summary = summaryFromXml(join(dir, persona.health?.export || 'export.xml')).text;
  const runId = `${persona.id}-${armName(ARM, CONTEXT).replace(/[^a-z0-9.-]+/gi, '_')}-${rep}-${stamp()}`;
  const w = openRun(`${repo}testbed/runs/rollout-${runId}.jsonl`, {
    run_id: runId, mode: 'rollout', persona_id: persona.id, arm: armName(ARM, CONTEXT), prefix_id: null,
    product: product.settings, simulator: { model: 'claude-sonnet (claude -p)', prompt_version: PROMPT_VERSION },
    call_budget: { key_pool: 'free', planned_calls: BUDGET, demo_reserve_calls: 0 },
  });
  const st = { history: [], turns: 0, offered: false, test: null, crisis: false };
  const transcript = []; // what the user sees
  let index = 0, calls = 0, turnLines = 0, leak = null, endedBy = null, simModel = null;
  let pendingUser = null, pendingTest = null;

  const send = async (kind) => {
    if (used >= BUDGET) throw Object.assign(new Error('budget'), { budget: true });
    const ctx = applyContext(CONTEXT, summary, st.history);
    const r = await product.call(kind, ctx.summary, ctx.history);
    used += r.calls; calls += r.calls;
    return r;
  };

  async function aiTurn() { // app.js:177-200
    const r = await send('turn');
    const line = callLine('turn', r, { turn_index: index++, user_text: pendingUser, test_result: pendingTest });
    pendingUser = null; pendingTest = null;
    w(line); turnLines++;
    if (!r.ok) { endedBy = 'error'; return 'stop'; }
    const reply = checkReply(r.body.reply);
    st.history.push({ role: 'model', text: reply });
    transcript.push({ who: 'app', text: reply });
    if (r.body.risk === 'high') st.crisis = true;
    let chips = false;
    if (r.body.offer_test && !r.body.done && !st.test && !st.offered) { st.offered = true; chips = true; }
    if (chips && persona.offer_test === 'accept') { // app.js:315-331 finishTest
      const t = TESTS[0];
      const answers = [...Array(8)].map((_, i) => persona.phq8_truth[i + 1]).concat(0);
      const res = scoreOf(t, answers);
      st.test = { test: t, ...res };
      st.history.push({ role: 'user', text: `[검사 결과] 사용자가 직접 ${t.name} 검사를 했어요. 총 ${res.total}/${res.max}점, ${res.band}. 문항별 답은 전달하지 않아요.` });
      transcript.push({ who: 'me', text: `(${t.name} 검사를 했다: ${res.total}점 / ${res.max}점 · ${res.band})` });
      pendingTest = { test: t.id, total: res.total, max: res.max, band: res.band };
      return aiTurn();
    }
    if (r.body.done || st.turns >= MAX_TURNS) { endedBy = r.body.done ? 'done' : 'max_turns'; return 'report'; }
    return chips ? 'chips' : 'next';
  }

  try {
    let state = await aiTurn(); // opener: history empty (app.js first api('turn'))
    let simLines = 0;
    while (state === 'next' || state === 'chips') {
      if (++simLines > 16) { endedBy = 'max_turns'; state = 'report'; break; }
      const note = state === 'chips' ? (persona.offer_test === 'decline' ? '앱이 짧은 검사 버튼을 보여줬지만 너는 하지 않기로 했다. 원하면 말로 거절해도 된다.' : '앱이 짧은 검사 버튼을 보여줬지만 너는 무시한다.') : '';
      const sim = await simulate(persona, transcript, note);
      simModel = sim.model;
      const never = sim.disclosed.filter((id) => persona.disclosure_gate[id] === 'never');
      if (never.length && !leak) leak = never[0];
      transcript.push({ who: 'me', text: sim.text });
      if (isCrisis(sim.text)) { // app.js:229-236: no model call
        st.history.push({ role: 'user', text: '(사용자가 매우 힘든 마음을 이야기했고, 앱이 위기 상담 번호를 안내했어요. 내용은 전달하지 않아요.)' });
        st.crisis = true;
        w({ kind: 'turn', turn_index: index++, at: new Date().toISOString(), user_text: sim.text, crisis_rule_hit: true, requested_model: product.settings.requested_model, model: null, model_version: null, fallback: false, calls: 0, latency_ms: 0, status: 0, error: null, raw_reply: null, shown_reply: null, output_rule_hit: false, focus: null, items: null, risk: null, offer_test: null, done: null, report: null, test_result: null, sim_disclosed: sim.disclosed });
        turnLines++;
        continue;
      }
      st.history.push({ role: 'user', text: sim.text });
      st.turns++;
      pendingUser = sim.text;
      state = await aiTurn();
    }
    if (state === 'report') { // app.js:354 report()
      const r = await send('report');
      w(callLine('report', r, { turn_index: index, user_text: null }));
      if (!r.ok) endedBy = 'error';
    }
  } catch (e) {
    endedBy = e.budget ? 'budget' : 'error';
    if (!e.budget) console.error(persona.id, e.message);
  }
  w({ kind: 'end', turns: turnLines, ended_by: endedBy || 'error', excluded: !!leak, exclude_reason: leak ? `withhold_leak:${leak}` : null, calls_used: calls, simulator_model: simModel });
  console.log(`${runId}: ${turnLines} turns, ${endedBy}, ${calls} calls${leak ? `, withhold_leak:${leak}` : ''}`);
}

const jobs = dirs.flatMap((d) => Array.from({ length: N }, (_, i) => [d, i]));
const attempts = `${repo}testbed/runs/attempts-${stamp()}`;
const workers = await Promise.all(KEYS.map((k, i) => startProduct({ arm: ARM, keyIndex: k, attemptsFile: `${attempts}-w${i}.jsonl` })));
let next = 0;
await Promise.all(workers.map(async (p) => { while (next < jobs.length && used < BUDGET) { const [d, i] = jobs[next++]; await rollout(p, d, i); } }));
workers.forEach((p) => p.stop());
console.log(`calls used: ${used}/${BUDGET}  attempts: ${attempts}-w*.jsonl`);
