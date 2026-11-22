# Lane A: Runner — start prompt

Read first: `docs/handoff/lanes/README.md`, then `~/.claude/plans/maeum-testbed-split/FINAL.md`
(all of it), `rounds/01-judgment.md` J2, J3, J9, J10, J21, J23, then `server.mjs`,
`public/js/app.js`, `public/js/safety.js`, `public/js/prompt.js`.

## Role
You build and run the headless experiment runner in `testbed/runner/`, logs in `testbed/runs/`.
You execute; lane C judges. Do not change `server.mjs` or `public/` behaviour.

## Start now (no wait)
1. Quota probe: a few calls per free key, measure latency, timeouts, 429s. Set a call
   budget that keeps the paid key untouched (demo reserve).
2. Minimal replay script first: one frozen conversation prefix + one call per sample,
   pinned model (`GEMINI_FALLBACK` = the same model gives a one-model chain, `server.mjs:25`).
   Log `model` per turn; drop fallback turns from model-arm samples.
3. Raw logging now; switch to `testbed/contract/run-log.schema.md` when lane C freezes it.

## Agenda for `/grill-with-docs` (design decisions, one at a time)
1. How to reuse the client turn logic (`isCrisis`, `checkReply`, `[검사 결과]` lines,
   test router) without a browser: import `safety.js`, extract or re-implement the rest?
2. Context switches: history cap, explicit PHQ-state line, summary order, summary withheld.
3. User simulator: model different from the product model, versioned prompt, `withhold`
   leak = excluded run.
4. Concurrency set by quota, not by sessions.

## Output by 11-23 morning
Runner + replay script working on lane B's 4 pilot personas; logs that lane C can score.
Check once that `shown_reply` matches a browser run (Aside) for the same input.
