# 흙별 개발·운영 상태

점검일: 2026-11-19 (KST). **이 문서는 상태 스냅샷이며 최신 운영 Worker와 동등한 소스코드임을 증명하지 않습니다.**

## 직접 확인한 사실

- 비공개 GitHub: `aldol2678/sandstar`. 최초 `main`은 README만 존재했으나, **2026-11-19 PR #4(운영 문서)와 PR #5(소스 아카이브)를 squash 병합**하고 `main` 파일 readback 확인. 당시 HEAD `50239836d7bd879405fa22003cc021e44e0156a4`, 검수 대상 14조각·타이틀 브리지·source-manifest·verify-import 도구가 존재함. **이는 운영본 소스 동등성 검증을 의미하지 않음.**
- Cloudflare 본게임 Worker: `sandstar`. **2026-11-19 07:19:41 KST 배포된 최신 조회 버전 v22**, version ID `949c7699-9455-4617-a585-c9c55105ab06`, deployment ID `29144a6c-373e-4763-8a85-237c2305a873`, 조회 당시 100% 트래픽. 이전 v21은 07:07:07 KST 배포(version ID `032cf8b8-ed7b-4ce7-8228-bef1038331f7`)되고 당시 100%였음. 그 이전 v20은 version ID `6ff911f0-e9ae-450d-90f9-bd3d8ec59213`, deployment ID `f48a0478-2ef4-4025-88e0-448e93d71c87` (2026-11-19 00:54:26 KST 배포).
- 타이틀 삽입용 별도 Worker: `sandstar-title-bridge`. 기존 배포의 version ID `7726327c-7759-4066-961a-6bc691730e43`. 이 Worker의 HTMLRewriter 타이틀 주입과 본게임 Worker는 별도 자산.
- 2026-11-19 00:41 KST경 라이브 `/healthz`는 `status=ok`, `build=M25D-UI1-20261118`을 반환했음. **Worker 버전 20의 내부 게임 패치 내용이나 소스 동등성을 이 응답만으로 확정할 수 없음.**

## 기존 인계 자료(운영 CURRENT 판정에 자동 사용 금지)

- [M2.5-D 공식 배포·운영 기록](https://docs.google.com/document/d/1hVSOjcTgFA7JbyY97BTZAl_GBA7yjgnekL0z8tkmqgc/edit)
- [타이틀 운영 배포 기록](https://drive.google.com/file/d/1htuBHGC5--VriwvAaqYj4W65JcLNgkS0/view)
- [기존 개발 현황 인덱스 (2026-11-13의 역사적 시점)](https://drive.google.com/file/d/1TRUwAaOVV0H_jNK7HBVlYfO92Gh3dqgD/view)
- [흙별 빌드·QA 원본 폴더](https://drive.google.com/drive/folders/1AEIw-oqKb_5Dzv2ynVpM8ZQj_m4IRNb1)

## 아직 확인되지 않은 항목

- Cloudflare 최신 22번 및 이전 21/20번 버전 ↔ Drive 최신 게임 HTML ↔ 개발 통합 `v19`의 정확한 동일성. 2026-11-19 v21 배포 시점 공개 HTTP 스냅샷은 확보했으나 `sandstar-title-bridge` 경유 응답이므로 Wrangler 원본은 미확보.
- 광부·로프·보물상자·드릴 고유 성장·농사 M3·NPC 대사 등 독립 개발본의 최신 운영 통합 범위.
- Android 실기기 장시간 음악, 회전, 멀티터치, 세이브 이전·복구의 최신 회귀 QA.
- GitHub에서 재현 가능한 소스 빌드, 배포 구성 및 롤백 절차의 완전성.

이관 완료 전에는 기존 드라이브와 Cloudflare 증거를 보존하며 GitHub 파일을 운영 정본으로 선언하지 않습니다.

## 2026-11-19 새 복구 증거

- 공개 사이트 HTTP를 Firecrawl `rawHtml`로 관측한 12,019,476바이트 HTML을 11개 Git blob으로 분할 보관한 [Draft PR #7](https://github.com/aldol2678/sandstar/pull/7) 생성.
- QA 아카이브 5,923,918바이트와 정적 비교 결과: `ssTitleArt` 등 타이틀 관련 마커 차이, 스크립트 수 차이. 일부 게임 마커는 양쪽에 존재함. **기능 동등성 및 Worker v21 소스 복구를 의미하지 않음**.
- Cloudflare API `GET /workers/scripts/sandstar` 및 `/content/v2`는 현 연결에서 원문 본문을 반환하지 못함. 배포 메타데이터 조회와 분리해 판단.
- CI/운영 배포/저장 데이터 변경 없음.

- **추가 배포 변동:** 복구 조사 중 07:19 KST v22가 별도 Wrangler 경로에서 배포됨. v21 당시 스냅샷을 v22 운영 원본으로 소급하지 않음. v22 원본과 v21/v20 간 소스 diff 미완료.
