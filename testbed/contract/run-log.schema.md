# Run log contract (frozen 2026-11-22, lane C)

Owner: lane C (judgment). Lane A's runner writes logs that follow it. Field names follow lane A's
existing `testbed/runs/replay-*.jsonl`.
Machine check: `node testbed/contract/validate.mjs runlog <file.jsonl>`.

One run = one JSONL file in `testbed/runs/`. Line 1 is the header. Then one line per product call
(`kind: "turn"` or `kind: "report"`). The last line is the end record.

## Header (`kind: "header"`)

| Field | Type | Rule |
|---|---|---|
| `run_id` | string | unique |
| `mode` | enum | `rollout` (full conversation) or `replay` (frozen prefix, J10) |
| `persona_id` | string or null | null for a replay without a persona, or a human control run |
| `arm` | string | the experiment arm, for example `head`, `model:<id>`, `context:no-summary` |
| `prefix_id` | string or null | set when `mode` is `replay` |
| `commit` | string | git commit of the product code |
| `product` | object | `{ requested_model, fallback_chain: [..], timeout_ms }`. Deploy settings (user, 2026-11-22): `timeout_ms` 45000, fallback chain unchanged, the 3 free keys. Model and context arms use a one-model chain. |
| `simulator` | object or null | `{ model, prompt_version }`; `model` must differ from `product.requested_model` (J9). null for a human control run (`human: true`). |
| `human` | boolean | true for a human-typed control run |
| `call_budget` | object | `{ key_pool: "free" or "paid", planned_calls, demo_reserve_calls }` (J21) |

## Turn and report lines (`kind: "turn"` or `"report"`)

| Field | Type | Rule |
|---|---|---|
| `turn_index` | integer | 0 = opener. Report line: index after the last turn |
| `at` | ISO time | |
| `user_text` | string or null | the user line sent before this call; null for the opener |
| `crisis_rule_hit` | boolean | `isCrisis(user_text)` from `public/js/safety.js`. On true no model call happens; the reply fields are null. |
| `requested_model` | string | the first model of the chain for this call |
| `model` | string or null | the chain entry that answered (the `model` field from `server.mjs`) |
| `model_version` | string or null | the response `modelVersion` from Gemini (lane A found `gemini-3.5-flash` answers as `gemini-3.6-flash`). null only when not reachable, with `model_version_note`. |
| `fallback` | boolean | `model !== requested_model`. A true call is dropped from model arms. |
| `calls` | integer | API calls spent on this line, retries included (call budget) |
| `latency_ms` | integer | |
| `status` | integer | HTTP status of `/api/chat` |
| `error` | string or null | |
| `raw_reply` | string or null | the model's `reply` |
| `shown_reply` | string or null | after `checkReply` |
| `output_rule_hit` | boolean | `raw_reply !== shown_reply` |
| `focus`, `items`, `risk`, `offer_test`, `done` | as `TURN_SCHEMA` in `public/js/prompt.js` | turn lines only |
| `report` | object or null | the full `REPORT_SCHEMA` object; report lines only |
| `test_result` | object or null | set when the product inserted a `[검사 결과]` line before this call |

## End record (`kind: "end"`)

| Field | Type | Rule |
|---|---|---|
| `turns` | integer | turn lines written |
| `ended_by` | enum | `done`, `max_turns`, `crisis`, `error`, `budget` |
| `excluded` | boolean | true when the run must not be scored |
| `exclude_reason` | string or null | `withhold_leak:<item>`, `fallback`, `simulator_error`, ... |
| `calls_used` | integer | sum of `calls` |
