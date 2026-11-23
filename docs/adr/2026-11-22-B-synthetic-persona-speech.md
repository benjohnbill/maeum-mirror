# Persona speech is fully synthetic, with source IDs and no dataset text

Status: accepted, 2026-11-22 (lane B; team approved).

Persona lines are hand-written. They cite research themes by source ID (`S01-xx`, `S03-xx`) and may name the AI Hub wellness dataset's intent labels, but they never contain text from a dataset, a community post, or `research/*/private/`.

## Why

- No consented Korean dataset has both dialogue text and PHQ labels in a public primary source (checked 2026-11-22).
- AI Hub data (wellness 267, emotion dialogue 86, counseling 71806, multimodal 573) needs Korean-national approval of unknown duration, and its usage policy forbids giving data to an unapproved third party and needs a separate agreement for export abroad. Persona text reaches two external APIs (simulator and Gemini).
- DAIC-WOZ is for academic and non-profit researchers only, non-commercial, and English.
- D11: no real personal data goes to an external AI API (`PRODUCT.md:38`).

## Considered

- Paraphrase AI Hub lines: the policy does not cover paraphrase, and approval would not arrive before the 2026-11-23 deadline.
- Real survey answers (user preference): none can be collected before the deadline. The user's two human control conversations check realism instead.

## Consequences

Realism depends on the Behaviour tags; lane C compares simulator runs with the human controls and lane B retunes the tags when the gap is large. Revisit after the deadline if an approved dataset or survey becomes available.
