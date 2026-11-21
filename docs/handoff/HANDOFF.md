# HANDOFF: 마음 시간표 (KORCHAM AI 해커톤 2026)

Written 2026-11-22 ~02:20 KST. The user is 오라버니 (see global CLAUDE.md voice rules).

## Next session focus (user said)

The user will paste the product plan, explanation, and research targets again as context.
Your first job: read that context, compare it with what is already built and decided (below),
and list the differences. Do not rebuild before you know what changed.

## Hard deadline

**Preliminary submission closes 2026-11-23 (Mon) 17:00 KST.** Edits are allowed until then.
After the deadline, only access/credential/runtime fixes are allowed; no feature, prompt, or data changes.
The prototype must keep working until 11-30 (and until 12-07 if it reaches the finals).

Required deliverables (not started yet):
1. Prototype URL that judges can open. **Not deployed.** Deploying is Tier 3: propose, do not do it without the user's yes. Recommended: Render or Railway, Node server as is.
2. 프로젝트 소개서 PDF, at most 10 body pages, on the official template (`15gESC...txt` below).
3. AI 활용내역, at most 3,000 chars, typed into the submission form: what AI did vs what the team did.
4. Email the same files to the organizer address before the deadline (address and filename format: `10w_EV3...txt`).
Optional: demo video (max 3 min), source repo link.

Rule sources, already downloaded (PDF as .bin + extracted .txt):
- `/tmp/maeum-handoff/hackathon-docs/10w_EV3uv6lMtKyJMqNdANWlW3acgEssM.txt`: 대회 안내문 (schedule, judging, prizes)
- `/tmp/maeum-handoff/hackathon-docs/1PPCIMds1RBXces430OeGF2D7mQWkrdyj.txt`: AI 활용 및 출처 표기 기준
- `/tmp/maeum-handoff/hackathon-docs/15gESCgdavnFcTF9xTV_3R2nZyhGbgC-P.txt`: 프로젝트 소개서 작성 안내
- `/tmp/maeum-handoff/hackathon-docs/a4.txt`: 참가자 동의 안내
- Page: https://korcham-careerfair.com/hackathon. It renders only with JS. Use Aside, not WebFetch.

Rules that shape the product:
- **Never send real personal or sensitive data to an external AI API, even with consent.** Demos use the synthetic user only.
- Preliminary scoring: AI 활용 적절성 25 (incl. "AI 결과의 오류·불확실성 한계와 대응" 5) + 프로토타입 구현 20 + 문제 정의 20 + 창의성 20 + 확장성 15. The finals are scored fresh (preliminary score is not carried over).
- "단순 래핑" is judged by the judges. The team must be able to explain its design and verification.

## Product state

Repo: `~/dev/maeum-mirror` (local git only, no remote). Read these first, do not re-derive:
- `PRODUCT.md`: users, purpose, positioning, constraints, principles
- `.impeccable/surfaces/public-index-html.md`: visual direction contract (timetable world)
- `README.md`: run instructions and module map
- `git log`: 6 commits, `af76274` to `41b47fc`

Run it:
```bash
kill $(lsof -t -i:8787) 2>/dev/null; cd ~/dev/maeum-mirror && npm start   # http://localhost:8787
```
`.env` holds `GEMINI_API_KEY`, `GEMINI_API_KEY_1`, `GEMINI_API_KEY_2` (user-provided, never print them).

### Decisions settled with the user (grilling, 2026-11-22)

- Framing: a self-understanding mirror, not a diagnosis. No DSM-5 text. PHQ-8 topics are woven into the conversation; item 9 (self-harm) is never asked by the AI.
- Entry hook: "know yourself" (MBTI-like curiosity). Low-mood detection sits underneath.
- **One-time use.** No accounts, no memory between visits. Continuity comes from years of data in a single export. The cross-visit memory design (profile + session notes) was proposed and then **dropped** by the user.
- Input: Apple Health `export.zip` or `export.xml`, parsed in the browser only. Only summary lines + conversation text + the fixed prompt reach the AI. The "AI에게 가는 내용" panel shows exactly that.
- Metrics: sleep duration, sleep-onset time and its regularity, steps, resting HR, HRV, workouts. Baseline = the user's own days 15–90 back vs. the last 14 days.
- Crisis signals: fixed regex rule in `public/js/safety.js`, no model call, shows 109 / 1577-0199 / 119.
- Visual direction: "시간표 리듬" (university-timetable grid, untinted off-white + ink, one vermilion). The user picked it.
- Stack: static HTML/JS + one Node server (`server.mjs`) that hides the key.

### Open items

1. **Share card content.** The user was unsure whether "light content only" is right. They deferred it until they had looked at the demo. Ask them.
2. **Prompt tone** (`public/js/prompt.js`), seen in a real run: too formal ("혹시 ~으신가요?" almost every turn), the opener sometimes starts from a minor metric (workouts) instead of the biggest change, and `card_line` comes out preachy. Recommended fix before the deadline. Not done yet.
3. **Model and latency.** The user chose `gemini-3.5-flash` as the default "for the demo" to judge the timing themselves. Measured: 11.7 to 30 s per reply, and about 1 in 3 calls time out at 45 s. Fallback chain: 3.5-flash → 2.5-flash-lite (~1 s) → 2.5-flash. `gemini-2.5-flash` is now unusable: key0 quota is exhausted (429), and KEY_1 and KEY_2 return 404 "no longer available to new users". Worst case is about 46 s for one turn. Recommended: `GEMINI_TIMEOUT_MS=20000` if the user finds this too slow. The user has not decided yet.
4. **The user's running server may be on old code.** It was started before the last 4 commits. They must restart it to get key rotation and the 45 s timeout.
5. impeccable finish review + DESIGN.md are not done. The direction contract's FINISH line is undischarged. This was deferred on purpose so that features come first.
6. Paper citations in `prompt.js` (Lyall 2018, Rykov 2021, Moshe 2021, Saeb 2015, Kroenke 2001/2009) come from model memory. **Verify them** before they appear in the 소개서.

## Verification already done

- Headless Chromium (playwright-core in the old session's scratchpad, now gone; reinstall with `npm i playwright-core@1.56.1` in a scratch dir, browser at `~/.cache/ms-playwright/chromium-1248/chrome-linux64/chrome`). The full flow ran at 1440px and 390px with 0 console errors. The crisis path was also checked.
- A real Gemini run on the synthetic user finished in 7 turns: 6 of 8 PHQ topics covered, and the report rendered.
- The impeccable detector reported 0 findings after fixes.
- Pitfall: `pkill -f "node server.mjs"` kills your own shell (the pattern matches its command line). Use `kill $(lsof -t -i:PORT)`.

## Suggested skills

- `grilling`: when the user pastes the new plan or research context, run a diff-focused round on whatever conflicts with the decisions above.
- `research`: to verify the paper citations and gather the research targets the user names, from primary sources.
- `impeccable` (`polish`, or the finish review): after the features settle, before the deadline.
- `aside-browser`: only if the hackathon page or the submission form must be read again.
- `pr` is not needed. There is no remote.

## Closing-block contract

Every reply ends with the two-line `› 한 일` / `› 다음` block (rules/closing-report-block.md). The user writes Korean; reply in Korean 해요체 and address them as 오라버니.
