# 흙별 농장+요리 B안 — 작업 기록 (2026-11-23)

기준선: Worker v38 모듈 `release/v38/main.mjs` (24,939,305B, SHA-256 `78b4503a…c60ed07`).
브랜치: `feat/farm-cooking-b-20261123`. 모아가 Gate 1~3을 Drive 번들로 독립 검증한 뒤, 알돌 결정(모아 전달, 2026-11-23 13:03)으로 공개 레포에 푸시하고 Draft PR을 열었다. 병합·Ready 전환·배포는 알돌 승인 전까지 하지 않는다.

## v44 재구성 + CPU 한도 대책 (2026-11-23 밤, 알돌 결정 — 모아 전달 22:56)

라이브가 게임 버전 v44가 되어(배포 카운터는 v45지만, 서빙 내용 기준), 농장·요리를 v44 위에 다시 얹었다. 기준선은 `release/v44/main.mjs`(25,067,606B, SHA-256 `0951ddf7…ecd4c3`, HTML SHA `3caaa6c3…`)이다. 모아가 라이브 엔드포인트에서 받은 서빙 스크립트이며, Drive 청크 10개를 재조립해 SHA를 확인했다(`qa/v44/gate1.log`).

**v44에 맞춘 패치 변경** (패치 기준 문자열 5개가 v44에서 바뀌어, 그 부분만 버전별로 분기 — 나머지는 공통)
- 농장 HUD: v44는 HUD를 간소화했다(씨앗 수는 씨앗 버튼에, 머리에 프로필·메뉴, 좌표·부제·출구 버튼 제거). 그래서 기력 `⚡ 83/100`과 수확물 `🧺 밀·감자·당근` 칩, 가방 버튼을 프로필·메뉴 앞에 붙였다. 수확물 칩의 이름은 title/aria-label에 넣었다.
- 농장 나가기: v44에는 출구 버튼이 없다. 서쪽 출구에서 행동 버튼 / 출구 탭 / Esc로 나간다(v44 원본 그대로).
- 대장간 안내 문구, `closeModal`(v44의 NPC 음성 정지)에 맞춰 요리대 대상 추가와 장면 정리 위치를 옮겼다.

**CPU 한도 대책 — GLB를 모듈 밖으로**
- GLB 3종을 Worker 모듈에서 빼서 Cloudflare Workers Static Assets로 낸다. `build.sh`가 `<빌드>/assets/fcb/glb/<이름>-<SHA8>.glb`와 `_headers`(model/gltf-binary, 1년 immutable)를 만든다(`stage-static-assets.py`).
- 경로는 그대로 `/fcb/glb/…`이고, 페이지는 요리대를 열 때만 받아 크기·SHA-256를 확인한다(기존과 같음).
- 모듈에 GLB base64가 남으면 빌드가 실패한다. 이전 방식(모듈에 넣기)은 `--glb inline`으로 남겼다.
- 배포 명령에 `--assets <빌드>/assets`가 추가된다(테스트 Worker 예: `wrangler deploy fcb-main.mjs --name <테스트이름> --compatibility-date 2026-11-18 --no-bundle --assets assets`). 로컬 미리보기는 `serve.mjs <모듈> <포트> --assets <빌드>/assets`이다(정적 에셋 우선 → 없으면 Worker).
- `sceneProbe`·`sceneFocus`를 `--qa` 빌드로만 옮겼다. 기본 빌드에서는 빌드 검사와 Gate 5·훅 없는 흐름에서 없음을 확인한다.

| 산출물 | 명령 | 결과 |
| --- | --- | --- |
| 운영 후보 (QA 훅 없음) | `build.sh` (기본 `--base v44 --glb static`) | 워커 `fcb-main.mjs` SHA-256 `2c2161739d80b985e8eb0a8831396dd4ec1d7b71626d9b2cddcff0defbfa4bc1` (25,152,066B, v44 대비 +84,460B) + `assets/` GLB 3개 1,020,308B |
| 로컬 QA 빌드 | `build.sh --qa` | 워커 SHA-256 `2909f64759da3b44000ddb75629514649b6ae303f48aab6493d4784e096ee9fb` |

**v44 검증** (`qa/v44/`, 로컬 프리뷰, 정적 에셋 포함, 모두 종료 코드 0)
- Gate 1: 청크 10개 + 합본 SHA 일치.
- QA 빌드: Gate 2 92/92, Gate 3 60/60, Gate 4 36/36. Gate 4에는 GLB 응답 헤더(model/gltf-binary + immutable)와 모듈 안 GLB 없음이 추가됐다.
- 운영 후보: Gate 5 51/51(v44 원본 대비), 훅 없는 흐름 PC 26/26 · 모바일 27/27.
- Gate 5 스크립트 수정 2건: v44에 맞춘 시험 경로이며 판정 완화가 아니다.
  - 마을 메뉴 버튼(`#town25dMenu`)이 없어져 긴급 구조를 ☰ 메뉴 → 설정 → 긴급 구조로 찾는다.
  - v44 원본은 마을 하단 조작 안내 줄을 없앴다. 그래서 '원본에 줄이 없으면 원본과 같을 것 + 터치에서 PC 키 없음'으로 판정한다.
- 시작 시간(로컬 대용, `startup-time.log`, 21회 번갈아): v44 873ms · 후보 895ms · 같은 소스 inline 876ms(중앙값). 로컬에서는 세 모듈이 잡음 범위라 GLB 분리의 효과를 판별할 수 없다. **Cloudflare 테스트 Worker cold start 확인은 모아에게 요청 예정**(이 컨테이너에는 Cloudflare 자격증명이 없음).
- 기록 정정: 게이트 스크립트가 로그 파일을 직접 쓰는데 같은 파일에 표준출력도 붙여 써서, v41·v44 Gate 2~4 로그의 첫 줄(빌드 SHA 머리말)이 지워지고 NUL 바이트가 끼어 있었다. NUL을 지우고 머리말을 다시 넣었다(결과 줄은 그대로). 이후로는 표준출력을 다른 파일로 보낸다.

## v41 합본 (2026-11-23 15시대, 모아 인계 — PR #13 v39 후보는 보류)

운영이 Worker v41(Cloudflare `8b55cd67-1c76-4d75-ab1e-40ee437727d3`, 14:44 KST 배포)로 바뀌어 농장·요리를 v41 위에 다시 얹었다. v41 = v40(v39 + 잔빛 벌목장 `lumber_01`, P1~P15) + P16(`lumberWorldInitState()` 상태 유지 수정). 공개된 v40/v41 패치 스크립트가 없어 모듈 파일 자체를 기준선으로 쓴다: `release/v41/main.mjs` (25,062,108B, SHA-256 `7da5888c…a4ba5c3`, HTML SHA `20034576…`). Drive 청크 10개를 받아 재조립했다(`qa/v41/gate1.log`).

| 산출물 | 명령 | fcb-main.mjs SHA-256 |
| --- | --- | --- |
| 운영 후보 (QA 훅 없음) | `build.sh` (기본 `--base v41`) | `3b36af90b2bb9525b574f4d2c49132d4f943139db1592fd27c31ed1e37d683ff` (26,507,300B, v41 대비 +1,445,192B) |
| 로컬 QA 빌드 | `build.sh --qa` | `70541b827b3ddbaf51b3e841d097065faf9fd120a03bd6b6111d68639852531a` |

- 패치 기준 문자열 46개가 v41에서도 모두 한 번씩 일치했다. 패치 코드 변경은 허용 기준선에 v41 HTML SHA를 추가한 것뿐이다.
- 벌목장의 '활력'은 나무 군락의 값(군락별 3→0, 고갈되면 180초 페널티)이고, 플레이어 '기력'(`livingP0.energy`)과는 다른 값이다. 벌목은 기력을 쓰지 않는다(Gate 5에서 확인).
- v41 검증 로그는 `qa/v41/`에 있다.
  - Gate 1: 청크 10개 + 합본 SHA 일치, `node --check` 통과.
  - QA 빌드: Gate 2 92/92, Gate 3 60/60, Gate 4 34/34.
  - Gate 5 51/51 (v41 원본 대비 기본 빌드):
    - Phase 0 회귀, 유적 진입·복귀, 채굴 보호 18칸이 원본과 같음, X46 첫 채굴, 숲 첫 진입 점프 안내.
    - 신규: 벌목장 진입·군락 A 활력 3→2→1→0·고갈 페널티·4번째 차단·묘목·저장 유지·숲 복귀가 원본과 필드별로 같음.
    - 신규: v41에서 만든 세이브(벌목 진행 포함)가 이 빌드에서 그대로 열리고 다시 저장해도 같음.
    - QA 훅 미노출, v38 세이브 복구, 에러 0.
- 배포 전 추가 확인 (이온 지적: Gate 2~4는 QA 훅 빌드 기준이었음):
  - **훅 없는 흐름** `qa/v41/nohook-pc.log` 26/26, `nohook-m390.log` 27/27 (`tools/farm-cooking-b/qa/nohook-flow.cjs`). 운영 후보 `3b36af90…`(QA 훅 없음)에서 시간 건너뛰기 없이 실제 게임 시계로 돌렸다:
    - 밀·감자·당근 심기 → 물 → 2단계 → 물 → 3단계까지 82~88초, 이어서 수확(각 +3).
    - 요리대에서 빵·수프를 만들고, 스튜는 '물고기 1개 더 필요'로 막힘. 빵을 먹어 기력 +25.
    - 새로고침 후 요리·작물·카운터 유지, 모바일 넘침 0, 에러 0.
  - PC는 실제 방향키로 걸었다. 모바일 390은 버튼을 모두 탭으로 눌렀지만, 위치 이동만 v41 원본에 있는 위치 훅(`__sandstarTown25D.move`, `__sandstarFarmWorld.testMove`)을 썼다(조이스틱 드래그 대신).
  - **시작 시간(로컬 대용)** `qa/v41/startup-time.log` (`startup-time.mjs`): 새 Node 프로세스에서 모듈을 import하는 시간을 21회 번갈아 쟀다. v41 중앙값 915ms, 합본 902ms, 비율 0.986, 최솟값 793 vs 806ms. 첫 `/` 응답은 115 vs 113ms. 로컬에서는 차이가 잡음 범위다. Cloudflare 측정과 같은 조건이 아니므로 한도 통과를 보장하지 않는다.
- v41 미해결:
  1. 배포 시작 CPU: v41은 첫 배포 때 Cloudflare `Script startup exceeded CPU time limit [10021]`에 걸렸고, 재시도로 통과했다(541ms). 이 빌드는 GLB base64 때문에 약 1.4MB 더 크다. 로컬 대용 측정에서는 차이가 없었지만(위), Cloudflare에서 실제로 확인하려면 배포·프리뷰 업로드가 필요해 알돌 승인 사항이다. 대안은 GLB를 모듈 밖(정적 자산)으로 옮기는 것이다.
  2. v41 원본의 벌목 코드는 `livingP0.bag.wood`·`livingP0.stats.cut`에 쓰려고 하지만, 전역 `livingP0` 변수가 없어(정본은 `game.livingP0`) 그 쓰기는 실행되지 않는다. 목재는 `game.inv.wood`로만 들어간다. 이번 변경과 무관하고 손대지 않았다(모아 쪽 판단 필요).
  3. 실기기 터치 확인과 Cloudflare 프리뷰 배포는 하지 않았다(로컬 Playwright만).

## v39 합본 (2026-11-23 오후, 알돌 결정 — 모아 전달)

운영이 Worker v39(PR #12, v38 + `tools/onboarding/patch-v38.py`, 모듈 SHA `c28b2b61…`, Cloudflare `066dc5dc-cb98-400c-ae57-ef49e6410e8c`)로 바뀌어, 농장·요리를 v39 위에 다시 얹었다. PR #12 브랜치(`fix/first-mining-route` @ `51215b5`)를 이 브랜치에 병합했다.

| 산출물 | 명령 | fcb-main.mjs SHA-256 |
| --- | --- | --- |
| 운영 후보 (QA 훅 없음) | `build.sh --base v39` | `b8d86f70c9c164fc5e780940b94aefc573c2922f0717c8a56fa0cc2f76cc500c` (26,385,303B) |
| 로컬 QA 빌드 | `build.sh --base v39 --qa` | `39e987ff04758d081b8b3e1e08fd74ce066d3d17128e63ec7e2fdae67bbcc621` |

- 테스트 훅(시간 건너뛰기 `advance`, `setSceneMode`)은 호스트명 조건을 없애고 `--qa` 빌드에만 넣는다. 기본 빌드는 빌드 단계에서 훅 문자열이 없음을 검사하고, Gate 5에서 런타임에도 노출되지 않음을 확인했다(이온 의견).
- 2.5D 스틸은 three.js 렌더를 유지한다(이온 의견). 실제 게임 크기에서 어긋나는 컷만 Blender로 다시 뽑는다.
- v39 검증 로그: `qa/v39/`
  - Gate 2 92/92, Gate 3 60/60, Gate 4 34/34 (QA 빌드)
  - Gate 5 40/40 (v39 원본 대비 기본 빌드): Phase 0 회귀, 유적 진입·복귀, 채굴 보호 18칸(X31~45, X54~56) 원본과 동일, X46 첫 채굴, 숲 첫 진입 점프 안내, QA 훅 미노출, v38 세이브(채굴 기록·코인·자라던 밭) 복구, 에러 0
- 아래 v38 기준 결과(`qa/*.log`)는 참고 기록이다.

## 빌드

```sh
tools/farm-cooking-b/build.sh                     # 운영 후보 (기본 --base v44, GLB는 정적 에셋): dist/farm-cooking-b-v44/{fcb-main.mjs,assets/} (gitignored)
tools/farm-cooking-b/build.sh --qa                # 게이트용 QA 빌드: dist/farm-cooking-b-v44-qa/
tools/farm-cooking-b/build.sh --base v41 --glb inline   # 보류된 v41 방식
tools/farm-cooking-b/build.sh --base v39          # 보류된 v39 후보 (PR #13 기존 결과 재현용)
node tools/farm-cooking-b/serve.mjs dist/farm-cooking-b-v44-qa/fcb-main.mjs 8743 --assets dist/farm-cooking-b-v44-qa/assets   # 로컬 프리뷰
```

`build.sh`는 v38 SHA를 확인하고, `--base v41`(기본)이면 `release/v41/main.mjs`의 SHA `7da5888c…`를 확인해 그대로 기준선으로 쓴다. `--base v39`이면 PR #12 스크립트로 v39 모듈을 만든 뒤 SHA `c28b2b61…`를 확인한다. 이어서 HTML을 추출하고(`tools/phase0-v38/extract-html.mjs`), `patch-farm-cooking.py`로 패치합니다. 패치는 정확히 1회 일치하는 문자열만 치환하고, 하나라도 어긋나면 쓰기 전에 중단합니다. 그다음 `rebuild-worker.py`로 HTML 상수만 바꿔 워커를 재조립하고, 모듈과 인라인 스크립트 문법을 검사합니다. 배포·업로드는 하지 않습니다.

## 게이트 현황

| 게이트 | 상태 | 근거 |
| --- | --- | --- |
| 1 기준선 | 통과 | `qa/gate1.log` — 청크 3개 + 합본 SHA 일치, 종료 코드 0. Cloudflare v38 버전 ID `052cb034-a10f-49fa-b6c3-4cafd2d7ede9`는 모아 측 대조값(이 세션에서 직접 조회하지 않음) |
| 2 농장 루프 | 통과 92/92 | `qa/gate2.log` — PC 1280×800 + 모바일 390×844 (Gate 4 빌드 `bab291a8…`에서 재실행) |
| 3 요리 | 통과 60/60 | `qa/gate3.log` — PC + 모바일 390 (Gate 4 빌드에서 재실행) |
| 4 하이브리드 연출 | 통과 34/34 | `qa/gate4.log` — PC 3D lazy-load·회전·전환·폐기, GLB 차단/변조 시 2.5D 폴백, 모바일 390 2.5D·넘침 0 |
| 5 회귀 | 통과 31/31 | `qa/gate5.log`, `qa/gate5-results.json` — v38 원본과 같은 시드로 같은 시나리오를 돌려 필드별 비교: P0-1~P0-6(+0b), 유적 걷기 진입·복귀(PC·모바일), 전체 지도 라벨 동일(요리대 라벨 추가 없음), 콘솔·페이지 에러 0, 실패 요청 0 |
| 6 PR | Draft PR | 모아 Gate 1~3 독립 검증 완료(Drive 번들 `aad9bc4`). 병합·Ready 전환·배포는 하지 않음 |

(위 표는 v38 기준 결과. v39 합본 결과는 위 "v39 합본" 절과 `qa/v39/`.)

## 쓴 수치 (알돌 조정용, 모두 `patch-farm-cooking.py` 한 곳에 있음)

| 항목 | 값 |
| --- | --- |
| 성장 | 물 1회당 1단계, 3단계 (s1 심은 직후 → s2 → s3 수확 가능). 마른 밭은 진행 없음. 한 단계가 오르면 다시 마름 |
| 단계당 성장 시간 (월드 시간) | 밀 30초 · 당근 35초 · 감자 40초 |
| 수확량 | 작물 3개 + 씨앗 1개 반환 (v38 기존 값 유지, 농사 보너스 시 +1) |
| 시작 씨앗 | 밀·감자·당근 각 3 (v38 기존 값) |
| 기력(신규, 알돌 승인 2026-11-23) | 최대 100, 12초마다 1 자연 회복 |
| 기력 소모 | 심기 4 · 물주기 2 · 수확 4 (한 사이클 12) |
| 요리 | 빵 밀×2 · 당근수프 당근×2 · 생선스튜 물고기(3종 아무거나)×1+감자×1, 원목 연료 없음 |
| 회복량 | 빵 +25 · 당근수프 +35 · 생선스튜 +50 (최대 100) |
| 식사 보너스 | v38 기존 유지: 월드 시간 180초 (빵 농사·수프 벌목·스튜 낚시) |
| 요리대 위치 | 2.5D 마을 (x −3.4, z −6.0), 바람장터와 상인 마루의 동쪽 |

## Gate 4 — 요리 장면 2.5D + 3D 하이브리드

| 구성 | 내용 |
| --- | --- |
| 3D 재료 | `assets/glb/` 3종 (밀 `crop-c073` · 감자 `crop-c047` · 당근 `crop-carrot`, 합계 1,020,308B, tris 3,868~4,167). 794개 중 이 3개만 사용 |
| 물고기 | 맞는 GLB 없음 → P5 2D 스프라이트(피라미) |
| 2.5D | `assets/fcb-renders/*-3q.png`: 같은 GLB를 게임 내장 three r160으로 3/4 시점(요 45°, 고도 30°) 렌더 후 물체에 맞춰 128px로 자름 (`render-stills.cjs`). Blender 렌더가 오면 같은 파일명으로 바꾸면 됨 |
| 3D 로더 | v38에 이미 들어 있는 `window.THREE`(r160)·`window.GLTFLoader`를 재사용 (유적 `archThreeLoadGlbs`와 같은 `loader.parse` 방식). 유적의 `archThree` 렌더러·씬은 유적 캔버스에 묶여 있어 재사용하지 않고, 요리대 전용 112px 렌더러를 따로 만듦 |
| lazy-load | GLB는 HTML에 넣지 않고 워커 경로 `/fcb/glb/<이름>-<SHA8>.glb`(불변 캐시)로 제공 (`add-worker-assets.py`). 요리대를 열 때만 내려받고, 크기·SHA-256 확인 후 파싱 |
| 폐기 | 요리대를 닫거나 다른 화면으로 바뀌면 렌더러·지오메트리·텍스처 dispose + `forceContextLoss`, 캔버스 제거 |
| 2.5D 폴백 | GLB 실패(네트워크·SHA 불일치·파싱), 터치 기기(`pointer:coarse`), 폭 600px 미만, 동작 줄이기 설정, `deviceMemory<4`, CPU 4코어 미만이면 2.5D만 사용. 요리는 장면과 무관하게 항상 가능 |
| 크기 | HTML +108KB(코드 + 2.5D 스틸), 워커 모듈 26,384,859B (v38 대비 +1,445,554B, GLB base64 포함) |

## QA 로그 위치

- 레포 `.gitignore`의 `*.log` 규칙 때문에 처음 두 커밋(`f5f31a3`, `aad9bc4` = Drive 번들)에는 게이트 로그 파일이 빠져 있었다. `git add -f`로 추적을 추가했다.
- `qa/gate1.log`: 기준선 SHA 대조.
- `qa/bundle-aad9bc4/gate2.log`, `gate3.log`: Drive 번들 커밋 `aad9bc4`를 별도 작업 트리로 빌드(`7faa5b9b…`)해 다시 돌린 결과 (92/92, 60/60). 모아 독립 검증과 같은 빌드다. 처음 실행분 원본은 재실행 때 덮어써서 남아 있지 않다.
- `qa/gate2.log`, `gate3.log`, `gate4.log`, `build.log`: Gate 4 빌드(`bab291a8…`) 기준.

## 기존(v38) 화면 이슈 — 이번 변경과 무관, 미수정

Gate 5에서 v38 원본과 위치까지 같게 재현된 것:
1. 마을 좌상단 부제목(`#town25dSub`)이 퀘스트 띠(`#t25Quest`)와 겹침 (PC·모바일).
2. 농장에서 농장 이동 패드 '이동'과 마을·유적용 조이스틱(`#ruinsWalkPad`) '이동'이 동시에 보여 글자가 두 번 보임.

## 세이브 영향

- 세이브 키는 `sandstar-p1-world-v1:official-m25d` 그대로입니다. `livingP0`에 필드만 추가했습니다: 밭별 `stage`·`wateredAt`, `energy`, `counts`(작물별 수확·요리별 제작·납품 품목별 수량).
- 기존(v38) 세이브에서 자라던 밭: 물을 줬고 기존 시간이 다 지났으면 3단계, 그 밖에는 1단계로 옮깁니다(물 준 상태는 유지). `energy`가 없으면 100으로 채웁니다.
- 이 빌드의 세이브를 v38에서 열어도 추가 필드만 무시되고 깨지지 않습니다(정규화 코드 기준 판단, 실측은 안 함).

## 결정 기록 (2026-11-23)

- 기력: v38에 체력·스태미나가 없어 새로 만든 농사용 기력을 알돌이 승인. 위 수치 그대로.
- 공개 범위: 알돌 결정 — 이미지·음원·SFX까지 모두 포함해 공개. 이 브랜치 푸시로 적용(v38 모듈 내장 미디어, 두리 PNG, 요리 재료 GLB 3종).
- 전달: 브랜치를 git 번들로 묶어 Drive 패킷 폴더에 새 파일로 업로드. 모아가 Gate 1~3을 독립 검증한 뒤에 푸시·PR을 진행.
