<p align="center">
  <img src="docs/readme/banner.jpg" alt="Herz" width="100%">
</p>

<p align="center">
  <a href="https://maeum-mirror.vercel.app/?view=phone"><img src="https://img.shields.io/badge/demo-maeum--mirror.vercel.app-d9481c?style=flat-square" alt="데모"></a>
  <img src="https://img.shields.io/badge/Node.js-%3E%3D18-5fa04e?style=flat-square&logo=nodedotjs&logoColor=white" alt="Node.js 18 이상">
  <img src="https://img.shields.io/badge/Gemini_API-8e75b2?style=flat-square&logo=googlegemini&logoColor=white" alt="Gemini API">
  <img src="https://img.shields.io/badge/Vercel-000000?style=flat-square&logo=vercel&logoColor=white" alt="Vercel">
  <img src="https://img.shields.io/badge/build-none-17171a?style=flat-square" alt="빌드 단계 없음">
</p>

<h1 align="center">Herz</h1>

<p align="center">AI 에이전트가 흩어진 생활 기록을 통해 변화를 파악, 심리 상태를 분석 및 추적하는 서비스</p>

<p align="center">
  <a href="https://maeum-mirror.vercel.app/?view=phone">데모</a> ·
  <a href="docs/submission/INTRO.md">서비스 소개서</a> ·
  <a href="docs/hackathon-2026/README.md">대한상공회의소 AI 해커톤 공고</a> ·
  <a href="research/README.md">조사 자료</a>
</p>

## 무엇을 하나요

Herz는 Apple 건강 기록에서 최근 2주와 평소의 나를 비교하고, 달라진 부분을 대화로 함께 짚어 봐요.

1. Apple 건강 `export.xml`을 올리거나 가상 사용자 샘플을 골라요. 파일은 브라우저 안에서만 읽어요.
2. 수면, 걸음, 안정 시 심박과 심박 변이도, 운동을 평소(15~90일 전)와 최근 14일로 나눠 비교해요.
3. 가벼운 퀴즈로 대화를 열어요.
4. 평소와 달라진 지표마다 이유를 묻고, 그 답의 이유를 한 번 더 물어요. 자유 답변은 지표를 움직이는 단서가 돼요.
5. 점수는 검증된 검사지로만 매겨요. 지금 TIPI, SWLS, Flourishing Scale, SPANE, MLQ, CBI, PHQ-9, PHQ-2, PHQ-4, GAD-7, GAD-2 11종이 열려 있어요.
6. 대화와 검사 결과를 묶어 마음 프로필 리포트로 보여 줘요.

<p align="center">
  <img src="docs/readme/architecture.png" alt="Herz MVP 서비스 아키텍처: 브라우저에서 건강 기록을 파싱하고, Vercel 서버리스 함수가 대화와 지표 요약만 Gemini API로 보내요. DB는 없어요." width="100%">
</p>

Vercel 하나로 화면과 API를 함께 배포해요. 별도 DB와 로그인은 없어요. 건강 기록 원본은 서버로 보내지 않고, 대화와 지표 요약만 `/api/chat`을 거쳐 Gemini API로 가요. 그림 원본은 [`docs/readme/architecture.html`](docs/readme/architecture.html)에 있어요.

## 실행

Node.js 18 이상이 필요해요. 빌드 단계는 없어요.

```bash
cp .env.example .env   # GEMINI_API_KEY를 채워요. 비워 두면 정해진 대본으로 응답하는 데모 모드
npm start              # http://localhost:8787
```

```bash
npm test               # lint와 node --test test/
npm run sample         # 가상 사용자 데이터 다시 만들기
```

배포 방법과 설정 이유는 [`docs/submission/DEPLOY.md`](docs/submission/DEPLOY.md)에 있어요. GitHub에 푸시해도 배포되지 않아요. 배포는 Vercel CLI로 해요.

## 구조

```text
.
├── public/                 정적 화면. Vercel이 그대로 서빙해요
│   ├── index.html
│   ├── js/
│   │   ├── parse.js        export.xml을 브라우저 안에서 스트리밍으로 읽어요
│   │   ├── metrics.js      평소와 최근 14일을 비교해 요약 숫자를 만들어요
│   │   ├── change-talk.js  달라진 지표마다 이유를 두 번 묻는 2단계 대화
│   │   ├── prompt.js       AI에게 가는 고정 지시문과 응답 형식
│   │   ├── safety.js       위기 신호와 금지 표현을 고정 규칙으로 처리해요
│   │   └── ...
│   ├── spec/metrics.js     지표별 근거 강도, 연구 숫자, 하지 않을 말
│   ├── tests/              검사지 JSON과 공개 여부 index.json
│   └── sample/             가상 사용자 샘플
├── api/                    Vercel 서버리스 함수 (chat.js, status.js)
├── lib/chat.mjs            Gemini 호출과 모델 폴백. api/와 server.mjs가 같이 써요
├── server.mjs              로컬 서버. 정적 파일 서빙과 /api 중계
├── spec/                   대화와 리포트 규칙, 검사 원문 정리
├── test/                   node --test 테스트
├── testbed/                가상 페르소나로 대화를 돌려 보는 실험대
├── research/               조사 보고서와 출처
├── docs/                   결정 기록, ADR, 제출 문서
└── scripts/                샘플 생성기와 lint
```

## 문서 지도

| 문서 | 내용 |
|---|---|
| [`PRODUCT.md`](PRODUCT.md) | 사용자, 목적, 제약, 해커톤 기준 |
| [`GLOSSARY.md`](GLOSSARY.md) | 이 저장소에서 쓰는 용어 정의 |
| [`docs/decisions-2026-11-22.md`](docs/decisions-2026-11-22.md) | 방향을 바꾼 결정과 이유 |
| [`docs/adr/`](docs/adr/) | 설계 결정 기록 (ADR) |
| [`spec/conversation-to-report.md`](spec/conversation-to-report.md) | 대화에서 리포트로 가는 규칙 |
| [`spec/walking-sleep.md`](spec/walking-sleep.md) | 걸음과 수면 측정 규칙 |
| [`testbed/DEMO-CHECKLIST.md`](testbed/DEMO-CHECKLIST.md) | 페르소나 실험대의 시연 점검표 |
| [`docs/submission/INTRO.md`](docs/submission/INTRO.md) | 서비스 소개서 계획 |
| [`docs/hackathon-2026/`](docs/hackathon-2026/) | 공식 공고와 첨부 PDF |

## 근거와 연구

화면과 프롬프트에 쓰는 숫자는 원문에서 확인한 것만 써요. 조사 방식과 출처 표기 규칙은 [`research/README.md`](research/README.md)에 있어요.

| 갈래 | 질문 | 보고서 |
|---|---|---|
| 01-youth-mind | 20대와 30대 초반이 실제로 겪는 일 | [검사를 찾는 이유](research/01-youth-mind/test-user-needs.md) · [MBTI와 유전자 검사가 퍼진 이유](research/01-youth-mind/test-popularity-korea.md) |
| 02-ai-counseling | AI 상담과 가상 에이전트 선행 연구 | [REPORT](research/02-ai-counseling/REPORT.md) |
| 03-elicitation | 검사와 면담이 마음을 여는 방식 | [REPORT](research/03-elicitation/REPORT.md) |
| 04-body-to-mind | 웨어러블 데이터로 기분에 대해 말할 수 있는 것과 없는 것 | [REPORT](research/04-body-to-mind/REPORT.md) |
| 05-report-form | 전문 리포트의 문법 | [REPORT](research/05-report-form/REPORT.md) |
| 06-screeners | 짧은 심리검사와 응답에 따른 확장 | [REPORT](research/06-screeners/REPORT.md) · [이용 조건](research/06-screeners/sources.md) |
| 06-screening-practice | 우울, 불안, 회복탄력성 척도의 현장 사용 | [REPORT](research/06-screening-practice/REPORT.md) |
| 07-walking-sleep | 걸음과 수면으로 대화를 시작하는 근거 | [REPORT](research/07-walking-sleep/REPORT.md) |
| 08-similar-services | 유사 서비스 15개 비교 | [REPORT](research/08-similar-services/REPORT.md) · [출처](research/08-similar-services/sources.md) |

## 안전 장치

- 위기 신호는 AI가 아니라 고정 규칙이 처리해요. 자해 신호가 보이면 109(자살예방상담)와 1577-0199(정신건강위기상담)를 안내해요. [`public/js/safety.js`](public/js/safety.js)
- PHQ-9 9번 문항에 1점 이상이면 AI를 부르지 않고 위기 안내를 띄워요.
- AI 답에 금지 표현(칼로리, 약 용량, 진단명 등)이 있으면 고정 문구로 바꿔요.
- AI는 지표 변화량 숫자를 직접 쓰지 않아요. 단서 항목과 방향만 돌려주고, 크기는 코드가 정해요.
- 이름, 나이, 성별을 받지 않아요. 시연 데이터는 모두 가상 사용자예요.

## 외부 자원과 출처

기준일 2026-11-23.

| 구분 | 자원 | 제공처 | 이용 조건 | 용도 |
|---|---|---|---|---|
| AI API | Gemini API (`gemini-3-flash-preview`, 폴백 순서는 [`lib/chat.mjs`](lib/chat.mjs)) | Google | [Gemini API 추가 약관](https://ai.google.dev/gemini-api/terms). 무료 쿼터 입출력은 Google 제품 개선에 쓰일 수 있어서, 시연은 가상 사용자 데이터만 써요 | 대화, 단서 읽기, 요약 |
| 플랫폼 | Vercel (Hobby) | Vercel Inc. | [이용약관](https://vercel.com/legal/terms). Hobby는 비상업 용도 | 배포 |
| 폰트 | [Pretendard](https://github.com/orioncactus/pretendard) v1.3.9 | 길형진 | SIL OFL 1.1 | 화면 글꼴 |
| 검사 | PHQ-9, PHQ-2, PHQ-4, GAD-7, GAD-2 한국어판 | Spitzer, Williams, Kroenke 외 | [phqscreeners.com](https://www.phqscreeners.com). 허가 없이 복제와 배포 가능 | 우울과 불안 선별 |
| 검사 | TIPI 한국어판 | Gosling 외 | 목적 제한 없이 사용 가능 | 성격 |
| 검사 | SWLS, Flourishing Scale, SPANE 한국어판 | Ed Diener 외 | 비상업 사용만 허용, 저자 표기 필수 | 삶의 만족, 번영, 정서 |
| 검사 | MLQ 한국판 | Michael F. Steger | 교육, 치료, 학술 목적 무료 | 삶의 의미 |
| 검사 | CBI 개인 소진 (CBI-K) | Borritz 외, Jeon 외 | 출처 명시 조건으로 무료. CBI-K 논문은 [CC BY 4.0](https://doi.org/10.1371/journal.pone.0221323) | 번아웃 |
| 데이터 | 한국 일반 인구 PHQ-9 분포 | Kim 외 (2023) | [논문 인용](https://pubmed.ncbi.nlm.nih.gov/37794667) | 상대 위치 표시 |
| 데이터 | 가상 사용자 건강 기록 | 팀 직접 생성 | 실제 개인정보 없음 | 시연 |

검사별 판본과 이용 근거는 [`research/06-screeners/sources.md`](research/06-screeners/sources.md)에 있어요.
