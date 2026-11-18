# 흙별 개발·운영 상태

점검일: 2026-11-19 (KST). **이 문서는 상태 스냅샷이며 최신 운영 Worker와 동등한 소스코드임을 증명하지 않습니다.**

## 직접 확인한 사실

- 비공개 GitHub: `aldol2678/sandstar`. 이 브랜치를 만들기 전 `main`에는 최초 `README.md`만 존재했으며 게임 소스, 기존 Issue, PR이 없었음.
- Cloudflare 본게임 Worker: `sandstar`. 2026-11-19 00:54:26 KST에 배포된 Worker **버전 20**, version ID `6ff911f0-e9ae-450d-90f9-bd3d8ec59213`, deployment ID `f48a0478-2ef4-4025-88e0-448e93d71c87`, 당시 100% 트래픽.
- 타이틀 삽입용 별도 Worker: `sandstar-title-bridge`. 기존 배포의 version ID `7726327c-7759-4066-961a-6bc691730e43`. 이 Worker의 HTMLRewriter 타이틀 주입과 본게임 Worker는 별도 자산.
- 2026-11-19 00:41 KST경 라이브 `/healthz`는 `status=ok`, `build=M25D-UI1-20261118`을 반환했음. **Worker 버전 20의 내부 게임 패치 내용이나 소스 동등성을 이 응답만으로 확정할 수 없음.**

## 기존 인계 자료(운영 CURRENT 판정에 자동 사용 금지)

- [M2.5-D 공식 배포·운영 기록](https://docs.google.com/document/d/1hVSOjcTgFA7JbyY97BTZAl_GBA7yjgnekL0z8tkmqgc/edit)
- [타이틀 운영 배포 기록](https://drive.google.com/file/d/1htuBHGC5--VriwvAaqYj4W65JcLNgkS0/view)
- [기존 개발 현황 인덱스 (2026-11-13의 역사적 시점)](https://drive.google.com/file/d/1TRUwAaOVV0H_jNK7HBVlYfO92Gh3dqgD/view)
- [흙별 빌드·QA 원본 폴더](https://drive.google.com/drive/folders/1AEIw-oqKb_5Dzv2ynVpM8ZQj_m4IRNb1)

## 아직 확인되지 않은 항목

- Cloudflare 20번 버전 ↔ Drive 최신 게임 HTML ↔ 개발 통합 `v19`의 정확한 동일성.
- 광부·로프·보물상자·드릴 고유 성장·농사 M3·NPC 대사 등 독립 개발본의 최신 운영 통합 범위.
- Android 실기기 장시간 음악, 회전, 멀티터치, 세이브 이전·복구의 최신 회귀 QA.
- GitHub에서 재현 가능한 소스 빌드, 배포 구성 및 롤백 절차의 완전성.

이관 완료 전에는 기존 드라이브와 Cloudflare 증거를 보존하며 GitHub 파일을 운영 정본으로 선언하지 않습니다.
