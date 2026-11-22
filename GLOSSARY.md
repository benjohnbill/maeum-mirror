# maeum-mirror

Shared language for the maeum-mirror product and its demo-diagnosis testbed. One section per lane; edit only your own.

## Lane A

**Arm**:
One experiment condition of the product: its model settings plus any context switch, held fixed across the runs it groups.
_Avoid_: variant, condition, setting

**Prefix**:
The frozen start of a conversation that a Replay sends to the product.
_Avoid_: snapshot, seed conversation

**Attempt**:
One call from the product's server to Gemini inside one product call; each fallback model or retried key is a separate Attempt.
_Avoid_: retry, request

## Lane B

**Persona**:
One invented test user: a background, a speech setting, a health-data pattern, and hidden ground truth (PHQ truth score, Disclosure gates) that the product never sees.
_Avoid_: test user, fake user, known group member

**Synthetic user**:
A Persona as shown in a demo, labeled as invented.
_Avoid_: sample user, demo persona

**Archetype**:
The class of a Persona by whether its health data and its speech agree, and by its true severity.
_Avoid_: known group, cell, type

**Concordant low mood**:
An Archetype whose health data worsens and whose speech and PHQ truth both show low mood.

**Discordant**:
An Archetype whose health data worsens while its speech denies it ("괜찮아요"), with real low mood under the denial.
_Avoid_: hidden depression, masked case

**Benign change**:
An Archetype whose health data worsens for a reason in its situation, with a PHQ truth score of 0–4.
_Avoid_: false positive persona

**Stable healthy**:
An Archetype whose health data changes only by noise, with a PHQ truth score of 0–4.

**Behaviour tag**:
A fixed label for how a Persona talks: minimising, avoidance, short answers, contradicting the data, over-disclosure.
_Avoid_: speech style, tone, temperament

**Surface style**:
The register of a Persona's lines (honorifics, ㅋㅋ and emoticons, sentence length); not scored.
_Avoid_: speech style

**Disclosure gate**:
Per PHQ item, the condition under which a Persona reveals its true answer: when asked directly, when asked indirectly, or never.

**Health-data pattern**:
Per metric, a Persona's baseline level, its change over the last 14 days, and its noise.
_Avoid_: data profile

**Expected opener**:
The metric a human reader would raise first from a Persona's health data.
_Avoid_: first question

## Lane C

**Symptom**:
One named way the product's output departs from what it should do, kept as one row of the testbed table.
_Avoid_: bug, issue, problem

**Oracle**:
The rule that decides, for one Symptom, whether an output passes; either deterministic (code) or judged (a named rater).
_Avoid_: criterion, check, metric

**Cause bucket**:
The class of cause assigned to a Symptom: model, context, method, code rule, Spec ambiguity, simulator artifact, or unresolved.
_Avoid_: layer, factor, root cause

**Spec ambiguity**:
The Cause bucket for a Symptom whose expected output is not one rule, or whose sources disagree on it.
_Avoid_: unclear requirement, prompt bug

**Withhold leak**:
A run in which the simulated user reveals a PHQ item whose Disclosure gate is never; the run is excluded.
_Avoid_: over-disclosure (that is a Behaviour tag)

**Rollout**:
A run that plays a whole conversation between the product and a simulated or human user.
_Avoid_: episode, session

**Replay**:
A run that sends one frozen conversation prefix to the product and records only the next reply.
_Avoid_: re-run, ablation

**Human control run**:
A Rollout in which a person types the user's lines, used to check the simulator.
_Avoid_: manual test, baseline run
