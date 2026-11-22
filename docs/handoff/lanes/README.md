# Testbed lanes (started 2026-11-22 ~18:00 KST)

Source of truth: `~/.claude/plans/maeum-testbed-split/FINAL.md` (grilling result).
Evidence: `~/.claude/plans/maeum-testbed-split/rounds/01-judgment.md`.

All four lanes start at once. Only two waits exist:
1. Lane B writes persona files only after lane C freezes the contract (~1 h).
2. Lane D fills the 소개서 "오류·불확실성 대응" item only after lane C's table (11-23 12:00).
The pilot (11-23 morning) needs lane A's runner and lane B's pilot personas.

Shared paths (each lane writes only its own):
| Path | Owner |
|---|---|
| `testbed/contract/` (persona schema, run-log schema, oracle table) | C |
| `testbed/TABLE.md` (per-symptom table) | C |
| `testbed/runner/`, `testbed/runs/` | A |
| `testbed/personas/`, `scripts/make-persona-data.mjs` | B |
| deploy config, `docs/submission/` | D |
| `server.mjs`, `public/` | nobody until 11-23 12:00 prompt freeze; product fixes go through C's table |

Git: commit only your own paths. Do not push without the user's OK (teammates share the repo).
Never print `.env`. Free Gemini keys for experiments; the paid key is the demo and judging reserve.
Hard deadline 2026-11-23 17:00 KST; team target: 11-23 dawn.

## How each lane works
The user starts each lane with `/grill-with-docs` (grilling + domain-modeling). The
"Agenda" section of each lane file is the list of design decisions to settle there.
Decisions go into ADRs, terms into `GLOSSARY.md` (format: domain-modeling skill).
Four sessions write at once, so:
- ADR file names carry the lane: `docs/adr/2026-11-22-<lane>-<slug>.md` (no shared counter).
- `GLOSSARY.md` has one section per lane (`## Lane A` …); edit only your section.
  Lane C merges duplicates after the pilot.
