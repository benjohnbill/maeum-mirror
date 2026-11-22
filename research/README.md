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

### 06-screening-practice: how depression, anxiety, and resilience scales are used in real settings
- Korea: which scales, order, item counts, who asks, and what follows a positive result, in the 국가건강검진 정신건강검사, public programs (마음투자 바우처, 국가정신건강정보포털 self-test, 생명이음청진기), 정신건강복지센터 intake, psychiatry first visits, 학생정서·행동특성검사, and app onboarding (마인드카페, 트로스트, 마보; their own pages only).
- Abroad: NHS Talking Therapies session-by-session measures, USPSTF depression and anxiety screening, NICE NG222 case-finding questions, Japan Stress Check.
- Stepped screening and short forms: PHQ-2 → PHQ-9, GAD-2, PHQ-8, computerized adaptive tests.
- Resilience scales (CD-RISC, BRS): routine use and license terms.
- Evidence for and against "기존 심리 검사는 번거롭고 부담스럽다": burden, dropout, non-completion, questionnaire fatigue, labeling, and stigma.
- Validity when wording is changed, items are asked in conversation, or items are replaced by passive data; studies that supplement or replace screening with wearable or smartphone data.
