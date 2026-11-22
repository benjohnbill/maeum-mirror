# 프로젝트 소개서 plan (Lane D)

Status: structure settled 2026-11-22; content not written.

## Pages (official template order, 10 body pages max)
요약 · 01 문제 정의 · 02 대상 사용자 · 03 AI를 활용한 해결 방안 ·
03-2 AI의 한계와 검증 (extra page; waits for `testbed/TABLE.md`, 11-23 12:00) ·
04 서비스 구조 · 05 핵심 기능 및 사용자 흐름 · 06 차별점 · 07 구현 현황 및 프로토타입 ·
08 기대효과 및 확장 방안 (cost per use, expansion path, testbed as regression check) ·
별첨 (팀 구성, 사전 개발 내역, 외부 자원·출처)

## How
- 16:9 HTML pages in `docs/submission/intro/`, PDF via headless Chromium, timetable visual direction.
- 07 screenshots: deployed URL after the 14:00 smoke (1440 px, 390 px, crisis path); local fallback.
- Model row (04): `gemini-3.5-flash` (response `modelVersion` `gemini-3.6-flash`, date measured)
  → fallback `gemini-2.5-flash-lite`. Every model and source line carries a date.
- Paper citations in `public/js/prompt.js` are verified against primary sources before use.

## Notes for 03-2 (limits)
- Gemini API unpaid quota: Google may use inputs and outputs to improve its products, and
  human reviewers may read them; Google says not to submit sensitive or personal information.
  Paid (billing-enabled) use is not used for improvement. Source:
  https://ai.google.dev/gemini-api/terms (read 2026-11-22). The demo uses the synthetic user only.
