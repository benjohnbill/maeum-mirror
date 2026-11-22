# Opener Oracle is the literal prompt rule; disagreement with the Expected opener is Spec ambiguity

`public/js/prompt.js:44` says to open with "the metric with the largest change". Taken literally on the
sample user, that is workouts (−100 %), which the 2026-11-22 real run called the wrong opener. We
decided (user said, via the hub, 2026-11-22) that the opener Oracle is code that applies the prompt
literally: among metrics not marked `(작은 변화)` and not HRV, the largest relative change; it passes
when turn 0 `focus` equals that metric and `reply` holds a number. Each Persona also carries an
Expected opener written by a person (lane B). When the two differ, the Symptom goes to the Spec
ambiguity Cause bucket and is not tested against the model, context, or method. The same gate holds
for every Symptom: no single-rule Oracle, or sources that disagree, means Spec ambiguity first.

## Considered options

- An allowed set (top 2 body metrics): hides the disagreement instead of showing it.
- Only a human Expected opener: no code Oracle, so replays cannot be scored automatically.

## Consequences

Model blame needs a written, user-signed expected output first (J8, J11). A Spec ambiguity row's
decision is "fix the spec", and its next check is the user's signature on the expected output.
