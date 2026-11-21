// PHQ-9, official Korean translation. Wording is copied verbatim from Pfizer's
// "PHQ-9 Korean for Korea" PDF (checked against the PDF on 2026-11-22).
// Do not edit the item or option wording: an edited form is no longer PHQ-9.
// Research: research/03-elicitation/REPORT.md § 1-3, § 2-3.

export default {
  id: 'phq9',
  name: 'PHQ-9',
  title: '환자 건강 질문지-9',
  pitch: '최근 2주 기분을 9문항으로 점검해요. 2분쯤 걸려요.',
  instruction: '지난 2 주일 동안 당신은 다음의 문제들로 인해서 얼마나 자주 방해를 받았습니까?',
  options: [
    { value: 0, label: '전혀 방해 받지 않았다' },
    { value: 1, label: '며칠 동안 방해 받았다' },
    { value: 2, label: '7 일 이상 방해 받았다' },
    { value: 3, label: '거의 매일 방해 받았다' },
  ],
  items: [
    '일 또는 여가 활동을 하는 데 흥미나 즐거움을 느끼지 못함',
    '기분이 가라앉거나, 우울하거나, 희망이 없음',
    '잠이 들거나 계속 잠을 자는 것이 어려움, 또는 잠을 너무 많이 잠',
    '피곤하다고 느끼거나 기운이 거의 없음',
    '입맛이 없거나 과식을 함',
    '자신을 부정적으로 봄 - 혹은 자신이 실패자라고 느끼거나 자신 또는 가족을 실망시킴',
    '신문을 읽거나 텔레비전 보는 것과 같은 일에 집중하는 것이 어려움',
    '다른 사람들이 주목할 정도로 너무 느리게 움직이거나 말을 함. 또는 반대로 평상시보다 많이 움직여서, 너무 안절부절 못하거나 들떠 있음',
    '자신이 죽는 것이 더 낫다고 생각하거나 어떤 식으로든 자신을 해칠 것이라고 생각함',
  ],
  // Item 9 (index 8): any answer >= 1 opens the crisis panel in code. The AI is not called.
  safetyItem: 8,
  // Developer bands (PHQ Instruction Manual). label_ko is our translation, not official wording.
  bands: [
    { min: 0, max: 4, label: '거의 없음' },
    { min: 5, max: 9, label: '가벼운 수준' },
    { min: 10, max: 14, label: '중간 수준' },
    { min: 15, max: 19, label: '약간 심한 수준' },
    { min: 20, max: 27, label: '심한 수준' },
  ],
  context: '한국 일반 인구 6,022명 연구에서는 5점 이상일 때 주요우울을 가장 잘 가려냈어요(Kim 외, 2023). 한국 19~29세 평균은 3.09점이에요(Shin 외, 2020). 선별 검사일 뿐 진단이 아니에요.',
  attribution: 'Pfizer Inc.로부터 교육용 지원금을 받아 Robert L. Spitzer 박사, Janet B.W. Williams 박사, Kurt Kroenke 박사와 동료들에 의해 개발된 것임. 복제, 번역, 전시 또는 배포를 위해 허가가 필요하지 않음.',
};

