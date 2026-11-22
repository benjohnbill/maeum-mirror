# Lane B: Persona — start prompt

Read first: `docs/handoff/lanes/README.md`, then `~/.claude/plans/maeum-testbed-split/FINAL.md`
(all of it), `rounds/01-judgment.md` J5, J6, J12, J17–J19, then `PRODUCT.md`,
`research/01-youth-mind/REPORT.md`, `research/03-elicitation/REPORT.md`,
`scripts/make-sample.mjs`.

## Role
You define who the test users are and produce persona files plus matching synthetic Apple
Health data in `testbed/personas/`. Personas are test cases and also part of the agent
context, so their speech must sound real.

## Settled
- Target: Korean 20s to early 30s (user decided). Late teens and mid 30s only as outliers.
- No account-level scraping, no verbatim community text, nothing from `research/*/private/`
  in persona files (privacy, community terms, and the no-real-data rule). Provenance IDs.

## Agenda for `/grill-with-docs` (design decisions, one at a time)
1. Persona factors: entry route, gender, age, situation, temperament, speech style,
   health-data pattern. Which factors vary, which stay fixed.
2. Speech realism: behaviour patterns matter more than surface style (minimising,
   avoidance, short answers, answers that disagree with the data). Check candidate
   consented datasets: AI Hub Korean counseling and emotion dialogue corpora, DAIC-WOZ
   (English, PHQ-8 interviews, access request). Verify they exist and their licences.
3. Outlier share and non-target users. Full set later follows the base rate (mostly PHQ 0–4).

## After lane C freezes the contract (~1 h)
Write the pilot set of 4: concordant low mood, discordant (data down, speech "괜찮아요"),
benign change (data down, truth PHQ 0–4), stable healthy. Build a parametric generator
from `make-sample.mjs` so each persona yields an `export.xml` with at least 2 metrics.

## Output by 11-23 morning
4 pilot personas + data, ready for lane A. More personas after the deadline.
