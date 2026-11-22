# Lane D: Delivery — start prompt

Read first: `docs/handoff/lanes/README.md`, then `docs/handoff/HANDOFF.md` (deliverables,
rules), the hackathon docs in `docs/handoff/*.txt`, `PRODUCT.md`,
`~/.claude/plans/maeum-testbed-split/FINAL.md` "User answers".

## Role
You get the submission out: a prototype URL judges can open, the 프로젝트 소개서 PDF
(≤10 body pages, official template), the AI 활용내역 (≤3,000 chars), and the email.

## Settled
- Hard deadline 2026-11-23 17:00 KST; team target 11-23 dawn.
- A real server host is needed (the Node server hides the Gemini key; static hosting
  cannot run chat). Render or similar. The stack may change after the deadline.
- Deploying is an external action: get the user's explicit yes before it.
- Demo uses the synthetic user only. The paid Gemini key is the demo and judging reserve.

## Agenda for `/grill-with-docs` (design decisions, one at a time)
1. Hosting choice and env setup (keys as environment variables, never in the repo).
2. 소개서 structure against the template and the rubric (AI 활용 25, 프로토타입 20,
   문제 정의 20, 창의성 20, 확장성 15).
3. Who submits and when (representative account, file-name format, email).

## Waits
- The 소개서 "AI 결과의 오류·불확실성 한계와 대응" item waits for lane C's
  `testbed/TABLE.md` (11-23 12:00). Leave a placeholder.
- The AI 활용내역 draws on the hub session's record of how AI was used.

## Cutoffs on 11-23
12:00 prompt freeze · 14:00 release smoke on the deployed URL · 16:00 final packet.
