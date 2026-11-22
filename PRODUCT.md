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

## 해커톤 기획·개발 기준

랜딩 문구, 검사 화면, AI 대화, 시연 자료를 만들 때 아래 기준을 적용한다. 대회 제출 전에 참고할 원문은 [공식 공고](https://korcham-careerfair.com/hackathon)와 [AI 활용 및 출처 표기 기준](https://drive.google.com/file/d/1PPCIMds1RBXces430OeGF2D7mQWkrdyj/view)에 있다.

- **건강 데이터와 대화.** 대회에서는 본인이 동의해도 실제 개인정보·민감정보를 외부 AI에 입력하거나 전송할 수 없다. 심사용 AI 입력은 가상 인물의 수면·걸음 요약, 검사 응답, 대화로 구성한다. 현재 서버는 파일에서 계산한 요약과 자유 입력 대화를 받을 수 있어 제출 전 확인이 필요하다. 샘플로 시작한 뒤 심사자가 자기 이야기를 입력하는 경우도 포함한다. 화면 캡처·영상·개발 프롬프트에도 같은 기준을 적용한다. [클라이언트 전송](public/js/app.js) · [서버 전송](server.mjs)
- **심리검사.** 문항을 노출하거나 JSON을 배포하기 전에 한국어 판본의 이용 조건, 채점법, 출처를 확인한다. PHQ-9·GAD-2·GAD-7은 공개 한국어 양식을 기준으로 삼는다. PHQ-4는 사용한 한국어 문구의 출처를 밝힌다. PSS-4·AIS-8·BRS는 현재 한국어 전문을 공개 앱·저장소에 게재할 권리가 미확인이다. [검사별 판본과 이용 근거](research/06-screeners/sources.md)
- **랜딩과 결과 화면.** 걷기·수면 변화와 자가보고 점수가 무엇을 보여주는지 설명한다. 질환 진단, 발병 확률, 치료 효과를 약속하는 카피는 쓰지 않는다. 사용자에게 대화 시작 전에 AI 사용을 안내하고 AI가 작성한 리포트에 표시한다. 실제 이용자 데이터를 받는 버전을 공개할 때는 민감정보 처리 근거와 필요한 별도 동의, 보유·파기, 외부 위탁·국외이전 여부를 데이터 흐름에 맞춰 확인한다. [식약처 웰니스 판단기준](https://www.mfds.go.kr/brd/m_210/view.do?seq=15229) · [개인정보 보호법](https://www.law.go.kr/lsInfoP.do?lsId=011357) · [인공지능기본법 제31조](https://www.law.go.kr/LSW/lsLinkCommonInfo.do?chrClsCd=010202&lsJoLnkSeq=1031809497)
- **외부 서비스·자산.** Gemini를 사용할 때 연령·의학적 조언·입력 데이터 제한을 확인하고, 사용량 제한을 다른 키로 우회하지 않는다. 코드·데이터·폰트·이미지·문구는 사용 위치와 이용 근거를 기록한다. 행사 홍보에 시연 화면이 실릴 수 있으므로 참고한 랜딩페이지의 자산과 실제 커뮤니티 사연도 이 범위까지 이용할 수 있는지 확인한다. [Gemini 약관](https://ai.google.dev/gemini-api/terms) · [Google API 약관](https://developers.google.com/terms) · [참가자 동의 안내](https://drive.google.com/file/d/1oIm8tw7tXtPihtxrvdPc0QJvHlWxM5OF/view)
- **개발 이력과 제출.** 기존 저장소의 이용 권한과 과거 출품 이력을 확인한다. 종전 출품작과 실질적으로 유사하면 미수상·철회한 작품도 제출 제한 대상이다. 해커톤 전 작업과 기간 중 팀이 개발·검증한 부분, 개발용 AI와 서비스용 AI의 역할을 작업할 때부터 기록한다. 제출 설문과 소개서 지정 별첨에 반영하고, 마감 전 최종본을 링크와 이메일 양쪽에 제출한다. 마감 뒤에는 심사용 기능·알고리즘·프롬프트·데이터를 고정한다. 접속·인증정보·실행 환경 복구가 필요하면 사무국에 알리고 이력을 남긴다. [대회 안내문](https://drive.google.com/file/d/10w_EV3uv6lMtKyJMqNdANWlW3acgEssM/view) · [소개서 양식](https://drive.google.com/file/d/15gESCgdavnFcTF9xTV_3R2nZyhGbgC-P/view)

## Capabilities and Constraints

- Input: `export.zip` or `export.xml`, plus a built-in synthetic sample.
- Metrics (decided): sleep duration, sleep-onset regularity, daily steps, resting heart rate and HRV, workout frequency.
- Baseline (decided): the user's own past (days 15 to 90 before the latest record) versus the last 14 days. General norms only flag extremes.
- The current server can send a fixed prompt, derived summary lines and conversation text to Gemini. The hackathon demo must apply the input limits above to both chat and report generation.
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
