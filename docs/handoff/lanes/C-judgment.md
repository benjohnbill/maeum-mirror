# Lane C: Judgment and pilot — start prompt

Read first: `docs/handoff/lanes/README.md`, then `~/.claude/plans/maeum-testbed-split/FINAL.md`
(all of it), `rounds/01-judgment.md` J1, J6–J8, J11–J16, J22–J24, then `PRODUCT.md`.

## Role
You own the judgment of the demo diagnosis testbed: what counts as a failure, which cause
bucket it falls in, and the pilot's conclusion. Lane A runs things. Lane B writes personas.

## First hour (other lanes wait on this)
Freeze the contract in `testbed/contract/`:
- `persona.schema.md`: fields from FINAL "Contract contents" (phq8_truth, archetype,
  disclosure gate, offer_test policy, expected opener, provenance IDs; no verbatim text).
- `run-log.schema.md`: per-turn fields + call budget field.
Validate with one hand-written sample persona. Then tell the user "contract frozen".

## Agenda for `/grill-with-docs` (design decisions, one at a time)
1. Symptom oracle table (`testbed/contract/oracles.md`): each symptom's definition, oracle,
   deterministic or judged, threshold. Opener oracle as code. Spec-ambiguity gate.
2. Cause buckets: model, context, method (direct tests), code rule, spec ambiguity,
   simulator artifact, unresolved. Decision rule for each.
3. Scoring: item error vs phq8_truth (baseline MAE 2.91), tone tiers, report checks, safety.
4. Re-baseline: the user's first human control conversation on HEAD (they have not run
   HEAD in a browser yet). Record observed symptoms against F5.

## Output by 11-23 12:00
`testbed/TABLE.md`: one row per symptom: observed vs expected, run evidence, bucket or
"unresolved", decision, next check. Hand it to lane D for the 소개서 uncertainty item.
A stopped pilot still ships the table.
