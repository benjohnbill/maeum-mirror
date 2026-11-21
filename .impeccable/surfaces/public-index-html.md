---
version: 1
slug: "public-index-html"
primary_target: "public/index.html"
related_targets: []
---

# 마음 시간표: main app surface

Scope: the single-page app (upload → conversation → report). Mode: Operate.
Audience: Korean 20s, one curious visit; judges watching a 10-minute demo.
Constraint: raw health data never leaves the browser; demo runs on a labeled synthetic user.

## Direction contract

THESIS: The body's week is drawn as a university timetable, the grid every Korean student checks daily, so sleep reads as blocks in 요일 × 시간 cells. Refuses the wellness-app stack of soft cards, mood emoji, and pastel gradients.

OWN-WORLD: Untinted off-white ground #f3f2ee, ink #17171a, hairline grid #d6d5d0. Timetable blocks are solid: baseline weeks drawn as pale ghost blocks, the recent week as ink blocks; one vermilion #d9481c marks change (late onset, the cell the AI is talking about). Pretendard at workhorse weights, tabular numerals, no radius above 4px.

STORY: The visitor sees their own last week laid over their normal week, understands what changed without reading a number, talks about it with the agent, and leaves with a report that names the pattern and, when needed, a gentle pointer to help.

FIRST VIEWPORT: A full-width empty timetable (월–일 × 21시–11시) with ghost blocks, the product line set over it, the primary action "샘플 데이터로 시작" and the secondary file upload directly below, and a one-line privacy statement with a "AI에게 가는 내용" link.

FORM: Timetable grid (candidate 1 of 7, chosen as the pick over assigned 통장정리). seed:5e32f099e28ad51b. Signature interaction: when the agent speaks about a metric, the matching timetable cells light in vermilion.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance
