# 도래 낚시터 A자리 그래픽 v0.3 통합

- 기준: `ccr-801640d2-hgzp2l` @ `c7cf01d111972ca7e03a843e579f5690d5033f5c`.
- 그래픽 원본: v0.3 `cbe76a49ddf0a81986392fd483fdefa86f7a5a76`. 배경·둑·수면·수중·바닥, 수초·돌, 3종 유영, 찌를 재사용했다. 낚시인 포즈만 256px 규격에 맞췄다.
- 포즈: 우향, 4행(대기, 던짐, 감기, 쉼) × 6프레임, 1536×1024 무손실 WebP. 각 셀 256×256, 발 기준 (128, 241), 낚싯대 끝 좌표도 함께 변환했다. 원본 비율과 화면 표시 크기를 보존했다.
- WebP 12장, 합계 328,750바이트. `/fishing-s1/a-v03/` 정적 파일로만 제공한다. 이미지가 빠지면 A자리도 기본 그림으로 표시한다.
- A의 2.5D/2D 화면만 변경한다. B/C 그림, 포획 로직, 저장과 이어하기, 생활 시계, 3D 장면/조작, 사운드는 기준 브랜치 그대로다. 구형 잔빛숲 패치는 적용하지 않았다.

## 로컬 재현

```sh
tools/farm-cooking-b/build.sh dist/fishing-art-review
node tools/farm-cooking-b/serve.mjs dist/fishing-art-review/fcb-main.mjs 8790 --assets dist/fishing-art-review/assets
```

별도 셸에서 (Playwright 및 Chromium 필요):

```sh
mkdir -p dist/fishing-art-review/qa
node tools/fishing-s1/qa/scene-art.cjs http://127.0.0.1:8790/ dist/fishing-art-review/qa pc
node tools/fishing-s1/qa/scene-art.cjs http://127.0.0.1:8790/ dist/fishing-art-review/qa m390
node tools/fishing-s1/qa/scene-art.cjs http://127.0.0.1:8790/ dist/fishing-art-review/qa m390-reduce
```

그래픽 검사는 좌표 이동 훅과 로컬 목재 3개 픽스처만 써서 이동 시간을 줄인다. 낚싯대 제작, 투척, 감기, 일시정지는 실제 화면으로 조작한다. 실기기 터치·프레임 시간과 새 3D 소품은 이번 변경 범위 밖이다.
