# 시연 영상 플레이북

Herz 해커톤 시연 영상(2026-11-23 제출)을 만든 방법과, 다음 프로젝트 데모에 가져갈 교훈이에요.
제출본은 [`submitted/herz-demo.mp4`](submitted/herz-demo.mp4)예요. 107초, 1752×1080, 60fps, H.264와 AAC예요.

## 폴더

| 경로 | 내용 |
|---|---|
| `kit/` | 어떤 데모에도 쓰는 도구: 실제 OS 커서와 키 입력(`input.ahk`), 데모용 Chrome 띄우기(`launch.sh`, `start.sh`, `place.ahk`), 음악 늘이기(`music_loop.py`), 합성 음악(`lofi.py`), 스크립트 복사(`sync.sh`) |
| `herz/` | Herz 전용: 랜딩 장면(`director.mjs`), 폰 장면(`phone.mjs`), 자막(`captions.py`), 최종 합성(`final.sh`), 엔딩 카드(`end-card.html`) |
| `submitted/` | 제출한 영상 |

촬영본, 음악 원본, 중간 산출물, 데모용 Chrome profile은 git 밖의 미디어 폴더에 있어요.

```text
C:\Users\<you>\Videos\herz-demo      (WSL: /mnt/c/Users/<you>/Videos/herz-demo)
  landing-B.mp4, phone.mp4          촬영본
  *.openscreen, *.marks.json        Openscreen 프로젝트와 장면 경계 시각
  tranquil-pulse.mp3, lofi-full.wav 음악 원본
  end-card.png                      엔딩 카드 이미지
  phone-cap.mp4, music-fit.wav      중간 산출물
  herz-demo-final.mp4               final.sh 출력 (제출본과 같은 파일)
  profile/                          로그인된 데모용 Chrome profile
  _scratch/                         테스트 촬영본, 옛 스크립트, 로그
```

이 Videos 폴더는 OneDrive와 연결된 Windows의 "동영상" 폴더가 아니에요. 일반 폴더라서 클라우드로 동기화되지 않아요.

## 흐름

```text
kit/sync.sh → kit/start.sh → node herz/director.mjs rec → node herz/phone.mjs rec → herz/final.sh
 스크립트 복사    Chrome 띄우기     랜딩 장면 촬영              폰 장면 촬영           자막·음악·합성
```

1. **스크립트 복사.** Windows `node.exe`와 AutoHotkey는 repo가 아니라 미디어 폴더에서 스크립트를 읽어요. repo에서 고친 뒤에는 꼭 복사하고, 미디어 폴더의 복사본은 고치지 않아요.
   ```bash
   demo-video/kit/sync.sh /mnt/c/Users/<you>/Videos/herz-demo demo-video/herz
   ```
2. **Chrome 띄우기.** `start.sh`는 로그인된 profile을 그대로 두고 Chrome을 다시 띄워요. `launch.sh`는 profile을 지우고 새로 만들어요. 둘 다 CDP 포트 9333을 열고, `place.ahk`로 창을 GlazeWM 밖에 2880×1620으로 띄워요. 다른 미디어 폴더를 쓰려면 `DEMO_DIR`을 지정해요.
3. **촬영.** 각 장면 스크립트는 `dry`(연습)와 `rec`(녹화) 모드가 있어요. 커서와 키는 `input.ahk`가 실제 OS 입력으로 보내고, 페이지 상태는 CDP로 읽고, 녹화는 Openscreen CLI가 해요. 장면 경계 시각은 `*.marks.json`에 남아요.
4. **합성.** `final.sh`가 폰 장면에 자막 네 개를 입히고(`captions.py`), 음악을 영상 길이에 맞추고(`music_loop.py`), 랜딩, 폰 장면, 엔딩 카드를 크로스페이드로 이어요.

## 피드백에서 배운 것

- **손동작은 눈으로 따라갈 수 있을 만큼 느리게.** 처음 찍은 커서는 너무 빨랐어요. `input.ahk`의 `glide`는 빠르게 출발해서 부드럽게 도착하고, 거리가 멀수록 오래 걸려요. 화면 전환 사이에도 쉬는 시간을 둬요.
- **배속은 정보 없는 손동작에만.** 퀴즈 답 클릭처럼 반복되는 동작만 빠르게 해요(`tapFast`, 3배). AI의 생각 중 표시("…")와 대본 입력은 원래 속도로 둬요. 기다림 자체가 제품 경험이에요.
- **애니메이션은 끝날 때까지 기다리기.** 샘플 인물을 고르면 두 구절에 밑줄이 약 1초 동안 그려져요. 다음 버튼을 누르기 전에 1.15초 머물러야 영상에 남아요.
- **입력할 때는 확대를 유지하기.** 질문과 입력창을 함께 확대한 채로 타이핑해야 무엇을 쓰는지 읽혀요.
- **같은 장면은 매번 같게.** 퀴즈 시드를 고정해서 다시 찍어도 같은 문항이 나와요.
- **음악 이음새는 파형이 맞는 곳에서.** 곡이 영상보다 짧으면 `music_loop.py`가 뒤따르는 소리가 거의 같은 두 지점을 찾아 되감아요. 곡 끝의 페이드아웃 구간에서 자르면 볼륨이 꺼져요.
- **글꼴은 설치된 것을 확인하기.** 자막은 Noto Sans CJK를 써요. 이 WSL에는 맑은 고딕이 없었어요.

## 출처

- 음악: Pixabay 'Tranquil Pulse' (Pumpupthemind), Pixabay Content License
- 발표 자료: [`docs/presentation/`](../docs/presentation/)
