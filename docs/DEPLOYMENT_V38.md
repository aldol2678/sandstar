# 흙별 Worker v38 배포 기준

2026-11-23 KST 기준으로 확인한 흙별 본게임의 운영 배포 기록입니다.

| 항목 | 확인값 |
| --- | --- |
| 운영 사이트 | [sandstar.aldol.app](https://sandstar.aldol.app/) |
| Cloudflare Worker | `sandstar` |
| Worker 버전 | `v38` |
| 버전 ID | `052cb034-a10f-49fa-b6c3-4cafd2d7ede9` |
| 배포 시각 | 2026-11-23 08:10:49 KST |
| 조회 당시 트래픽 | 100% |
| 배포 모듈 | `main.mjs` |
| 모듈 크기 | 24,939,305바이트 |
| SHA-256 | `78b4503ad11f8944710bef061d861e95befc72b5debfc719e205c6c02c60ed07` |

Cloudflare에서 읽은 Worker 모듈 바이트의 SHA-256과 크기가 릴리스 매니페스트의 기록과 일치합니다. 배포 모듈은 Phase 0 패치가 적용된 빌드로, 팀 릴리스 보관소에 있습니다. [복구 기록](STATUS.md)은 초기 복구 시점의 자료입니다.

## v37에서 v38 재빌드

팀 릴리스 보관소의 v37 Worker를 사용합니다. 원본 파일명은 `SANDSTAR_v37_main-inner.mjs`이며 SHA-256은 다음과 같습니다.

`39cfe6989858a6df929d0421ef5aef96f0196b7dc94adbb6fcc36b98b86e3ae8`

Python 3과 Node.js가 필요합니다. 저장소 루트에서 [패치·빌드 스크립트](../tools/phase0-v38)를 임시 디렉터리로 복사해 실행합니다.

```sh
build_dir="$(mktemp -d)"
cp tools/phase0-v38/*.py tools/phase0-v38/extract-html.mjs "$build_dir/"
cp /path/to/SANDSTAR_v37_main-inner.mjs "$build_dir/v37-baseline-main-inner.mjs"
cd "$build_dir"

sha256sum -c <<'SHA256'
39cfe6989858a6df929d0421ef5aef96f0196b7dc94adbb6fcc36b98b86e3ae8  v37-baseline-main-inner.mjs
SHA256

node extract-html.mjs v37-baseline-main-inner.mjs v37-index.html
python3 patch-phase0.py
python3 patch-phase0b.py
python3 rebuild-worker.py
node --check phase0-main-inner.mjs

sha256sum -c <<'SHA256'
f2cb9415016dad6d0df5084aa42c2ec66b0c12a8e19b7c41608c535ca641bd51  phase0-index.html
78b4503ad11f8944710bef061d861e95befc72b5debfc719e205c6c02c60ed07  phase0-main-inner.mjs
SHA256
```

## 검증 결과

- 로컬 재빌드 Worker가 팀 릴리스 보관소의 v38 모듈과 바이트 단위로 일치했습니다. Cloudflare에서 읽은 운영 모듈과 SHA-256도 일치합니다.
- 재빌드 HTML이 보관본과 일치했습니다. v38 Worker에서 HTML을 다시 추출했을 때도 바이트 단위로 일치합니다. Worker 모듈과 실행되는 인라인 JavaScript 세 블록은 문법 검사를 통과했습니다.
- 인계된 Phase 0 QA 기록은 43/43 통과입니다. 실기기 터치와 보고된 간헐적 무응답 원인은 미확인 상태입니다.
- 내장 음원·이미지의 공개 재배포 범위를 확인 중입니다. v37 입력 모듈과 미디어가 포함된 빌드 산출물은 팀 릴리스 보관소에 있습니다.

[운영 소스 이관 체크리스트](SOURCE_IMPORT.md)에는 전체 게임 소스 이관 조건을 기록합니다. [PR #8](https://github.com/aldol2678/sandstar/pull/8)은 v22 출처 감사 기록입니다.
