# 마음 시간표

Apple 건강 데이터로 지난 2주의 리듬을 평소의 나와 비교하고, 짧은 대화로 지금의 상태를 비춰 보는 웹 데모예요. 진단 도구가 아니에요.

## 실행

```bash
cp .env.example .env   # GEMINI_API_KEY를 채워요. 비워 두면 정해진 대본으로 응답하는 데모 모드
npm start              # http://localhost:8787
```

## 구조

- `public/js/parse.js`: export.zip 또는 export.xml을 브라우저 안에서 스트리밍으로 읽어요.
- `public/js/metrics.js`: 평소(15~90일 전)와 최근 14일을 비교해 요약 숫자를 만들어요.
- `public/js/prompt.js`: AI에게 가는 고정 지시문과 응답 형식. 화면의 "AI에게 가는 내용"에도 그대로 보여요.
- `public/js/safety.js`: 위기 신호는 AI가 아니라 고정 규칙이 처리해요. AI의 답도 금지 표현(칼로리, 약 용량, 진단명 등)이 있으면 고정 문구로 바꿔요.
- `public/spec/metrics.js`: 지표마다 근거 강도, 연구 숫자, 하지 않을 말, 측정 오차 범위. 프롬프트와 리포트 카드가 같이 읽어요.
- `public/spec/tests/`: 짧은 검사 등록부. 지금은 PHQ-9(공식 한국어판 문구 그대로) 하나. 대화 중 AI가 제안 칩을 띄우거나, 입력창에 `/`를 치면 열려요. 9번 문항에 1점 이상이면 AI를 부르지 않고 위기 안내가 떠요.
- `research/`: 리서치 4갈래 보고서와 출처. 숫자는 원문에서 확인한 것만 써요.
- `server.mjs`: 정적 파일을 서빙하고 Gemini 호출을 대신해서 API 키를 숨겨요.
- `scripts/make-sample.mjs`: 가상 사용자 데이터 생성기. 샘플의 모든 값은 지어낸 값이에요.
