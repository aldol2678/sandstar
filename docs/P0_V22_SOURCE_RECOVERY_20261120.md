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
