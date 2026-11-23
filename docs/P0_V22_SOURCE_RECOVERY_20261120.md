# SANDSTAR P0 · Cloudflare v22 운영 소스 복구 감사

- 확인일: **2026-11-20 KST**
- 분류: **RECOVERY IN PROGRESS / PRODUCTION SOURCE UNKNOWN / NO DEPLOY**
- 대상: `aldol2678/sandstar` GitHub vs Cloudflare Worker `sandstar`
- 이 문서는 정본 승격 기록이 아니며, 신규 배포도 승인하지 않습니다.

## 1. Cloudflare 직접 API readback

| 구분 | 실제 조회 결과 |
| --- | --- |
| 최신 조회 배포 | `29144a6c-373e-4763-8a85-237c2305a873` |
| 프로덕션 Worker | `sandstar` |
| 최신 배포의 Worker 버전 | **22**, `949c7699-9455-4617-a585-c9c55105ab06`, 당시 100% |
| v22 작성 | 2026-11-19 07:19:40 KST |
| v22 배포 | 2026-11-19 07:19:41 KST |
| v22 source field | `wrangler` |
| v22 script ETag | `9dd31ce5657dec5ab1bdb5805e73ef3659e82e2b159d0a91a472d72a22ac4dbc` |
| handlers | `fetch` |
| compatibility_date | `2026-11-18` |
| usage_model | `standard` |
| version settings bindings | 빈 배열 |
| 직전 v21 | `032cf8b8-ed7b-4ce7-8228-bef1038331f7` |
| 그 이전 v20 | `6ff911f0-e9ae-450d-90f9-bd3d8ec59213` |

근거: 권한이 연결된 Cloudflare API의 `GET /accounts/{account_id}/workers/scripts/sandstar/deployments`, `/versions`, `/versions/{version_id}`, `/settings` 결과. API 계정 ID와 인증정보는 GitHub에 기록하지 않음.

**한계:** v22 버전 메타데이터와 ETag는 실제 Wrangler 업로드 원본의 SHA-256을 의미하지 않음. 조회 결과는 새 배포 이전의 마지막 기록이며, 이 문서 작성 중 별도의 라이브 게임 브라우저 QA를 완료하지 않았음.

## 2. 운영 원본 확보 시도 및 장애

- Cloudflare Worker 원본 다운로드 엔드포인트 `GET /workers/scripts/sandstar`, `GET /workers/scripts/sandstar/content/v2`는 연결 계층에서 재현 가능한 코드 파일을 제공하지 못함.
- 두 스크립트 콘텐츠와 버전 메타데이터를 동시에 다시 읽는 시도에서 **Worker exceeded memory limit** 오류가 발생함. 이는 콘텐츠 전체 바이트를 확보하거나 해시를 계산했다는 뜻이 아님.
- GitHub 저장소 전체 검색에서는 해당 원본으로 식별 가능한 v22 Wrangler 프로젝트 소스를 발견하지 못함.
- 공식 사이트 `https://sandstar.aldol.app/` 및 `/healthz`는 이번 점검의 공개 웹 조회가 접근 실패하여 현 시점 HTTP 상태 미확인.

**결론:** 실제 v22 Wrangler 원본·빌드 설정·정적 에셋의 정확한 조합은 **NOT ACQUIRED**. 이 단계에서 QA HTML 또는 웹 응답으로 v22 소스를 대체하거나 GitHub를 운영 정본으로 선언하면 안 됨.

## 3. 이미 확보된 증거와 출처 차이

| 자료 | 위치 | 크기 | 판정 |
| --- | --- | ---: | --- |
| M2.5-D UI1 지역 BGM QA HTML | `recovered/m25d-ui1-region-bgm-qa/parts/` (`main`) | 5,923,918 bytes | Drive QA 원본과 SHA-256 `a4390853678d44349ae0b24ada7f4455e5590d97826a74dc0a329515812226c1` 검증 기록. **운영 코드 아님** |
| 타이틀 브리지 소스 | `workers/title-bridge.js` (`main`) | 659,846 bytes | SHA-256 `264797d9303ce719d39f994beffa50b924472d59c167034ea4f118e609aec369`, 기존 배포 기록의 해시와 부합. 라이브 Worker 바이트 재비교 아님 |
| 공개 HTTP `rawHtml` 관측 | Draft PR #7 `recovered/live-http-20261119/parts/` | 12,019,476 bytes | v21 시점 공용 경로 관측값. **v22 소스 아님**, HTMLRewriter/계측 포함 |
| 2026-11-19 별도 원시 HTTP 관측 | Draft PR #7 비교 문서 | 11,998,630 bytes | Firecrawl 출력과 다름. v22 Worker 원본/동등성을 증명하지 않음 |
| Cloudflare Worker v22 | Cloudflare 배포 메타데이터 | 원본 미확보 | ETag/버전만 확인 |

관련 출처: [PR #5](https://github.com/aldol2678/sandstar/pull/5), [Draft PR #7](https://github.com/aldol2678/sandstar/pull/7), [P0 Issue #1](https://github.com/aldol2678/sandstar/issues/1).

## 4. 실제 원본 수용 조건 (순서 고정)

1. v22가 배포된 **원래의 인가된 Wrangler 작업 디렉터리** 또는 원본 보관소에서 다음을 확보: 엔트리 JS/TS, `wrangler.toml/jsonc`, lockfile, build script, `assets` 구성, 라이선스 및 리소스 목록. 개인 인증정보와 실제 secret 값은 제외.
2. 확보 파일에 각각 SHA-256, 파일 크기, 상대경로, 제공 위치 및 제공 시점을 기록. 배포 버전 ID/ETag와 출처 연결을 별도로 입증.
3. v22 원본과 v21/v20 (가능한 경우), GitHub QA 후보, PR #7 웹 응답을 **source / transformed HTTP / title-bridge / third-party scripts**로 분리해 비교. 정적 구조·게임 핵심 기능·저장 키의 호환성 차이표 작성.
4. 별도 일시 환경에서 빌드의 재현성 검증. **동작 성공과 운영본 동일성은 별개 게이트**.
5. 기존 세이브 fallback/복구, 5개 월드, 로프·채굴·농사·BGM·NPC, PC/Android 실기기, OG/SEO/healthz, 에셋 권리와 비밀정보 감사 수행.
6. 모든 필수 게이트 PASS 후 검토된 PR로 코드 정리. **GitHub 정본 승격, main 병합, 운영 배포는 개별적으로 판단**.

## 5. 현 시점 판정

- 배포 버전·기초 설정 식별: **VERIFIED (Cloudflare API metadata)**
- QA/타이틀 아카이브의 존재와 역사적 해시: **VERIFIED (existing GitHub records)**; 이번 세션의 독립 파일 전체 해시 실행은 미수행
- 운영 v22 업로드 원본: **BLOCKED / NOT ACQUIRED**
- v22 vs GitHub QA/HTTP diff: **NOT STARTED (requires source)**
- Android/PC 실제 게임 회귀: **NOT RUN**
- GitHub 운영 정본 승격: **HOLD**
- Cloudflare 배포, 세이브 키 변경, CI/Actions: **NOT PERFORMED**

이 문서는 증거와 다음 수용 게이트만 기록하며, 운영 Worker·사용자 세이브·브랜치 `main`에는 변경을 가하지 않음.


## 6. 추가 검증: v22 실제 배포 모듈 SHA-256 (2026-11-20)

**Cloudflare 인증 버전 API에서 v22 배포 모듈 1개를 확인하고 직접 SHA-256을 재계산함.**

- API: 읽기 전용 `GET /accounts/{account_id}/workers/workers/sandstar/versions/949c7699-9455-4617-a585-c9c55105ab06?include=modules`
- 반환 버전 ID: `949c7699-9455-4617-a585-c9c55105ab06`
- module: `main-inner.mjs`, `application/javascript+module`
- base64 길이: **15,626,880 문자**
- 디코딩된 모듈 크기: **11,720,159 bytes**
- 실제 메모리 디코딩 후 직접 계산한 SHA-256: **`91dbad505cdad8fd1b90cb80a9583c25cbc241665c60e202286462c35066fb8d`**
- 결과: Drive 기존 `SANDSTAR_worker_v22_source_evidence_20261120.json`과 해시 및 크기가 정확히 일치함.
- **중요:** 이 결과는 배포 모듈 바이트의 인증 API 기반 지문이며, 원본 편집 프로젝트·Wrangler 작업 디렉터리 경로·lockfile·빌드 설정을 증명하지 않음. 배포 모듈 전체 바이트를 GitHub/로컬에 저장하는 단계는 **미완료**.

**Drive에서 발견한 비공개 복구 증거**

- `07_릴리스·아카이브/SANDSTAR_worker_v22_source_evidence_20261120.json` (ID `1Jvz0mYiUBGanLGxSchHHh5TCPzC5q4EJ`)
- `07_릴리스·아카이브/SANDSTAR_v22_live_fingerprint_20261120.json` (ID `1PvSGe6N6BtiHXKmaRmOm_rMTVaDMYBF7`)
- `02_소스코드·시스템/SANDSTAR_worker_v22_recovery_kit_20261120.zip` (ID `1dCSo2b-FVYILeSDuUxtd1lpZfL_4H9QG`)
- `02_소스코드·시스템/SANDSTAR_capture_live_20261120.sh` (ID `1Niy87JwnsFB3NvtqpUjsUQlg8GACayeu`)
- 과거 독립 Worker 소스 `07_릴리스·아카이브/sandstar-worker-main-20261111.mjs` (ID `1kpAFTb87Kl8o9s2q4FEcLdLtQVWhlQ6n`)는 v3 기준으로 **v22와 같다는 근거 없음**.

복구 ZIP 내부의 `recover_sandstar_worker_v22.sh`는 API에서 모듈을 받아 해당 SHA-256과 크기를 모두 검사하고, 일치할 때만 로컬 파일을 생성하도록 작성돼 있음. **이 세션에서는 코드를 직접 실행하지 않고** `bash -n` 정적 문법 검사 PASS, ZIP 내 증거 JSON과 Drive 증거 JSON이 내용상 동일함을 확인. 토큰을 공유하지 않고 권한 있는 환경에서만 사용해야 함. 복구 키트는 실행 또는 보관 중 실제 사용되는 인증정보를 GitHub에 저장하면 안 됨.

**새로운 게이트 판정:**

1. Cloudflare v22 배포 모듈 **API 해시 검증 = PASS**
2. 배포 모듈 **전체 파일 로컬/Drive/비공개 GitHub 재현 보관 = HOLD**
3. **편집 가능한 원래 Wrangler 작업공간/빌드 설정 경로 = UNKNOWN**
4. 운영본과 GitHub QA 후보 **실제 코드 차이 분석 = BLOCKED**
5. 코드 정본 승격·운영 배포·CI·세이브 변경 = **NOT AUTHORIZED / NOT PERFORMED**

기존 §2의 실패 진술은 기존 `workers/scripts` 경로에 대한 사실이며, 이 §6의 *별도 버전 API를 통한 해시 검증*과 구별함.

## 7. 운영 업데이트: v23 배포 확인 (2026-11-20 21:55 KST)

이 문서의 §§1~6은 **v22 시점 역사적 감사 기록**으로 유지. **2026-11-20 21:55 KST** Cloudflare Deployments 및 Versions API 재조회 결과 운영 최신 버전이 변경됨.

- Worker: `sandstar`
- **현재 조회된 최신 운영 버전: v23**, version ID `33ecd49f-ab9a-4b7b-bb38-ebe1075af258`
- 배포 ID: `465de9e7-8b5d-4a66-a218-b78b3174ba24`
- 배포 시각: `2026-11-20T12:45:49.859095Z` = **2026-11-20 21:45:49 KST**
- 배포 출처: `wrangler`; 트래픽 비율: **100%**
- v23 ETag: `9f9c270612de250610c4d69f418ea942b2a6814479c1836507eac4988cc781ec`
- 직전 배포: v22 `949c7699-9455-4617-a585-c9c55105ab06`

따라서 **v22는 현재 운영 기준이 아님**. v22 모듈 11,720,159바이트 SHA-256 검증은 역사적 근거로 유효하지만, **v23 운영 모듈과 동일하다고 주장하지 않음**. 새 P0 source parity 기준은 **v23**으로 이동해야 함. 기존 모아 또는 기타 배포 주체의 귀속은 해당 작업 로그로 별도 입증해야 함. 배포가 정상이라는 사실과 배포한 Wrangler 원래 작업공간이 이 저장소와 동등하다는 사실은 분리해야 함.

**이번 작업에서는 Cloudflare 변경·배포, CI, `main` 변경, 세이브 키 변경을 수행하지 않았음.**
