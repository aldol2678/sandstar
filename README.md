# 흙별 | SANDSTAR

광산에서 광석을 캐고, 숲과 고대 유적을 탐험하는 픽셀 샌드박스 웹게임입니다. 마을을 거점으로 장비를 강화하고 더 깊은 곳으로 내려가 별조각을 찾습니다.

[브라우저에서 흙별 플레이하기](https://sandstar.aldol.app/)

## 저장소 현황

이 공개 저장소에는 타이틀 브리지, 복구한 QA 빌드, 개발·릴리스 기록이 있습니다. 2026년 11월 23일 확인한 운영 게임은 Cloudflare Worker v38에서 서비스합니다. v37에서 v38로 재빌드하는 스크립트와 검증 절차를 제공합니다. 재빌드에는 팀 릴리스 보관소의 v37 모듈이 필요합니다.

- [Worker v38 운영 배포 기록](docs/DEPLOYMENT_V38.md)
- [복구 당시 상태와 근거](docs/STATUS.md)
- [개발·릴리스 절차](docs/OPERATIONS.md)
- [운영 소스 이관 체크리스트](docs/SOURCE_IMPORT.md)

## 복구 자료

PR #4와 #5에서 운영 문서와 QA 자료를 보존했습니다. QA 빌드와 당시 운영 Worker v20의 동등성은 미검증 상태입니다.

- `workers/title-bridge.js` — 타이틀 삽입 Worker 원본. 보관본 해시는 당시 배포 기록과 일치합니다.
- `recovered/m25d-ui1-region-bgm-qa/parts/` — 독립 QA HTML 14조각.
- `docs/source-manifest.json` — QA 원본의 크기, Git blob SHA-1, SHA-256.
- `tools/verify-import.mjs` — 읽기 전용 무결성 검사. `--write`를 지정하면 QA HTML을 재조립합니다.
- [복구 파일의 출처와 검증 범위](docs/SOURCE_PROVENANCE.md)

## 개발·릴리스

기능 변경은 별도 브랜치와 Pull Request에서 검토합니다. 게임 배포는 별도로 관리하며, 릴리스 기록에는 빌드 해시, Worker 버전, QA 결과를 남깁니다. 외부 에셋은 재배포 권한이 확인된 범위에서 공개합니다.
