---
status: snapshot
written: 2026-11-22 22:00 KST (hub session)
supersedes: nothing; read after docs/handoff/HANDOFF.md
---

# HANDOFF: method pivot to casual, rapport-first (2026-11-22 evening)

The user is 오라버니 (global CLAUDE.md voice rules). Deadline: 2026-11-23 17:00 KST (team target: dawn).

## What changed today (decided by the user)

1. **The PHQ-in-chat method is dropped.** Real runs (Gemini 3.5 Flash, personas p1/p2/p4) asked PHQ items one by one with an empathy line in front. The user judged it "취조" (interrogation) and rejected judging the product by PHQ accuracy. Evidence: `testbed/runs/rollout-p*-head-0-2026-11-22T10-21-56-*.jsonl`. Root cause is the method layer: `public/js/prompt.js:73` makes "6 of 8 PHQ topics covered" the goal.
2. **New direction: casual wrapper + rapport first.** The product must remove the burden and hassle of legacy tests (PHQ-9, resilience scales) and the stigma of "getting tested". Body data is the opener and the evidence; the user mostly picks (multiple choice), with one optional free-text field always available.
3. **Two-stage screening (agreed shape).** Stage 1, the casual talk, aims at sensitivity: hidden topic tags on choices; when tags pile up, offer the formal test. Stage 2, the formal PHQ-9 sheet (already in the product), is the only place a "problem" label comes from (positive predictive value). Targets the user named: sensitivity 65–85%, PPV ≥65%. Measuring them needs dozens of personas: after the deadline.
4. **Term proposed, not yet approved:** `선별 성능` = sensitivity + PPV together. Do not write it to GLOSSARY.md until the user approves.
5. **All four lanes stopped** (판정, 페르소나, 제출, 실행기 panes in Herdr). Much of their work assumed the old method. Reusable: personas p1–p4 and their `export.xml`, the Archetype split (esp. Discordant), `safety.js` crisis rule, the runner, Vercel deploy files (`api/`, `lib/chat.mjs`). Not reusable as-is: PHQ item-error scoring, `disclosure_gate` "direct" assumption, TABLE.md rows built for the old method.

## Prototype state

`public/proto/scripted.html` (open `http://localhost:8787/proto/scripted.html`, server: `npm start`). Scripted, no AI calls, phone frame + KakaoTalk-like chat, persona switcher, hidden-tag panel. Current version: ideal two-stage scripts for p1–p4 (data → 2–3 exchanges → type card → formal-test offer when ≥2 tags).

**What the user found wrong in it (latest feedback):** rapport is thin. Every reaction is "receive and move on". Missing devices:
- follow-up questions that build on the user's answer (branching);
- the user correcting the data ("야근이었어요" → "그럼 잠 문제가 아니라 일 문제였네요");
- callbacks to earlier answers;
- curiosity about the person, not only the data;
- small discoveries and humor ("화요일만 유독 늦게 자요 ㅋㅋ").
Also rejected earlier: a repeated "또 궁금한 거 있어요?" menu (interrogation), a separate "장면 3개만 골라 줄래요?" block (forced, artificial). Accepted: AI offers the next topic itself; user can say 보여 줘 / 다른 거 궁금해 / 정리해 줘; period choice lives inside question chips ("1년 전 이맘때랑 비교하면?"), not as a settings step.

Proposed next step that the user did not start yet: a rapport-only script for p2, 8–10 exchanges, with the devices above, no result card.

## Ideas the user wants to discuss next session (not decided)

- **Clickable bait entry.** The first screen shows bar-shaped buttons with click-worthy character titles, e.g. "우울감이라고는 모르는 사나이", "회복 탄력성 만렙". Possibly character concept art.
- Each button leads to a heavily "degraded" short test (accuracy can be low), e.g. a few BRS (Brief Resilience Scale) items. Open question: fewer real scale items inside the whole chat, or a few questions with most of the test flavour removed.
- **Character role-play as a breakthrough:** pick a keyword, then pick the character who chats with you.

Cautions to raise when discussing (hub's view, not decided):
- Real copyrighted characters (e.g. 한마 유지로 from 바키) cannot be used in a public hackathon prototype; use original characters in that spirit.
- Titles that glorify "never depressed" can read as judging users who are low; target users may be in a low mood (PRODUCT.md accessibility note).
- In role-play the crisis rule must still break character (`safety.js` fixed rule, 109 / 1577-0199 / 119).
- Barnum risk (`research/03` 1-4): every result line must trace to data or a user choice.
- A degraded scale is not a validated score; numbers only from the formal sheet (`research/03` 1-2).

## Open items carried over

- Deploy key: free keys first; key0 free quota for 3.5-flash hit 429 today; KEY_1/KEY_2 used ~29 calls; KEY_1/KEY_2 return 404 for 2.5 models, so fallback breaks on them. Paid key kept as reserve. User deferred the decision.
- Team name, representative, submission timetable, AI 활용내역 draft: deferred by the user (product definition may change).
- `research/06-screening-practice/` and a `research/README.md` edit appeared in the working tree from outside this session; not reviewed here.
- `.impeccable/config.json`: one narrow ignore (`pulsing-dot` on `public/proto/scripted.html`, false positive).

## Where things are

- Grilling record of the session split: `~/.claude/plans/maeum-testbed-split/FINAL.md`.
- Lane start prompts: `docs/handoff/lanes/`.
- Personas: `testbed/personas/` (README has play notes). Runner: `testbed/runner/`. Checklist and table (old method): `testbed/DEMO-CHECKLIST.md`, `testbed/TABLE.md`.
