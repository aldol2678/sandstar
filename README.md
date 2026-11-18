# 흙별 | SANDSTAR

픽셀 샌드박스 게임 **《흙별》(SANDSTAR)**의 비공개 개발 저장소.

- 운영 사이트: https://sandstar.aldol.app/
- 기획·빌드·QA 원본: [흙별 Google Drive](https://drive.google.com/drive/folders/1AEIw-oqKb_5Dzv2ynVpM8ZQj_m4IRNb1)
- 현황과 근거: [docs/STATUS.md](docs/STATUS.md)
- 개발·릴리스 절차: [docs/OPERATIONS.md](docs/OPERATIONS.md)
- 운영 소스 이관 체크리스트: [docs/SOURCE_IMPORT.md](docs/SOURCE_IMPORT.md)

> **복구 상태 (2026-11-19):** PR #4 및 #5를 `main`에 병합하여 타이틀 브리지, 출처·해시가 기록된 QA 게임 소스 아카이브, 무결성 확인 스크립트를 보존했습니다. **게임 소스 아카이브는 Cloudflare 운영 Worker v20과 일치한다고 검증된 소스가 아닙니다.** GitHub 병합은 게임 배포나 운영 정본 채택과 별개입니다.

## 개발 운영 원칙

1. 비공개 저장소 유지. 기능 변경은 별도 브랜치와 Pull Request로 검토.
2. 배포 중인 Cloudflare Worker 및 사용자 세이브 데이터는 자동으로 변경하지 않음.
3. CI 자동 실행이나 GitHub → Cloudflare 자동 배포는 도입하지 않음. 필요한 검사는 명시적으로 수동 수행.
4. 검증된 소스와 실제 배포의 연결 관계(빌드·SHA-256·Worker 버전·QA)를 기록.
5. 과거 로컬 QA 빌드, 개발 후보, 운영본을 서로 혼동하지 않음.

## 복구한 파일

- `workers/title-bridge.js`: 타이틀 삽입 Worker 원본 (배포 기록의 SHA-256과 일치)
- `recovered/m25d-ui1-region-bgm-qa/parts/`: 독립 QA HTML 14조각 보존
- `docs/source-manifest.json`: 소스 크기, Git blob SHA-1, 원본 SHA-256
- `tools/verify-import.mjs`: 읽기 전용 무결성 검사, `--write` 시에만 QA HTML 재조립
- `docs/SOURCE_PROVENANCE.md`: 원본 출처와 미검증 사항

## 다음 단계

[운영 소스 이관](docs/SOURCE_IMPORT.md)에서 Worker v20 실소스 동등성 검증을 마친 뒤 게임 통합·QA 작업을 진행합니다. 라이선스 및 배포 권한이 확인되지 않은 음원·폰트·이미지 원본이나 인증정보는 업로드하지 않습니다.
