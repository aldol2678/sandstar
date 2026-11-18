# 흙별 M2.5-D 지역 BGM QA 원본 보존

이 14개 조각은 2026-11-18 Google Drive에 저장된 **QA 후보**를 무손실 보관한 것입니다.
**현재 Cloudflare 운영 Worker v20과 동일한 소스라고 검증되지 않았습니다.**

- 검증: `node tools/verify-import.mjs`
- 단일 HTML 복원: `node tools/verify-import.mjs --write`
- 원본 SHA-256과 각 Git blob SHA-1: `docs/source-manifest.json`
- 복원 파일은 `dist/`에 생성하며 자동 배포하지 않습니다.

현재 소리·이미지 자산이 소스에 내장돼 있어 원본 보존을 우선했습니다. 모듈/에셋 분리는 운영 소스와 대조한 뒤 별도 PR로 수행합니다.
