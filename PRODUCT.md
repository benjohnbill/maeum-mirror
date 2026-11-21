# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Stack

Static HTML, CSS, and ES modules with no build step, plus one small Node server (`server.mjs`) that serves the files and proxies chat calls to the Gemini API so the key never reaches the browser. Chosen by the user on 2026-11-22.

## Users

Korean young adults (20s to early 30s) who wear an Apple Watch or carry an iPhone. They are curious about themselves (the audience that made MBTI popular) but cannot describe their own mental state, and many do not notice or will not admit a low mood when asked directly. They come once, out of curiosity: "what state am I in right now?"

Secondary audience: the judges of the KORCHAM AI Hackathon 2026 (preliminary online review, then a 10-minute on-site demo for the top 6 teams).

## Product Purpose

The user uploads the Apple Health export file. The browser turns years of body data (sleep, steps, resting heart rate and HRV, workouts) into a short summary compared with the user's own normal. An AI agent opens the conversation from what the data shows, talks for about 10 turns while weaving in validated screening items (PHQ-9), and ends with a self-understanding report. It is a mirror, not a diagnosis.

Success: a user who would never fill in a depression questionnaire learns something true about their recent state, and a user with strong low-mood signals is gently pointed to professional help.

## Positioning

The body speaks first. The conversation starts from the user's own data ("your sleep dropped 18% in the last two weeks"), not from a questionnaire or a personality quiz. Continuity comes from the data itself: one session reads years of history, so no account and no repeat visits are needed.

## Operating Context

- One-time use, about 5 to 10 minutes, on a laptop or phone browser.
- Apple Health export is a zip with `export.xml`, often hundreds of MB. Parsing happens only in the browser.
- Hackathon rule: real personal or sensitive data must never be sent to an external AI API, even with consent. Demos use a synthetic user only.

## Capabilities and Constraints

- Input: `export.zip` or `export.xml`, plus a built-in synthetic sample.
- Metrics (decided): sleep duration, sleep-onset regularity, daily steps, resting heart rate and HRV, workout frequency.
- Baseline (decided): the user's own past (days 15 to 90 before the latest record) versus the last 14 days. General norms only flag extremes.
- What reaches the AI: a fixed system prompt (role, safety rules, PHQ-9 items, short paper summaries), the derived summary lines, and the conversation text. Never raw records, GPS routes, device names, or birth date.
- Not a diagnosis. No DSM-5 text (copyrighted, and diagnostic framing triggers medical-device rules).
- Crisis safety: a fixed rule, not the LLM, handles self-harm signals and shows 109 (자살예방상담) and 1577-0199 (정신건강위기상담).
- Undecided: what the shareable report card may contain beyond light content (to discuss after the demo).

## Evidence on Hand

- No real user data, testimonials, or clinical validation exist. Every demo dataset is synthetic and must be labeled so.
- Research grounding is general (wearable and smartphone markers correlate with depressive symptoms); do not invent study results or accuracy numbers.

## Product Principles

1. A mirror, not a verdict: describe, never diagnose.
2. The data opens the door; the person decides what to say.
3. Show exactly what leaves the device.
4. Safety rules are code, not prompts.
5. Light enough to try out of curiosity, serious enough to be true.

## Accessibility & Inclusion

Korean-language UI. Must work on a phone browser. Users may be in a low mood: no alarming colors or urgency on risk signals.
