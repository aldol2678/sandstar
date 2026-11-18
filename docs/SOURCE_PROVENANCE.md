# 흙별 소스 이관 증거 및 한계

기준일: 2026-11-19 KST. **Issue #1 진행 중인 소스 복구 작업**이며 정식 운영본 인증이나 배포가 아닙니다.

## 확보 완료

- **타이틀 브리지 원본:** Drive의 `sandstar_title_bridge_worker_20261118.js` 659,846바이트를 `workers/title-bridge.js`에 Git blob으로 확보. SHA-256 `264797d9303ce719d39f994beffa50b924472d59c167034ea4f118e609aec369`은 11월 18일 배포 기록에 적힌 값과 일치.
- **게임 QA 후보:** Drive의 `SANDSTAR_M25D_UI1_REGION_BGM_QA_HUD_SAFE_20261118.html` 5,923,918바이트를 14개 텍스트 Git blob으로 분할 보존. 원본 SHA-256 `a4390853678d44349ae0b24ada7f4455e5590d97826a74dc0a329515812226c1` 및 조각별 Git SHA-1을 검증. **이 파일은 독립 QA 후보이지 Cloudflare v20 운영 소스로 확인된 것이 아닙니다.**
- **타이틀 배포 메타:** Cloudflare `sandstar-title-bridge` version ID `7726327c-7759-4066-961a-6bc691730e43` 확인. 원본 SHA는 배포 기록과 일치하나 Worker의 실제 바이트를 다시 내려받아 비교하지 못함.

## 아직 미확인

- 운영 `sandstar` Worker 20번(배포 ID `f48a0478-2ef4-4025-88e0-448e93d71c87`, version ID `6ff911f0-e9ae-450d-90f9-bd3d8ec59213`, script ETag `42e4a8e544c8fcdfcb4247fab47a58f45691c806bf92642e9fa569e56a2cf5e7`)의 JS 전체 원본. Cloudflare 연결 도구의 바이너리 응답 및 메모리 제한으로 코드 획득이 불가했음.
- 게임 QA 파일과 현재 운영 Worker의 바이트/기능 동등성, 타이틀 삽입 후 화면과 QA HTML의 동일성.
- 농사 M3, 광부 v19, 드릴·로프·보물상자·NPC 대사·BGM의 운영 반영 범위.
- 모든 내장 음원·에셋의 최종 라이선스 확인과 Android 실기기 및 실제 세이브 회귀 검증.

## 재현 방법

`node tools/verify-import.mjs`: 14조각의 Git SHA-1, 전체 SHA-256, 타이틀 브리지 SHA-256을 검사하며 **쓰기·배포하지 않습니다**.

`node tools/verify-import.mjs --write`: 같은 검증을 수행하고 `dist/recovered-m25d-ui1-region-bgm-qa.html`을 생성합니다. **QA 후보만 복원**하는 것이며 운영 서버나 세이브를 변경하지 않습니다.

## 후속 게이트

1. 기존 Wrangler 배포 원본 또는 인가된 소스 저장 위치에서 Worker v20의 정확한 바이트와 구성 확보.
2. 보관된 후보와 v20의 기능·해시 차이를 비교하고 재현 가능한 build/asset 구성을 분리.
3. 비밀정보·에셋 권리 검토와 PC/Android 및 저장·포털·BGM QA를 마친 뒤 별도 승인으로 정본 승격.

참조: [게임 QA 원본](https://drive.google.com/file/d/13cA0OYYVChEwR8YaC5h8twJ4S2QHvXbr/view), [타이틀 브리지](https://drive.google.com/file/d/1NEkOq_42-e3wr1ZCfS_7Z7ort4aUrVeF/view), [배포 기록](https://drive.google.com/file/d/1htuBHGC5--VriwvAaqYj4W65JcLNgkS0/view).

**2026-11-19 갱신:** GitHub PR #4·#5를 `main`에 병합하고 14개 분할 조각·타이틀 브리지·manifest·운영 문서의 경로 readback 확인. `main` HEAD `50239836d7bd879405fa22003cc021e44e0156a4`. 그러나 Cloudflare Worker v20 실소스/동등성 인증, CI, Cloudflare 재배포, 사용자 세이브 변경은 수행하지 않음. GitHub 보관본을 운영 정본으로 간주하지 않음.

## 2026-11-19 추가 관측

Cloudflare `sandstar`의 가장 최근 읽기 확인 배포는 **v21** (`032cf8b8-ed7b-4ce7-8228-bef1038331f7`, 100% 트래픽)로 업데이트됨. v20은 역사적 비교 대상으로 보존. 실제 v21 Wrangler 소스는 미확보. 공개 HTTP HTML을 Firecrawl `rawHtml`로 11개 blob (합계 12,019,476바이트) 보관한 작업은 [Draft PR #7](https://github.com/aldol2678/sandstar/pull/7)에서 추적. 이 응답은 별도 타이틀 브리지를 거쳐 변형됐을 수 있어 **운영 Worker v21과 동일하지 않음**. `/healthz`의 최신 응답, 실사용자 세이브 및 Android 검증은 이 수집만으로 확인하지 못함.
