# Decisions, 2026-11-22

## 대회 시연의 측정 범위

Apple 건강과 삼성 헬스에서 공통으로 설명할 걷기·수면 지표를 우선한다. 팀이 구현할 계산식, 출처와 결측 처리, 합성 데이터 시연 범위, 현재 구현과의 차이는 [걷기·수면 측정 지침](../spec/walking-sleep.md)에 정리했다. 질문과 리포트에서 인용할 수 있는 범위는 [학술 근거 검토](../research/07-walking-sleep/REPORT.md)를 따른다.

## Problem definition

- Core: young adults want to know their own mental state (MBTI and psych-test popularity), but in practice they do not know it.
- Target user: ordinary people who do not use counseling because it feels heavy or bothersome. Not people who seek counseling.
- Helping people with low mood is a nudge on top of the core, not the core. The earlier keywords (번아웃, 무기력) are no longer the center.

## Framing

- Whether to call it "상담" in the UI or the 소개서 is **on hold**.
- Barnum-style plausibility in the report is fine. Our rule: every statement stays tied to a real number and its evidence strength.

## Session and output

- Default session: about 5 minutes, casual. Longer only when the user chooses it.
- Conversation length: **10 turns by default** for now. Known tension: current model latency (11–30 s per reply) makes 10 turns longer than 5 minutes.
- Output: mobile-first responsive web UI with stacked, collapsible cards. Not a PDF. The STC report (user's own PDF, contains personal data, never copied into the repo) is a reference only for its "professional" grammar: method disclosure, scale bands, indicator hierarchy, percentile dots, type name + one-liner, advice checklist.
- The derived output includes numbers. Format is decided after research.

## Test router

- The main conversation is a router. When the AI needs more context, it offers a short validated test in a separate sheet. The result returns to the main session. In the hackathon demo, only a synthetic participant’s result may be included in an external AI request. [해커톤 기획·개발 기준](../PRODUCT.md#해커톤-기획개발-기준)
- The prototype supports PHQ-9, GAD-2, GAD-7 and PHQ-4. A longer follow-up reuses the overlapping responses from a completed short form in the same session.
- Entry: an AI-offered chip in the chat is the main entry; `/` test list is a hidden shortcut.
- The PHQ-9 questionnaire ends with item 9 for every response. Support resources can be opened in the final report. A request for immediate help or a disclosure of immediate danger opens contact options. Completed tests appear in the final report. PHQ-9 also includes its Korean adult reference comparison for eligible profiles.
- Tests live in a registry (`spec/tests/<id>.json`: items, scoring, cutoffs, summary line).

## Research

- Four streams plus report form: see `research/README.md`.
- Community data: allowed with URL, date, and quote. Logged-in sites through the Aside browser; ask the user when a login is needed.
- How research feeds the 소개서 or the AI usage note: undecided. Demo first.
