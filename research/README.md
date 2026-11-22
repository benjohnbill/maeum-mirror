# Research

Purpose: ground the 마음 시간표 demo (problem, conversation design, numbers shown to the user) in checkable sources. Product context: `../PRODUCT.md`, `../docs/decisions-2026-11-22.md`.

## Pipeline

1. Questions (below) → 2. Source cards (`sources.md` per stream) → 3. Verify every number against the primary text → 4. `REPORT.md` (findings → what it means for the product) → 5. `../spec/` files the code reads → 6. Demo.

## Source card format (`sources.md`, one table row per source)

| id | tier | title / author / year | url (DOI if any) | accessed | quote (original language) | numbers | verified |
|---|---|---|---|---|---|---|---|

- Tier A: peer-reviewed paper, meta-analysis, official statistics. Tier B: news, column, company report. Tier C: community post (only as evidence of how people talk, never as a number).
- `verified`: `yes` only when the number was read in the primary text (abstract or full text). Otherwise `unverified`.
- Never invent a source, a number, or a DOI. A missing answer is a valid finding.

## `REPORT.md` shape

1. One-paragraph answer per question, each claim with source ids, e.g. `[S04-03]`.
2. "For the product": concrete implications (prompt rules, numbers we may show, wording to avoid).
3. Open questions and what could not be verified.

## Streams and questions

### 01-youth-mind: what young adults (20s to early 30s, Korea first) actually go through

[심리검사를 시작한 이유와 결과를 받은 뒤 유익했던 점](01-youth-mind/test-user-needs.md)

[한국에서 MBTI와 뱅크샐러드 유전자 검사가 퍼진 이유](01-youth-mind/test-popularity-korea.md)

- Scale of depression and anxiety in this age group (국민정신건강실태조사, 청년삶실태조사, KOSIS, peer-reviewed Korean studies).
- Evidence for the "want to know myself" demand: MBTI and psych-test popularity, surveys on why young people take such tests.
- Why they do not seek help: counseling usage rates, stigma, cost, bother.
- Community language (Tier C): how people describe their own state on 에브리타임, 블라인드, 더쿠, Reddit.

### 02-ai-counseling: prior AI or virtual-agent counseling
- Self-disclosure to virtual agents vs humans (Ellie / SimSensei, Lucas et al. 2014 and follow-ups).
- Outcome studies: Woebot, Wysa, Therabot, Korean services if any.
- Failures and risks: Tessa (NEDA, 2023), chatbot harm cases; what safety design they motivate.
- Single-session interventions (Schleider and others): evidence that one short session helps.

### 03-elicitation: how screenings and interviews open people up
- Motivational interviewing OARS, semi-structured interview, funnel questioning, rapport.
- Conversational administration of PHQ items: validity vs the paper form.
- Short validated scales: PHQ-9, GAD-7, ISI. Korean validated versions, cutoffs, license terms.
- Barnum / Forer effect: why generic reports feel accurate, and the ethics line.

### 04-body-to-mind: what wearable data can and cannot say about mood
- Effect sizes (r, OR) between depressive symptoms and sleep duration, sleep timing regularity, steps or activity, resting HR, HRV. Meta-analyses first.
- Within-person change vs between-person differences: which predicts better.
- Population reference values for Korean 20s (sleep, steps), e.g. 국민건강영양조사.
- Verify the citations already in `../public/js/prompt.js` (Lyall 2018, Rykov 2021, Moshe 2021, Saeb 2015, Kroenke 2001/2009).

### 05-report-form: the "professional" report grammar (done in the main session)
- Structure notes from a commercial temperament test report, mapped to mobile cards. No personal data.

### 06-screeners: 짧은 심리검사와 응답에 따른 확장

[7개 검사 비교·문항·채점·해석](06-screeners/REPORT.md) · [원출처와 한국어판 이용 조건](06-screeners/sources.md) · [검사별 JSON](../spec/tests/)

### 07-walking-sleep · 걸음·수면으로 대화를 시작하는 근거

[기기 검증과 개인 내 변화, AI 성찰 연구](07-walking-sleep/REPORT.md) · [Apple·삼성 측정 규칙과 대한상공회의소 해커톤 시연 기준](../spec/walking-sleep.md) · [Lumi(uselumi.ai) 랜딩페이지에서 참고할 점](../docs/landing-reference-lumi.md)

### 08-similar-services · 마음미러 유사 서비스

[15개 서비스의 입력·결과·소요 기간과 마음미러 설계에 참고할 점](08-similar-services/REPORT.md) · [서비스별 공식 출처와 확인 범위](08-similar-services/sources.md)
