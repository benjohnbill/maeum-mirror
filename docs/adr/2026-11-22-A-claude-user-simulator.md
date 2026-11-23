# The user simulator is Claude Sonnet, called through `claude -p`

Status: accepted, 2026-11-22 (lane A; team approved).

In a Rollout, the simulated user's lines come from Claude Sonnet (`claude -p --model sonnet`, no tools, no user settings), not from a Gemini model. The simulator prompt is a versioned file in `testbed/runner/simulator/`. Each simulator line reports which PHQ items it disclosed; a disclosure of a `never` item marks the run as a Withhold leak and excludes it.

## Why

- J9: the simulator must not be the product model. Different vendors share fewer biases than two Gemini models.
- Gemini quota is the binding limit (J21), and the free keys also serve the deploy. A Claude simulator spends no Gemini calls.
- The only other models reachable were `gemini-2.5-flash` and `-lite`, on one key only (404 on the other two, probe 2026-11-22), and `-lite` is in the product's fallback chain.

## Considered

- `gemini-2.5-flash` or `-lite` as simulator: shares the product's quota and key, and one of them can answer as the product in the same run.

## Consequences

Simulator cost goes to the user's Claude plan. Personas are synthetic, so D11 holds. The simulator model id (`claude-sonnet-5-5` on 2026-11-22) goes in each run header.
