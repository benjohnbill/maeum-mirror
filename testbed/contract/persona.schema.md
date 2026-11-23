# Persona file contract (frozen 2026-11-22, lane C)

Owner: lane C (judgment). Lane B writes files that follow it. Change only through lane C.
Machine check: `node testbed/contract/validate.mjs persona <file>`.

One persona = one directory `testbed/personas/<id>/` with:
- `persona.json` — this contract.
- `export.xml` — synthetic Apple Health export from lane B's generator.

## Fields of `persona.json`

| Field | Type | Rule | Scored? |
|---|---|---|---|
| `id` | string | `^[a-z0-9-]+$`, same as the directory name | — |
| `archetype` | enum | `Concordant low mood`, `Discordant`, `Benign change`, `Stable healthy` (pilot set, J12) | groups the results |
| `phq8_truth` | object | keys `"1"`–`"8"` (`PHQ8` ids in `public/js/prompt.js`), each an integer 0–3 | yes: item error (Agenda 3) |
| `disclosure_gate` | object | keys `"1"`–`"8"`, each `direct`, `indirect`, or `never` | yes: `withhold` leak check |
| `behavior_tags` | array | subset of `minimising`, `avoidance`, `short_answers`, `contradicts_data`, `over_disclosure` | yes: human vs simulator comparison |
| `offer_test` | enum | what the simulated user does when the product offers the short test: `accept`, `decline`, `ignore` | no (drives the run) |
| `expected_opener` | string or null | a metric id from `public/spec/metrics.js` (`sleep`, `onset`, `regularity`, `steps`, `rhr`, `hrv`, `workout`); the metric a person expects the first turn to use. Lane B fills it. | yes: opener row, spec-ambiguity gate |
| `health` | object | `{ "export": "export.xml", "generator": "<script and params>" }` | no |
| `provenance` | array of strings | theme IDs that the persona draws on. IDs only. | no |
| `surface_style` | string | Surface style (Lane B glossary): register for the user simulator only. Not scored. | no |

## Value meanings

`disclosure_gate`, per PHQ-8 item:
- `direct` — 직접 물으면 말함. The simulator discloses when the product asks about the item directly.
- `indirect` — 돌려 물으면 말함. The simulator discloses also on an indirect or reflective lead.
- `never` — 끝까지 숨김. The simulator never discloses the item. A disclosure of a `never` item is a
  **withhold leak**: the run is a simulator failure and is excluded from scoring (J9).

`offer_test = accept`: the simulator answers the test sheet with `phq8_truth` for items 1–8 and 0 for
item 9. Pilot personas carry no self-harm signal.

## Hard rules

- No real personal data (D11: `PRODUCT.md:38`). Every persona is synthetic.
- No verbatim community text, and nothing from `research/*/private/`, in any field (J18).
  `provenance` carries IDs; `surface_style` is written by hand.
- The product never sees `persona.json`. Only the simulator prompt and the scorer read it.
