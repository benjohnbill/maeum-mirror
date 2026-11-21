# Decisions, 2026-11-22 (second session)

These update `docs/handoff/HANDOFF.md`. Where they conflict, this file wins.

## Problem definition (user said)

- Core: young adults want to know their own mental state (MBTI and psych-test popularity), but in practice they do not know it.
- Target user: ordinary people who do not use counseling because it feels heavy or bothersome. Not people who seek counseling.
- Helping people with low mood is a nudge on top of the core, not the core. The earlier keywords (번아웃, 무기력) are no longer the center.

## Framing

- Whether to call it "상담" in the UI or the 소개서 is **on hold**.
- Barnum-style plausibility in the report is fine (user said). Our rule: every statement stays tied to a real number and its evidence strength.

## Session and output

- Default session: about 5 minutes, casual. Longer only when the user chooses it.
- Conversation length: **10 turns by default** for now (user said). Known tension: current model latency (11–30 s per reply) makes 10 turns longer than 5 minutes.
- Output: mobile-first responsive web UI with stacked, collapsible cards. Not a PDF. The STC report (user's own PDF, contains personal data, never copied into the repo) is a reference only for its "professional" grammar: method disclosure, scale bands, indicator hierarchy, percentile dots, type name + one-liner, advice checklist.
- The derived output includes numbers. Format is decided after research.

## Test router (user said)

- The main conversation is a router. When the AI needs more context, it offers a short validated test in a separate sheet. The result returns to the main session and goes through the API for a more specific answer.
- MVP includes **one test: PHQ-9**.
- Entry: an AI-offered chip in the chat is the main entry; `/` test list is a hidden shortcut.
- **PHQ-9 item 9 is included in the sheet.** Any score ≥ 1 on item 9 is handled by code (crisis panel: 109, 1577-0199, 119) without calling the AI. The AI itself still never asks about self-harm in conversation.
- Tests live in a registry (`spec/tests/<id>.json`: items, scoring, cutoffs, summary line). Next candidates: GAD-7, ISI.

## Research

- Four streams plus report form: see `research/README.md`.
- Community data: allowed with URL, date, and quote. Logged-in sites through the Aside browser; ask the user when a login is needed.
- How research feeds the 소개서 or the AI usage note: undecided. Demo first.
